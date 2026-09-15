// Runs the follow-ups. Called by the same cron that retries reports.
//
// Deliberately conservative: it looks at every campaign, but for each lead it
// stops at the first reason not to send. The default outcome is silence, and
// every send is a row someone can point at afterwards.
//
// Dry-run first. The panel calls this with dryRun so Divya can see exactly who
// would be messaged before any of it goes out - a promotional sweep is the one
// job here you cannot take back once it has run.

const campaigns = require('./campaigns');
const delivery = require('./delivery');
const messages = require('./messages');
const whatsapp = require('./transports/whatsapp');
const email = require('./transports/email');
const reportLinks = require('./reportLinks');

// Header images Divya's team supplied for each marketing template, same
// pattern as the transactional sends in delivery.js - resent with every
// message, per Meta/Uomox's own header rules, never reused from the
// template definition itself.
const CAMPAIGN_IMAGES = {
  free_to_blueprint_1: 'free-to-blueprint-1.png',
  free_to_blueprint_2: 'free-to-blueprint-2.png',
  checkout_abandoned: 'checkout-abandoned.png',
  blueprint_to_consultation: 'blueprint-to-consultation.png',
  post_call_followup: 'post-call-followup.png'
};

async function sendCampaign(campaign, lead) {
  const spec = campaigns.CAMPAIGNS[campaign];
  const vars = messages.campaignWhatsapp(campaign, lead);

  if (whatsapp.isConfigured() && lead.phone) {
    const image = CAMPAIGN_IMAGES[campaign];
    const result = await whatsapp.send({
      to: lead.phone,
      template: whatsapp.templateName(spec.template),
      bodyParams: vars.body,
      imageUrl: image ? `${reportLinks.siteUrl()}/whatsapp/${image}` : undefined
    });
    if (result.sent) return { channel: 'whatsapp', id: result.id };
  }

  if (email.isConfigured() && lead.email) {
    const mail = messages.campaignEmail(campaign, lead);
    const result = await email.send({
      to: lead.email, subject: mail.subject, text: mail.text, html: mail.html
    });
    if (result.sent) return { channel: 'email', id: result.id };
  }

  throw new Error('no channel could deliver');
}

/**
 * @param {boolean} [dryRun] report what would happen and send nothing.
 * @param {string[]} [only] restrict to named campaigns.
 */
async function sweep({ environment = campaigns.runtimeEnvironment(), dryRun = false, only = null, limit = 25 } = {}) {
  const summary = {
    environment, dry_run: Boolean(dryRun),
    can_send: delivery.isConfigured(),
    sent: 0, skipped: 0, failed: 0, would_send: [], skipped_because: {}
  };

  const names = (only && only.length ? only : Object.keys(campaigns.CAMPAIGNS))
    .filter(name => campaigns.CAMPAIGNS[name]);

  for (const campaign of names) {
    let leads = [];
    try {
      leads = await campaigns.audience(campaign, environment);
    } catch (error) {
      summary.failed += 1;
      summary.skipped_because[`${campaign}: audience`] = error.message;
      continue;
    }

    for (const lead of leads.slice(0, limit)) {
      const reasons = await campaigns.blockers(lead, campaign, environment);

      if (!reasons.length && await campaigns.alreadyConverted(lead, campaign, environment)) {
        reasons.push('already bought this');
      }

      if (reasons.length) {
        summary.skipped += 1;
        const key = `${campaign}: ${reasons[0]}`;
        summary.skipped_because[key] = (summary.skipped_because[key] || 0) + 1;
        continue;
      }

      if (dryRun) {
        summary.would_send.push({
          campaign,
          label: campaigns.CAMPAIGNS[campaign].label,
          lead_id: lead.id,
          name: lead.name || '',
          // Enough to recognise someone, not enough to be a contact export.
          phone: String(lead.phone || '').slice(-4).padStart(6, '•'),
          channel: whatsapp.isConfigured() && lead.phone ? 'whatsapp' : 'email'
        });
        continue;
      }

      // Claimed before sending: the unique index is what stops a second sweep,
      // running while this one is mid-flight, sending the same message again.
      const claimed = await campaigns.claim({ environment, leadId: lead.id, campaign });
      if (!claimed) { summary.skipped += 1; continue; }

      try {
        const result = await sendCampaign(campaign, lead);
        await campaigns.recordOutcome(claimed.id, { channel: result.channel, status: 'sent', detail: result.id });
        summary.sent += 1;
      } catch (error) {
        await campaigns.recordOutcome(claimed.id, { channel: '', status: 'failed', detail: error.message });
        summary.failed += 1;
      }
    }
  }

  return summary;
}

module.exports = { sweep, sendCampaign };
