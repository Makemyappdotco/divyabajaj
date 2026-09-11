// The follow-up messages: free reading to blueprint, blueprint to consultation.
//
// This is the only part of the system that sends something the customer did
// not ask for, so it is the part with the most brakes on it. Four of them, and
// every one has to pass before a single message goes out:
//
//   1. marketing_consent is true. Not the transactional consent columns - a
//      booking confirmation needs no permission, a promotion does. Meta
//      requires demonstrable opt-in and blocks numbers that skip it.
//   2. They have not opted out.
//   3. They have not already had this exact campaign - enforced by a unique
//      index, so a sweep that runs twice cannot send twice.
//   4. Not within the quiet period of any other campaign message.
//
// And one more that matters commercially rather than legally: anyone who has
// already bought the thing being suggested is excluded. Being sold something
// you own is worse than not being sold to at all.

const crypto = require('crypto');
const db = require('../database');

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function hoursAgo(n) { return new Date(Date.now() - n * 3600 * 1000).toISOString(); }

// At most one promotional message in this window, whatever else is due.
// Somebody who gets two in a day unsubscribes, and rightly.
const QUIET_HOURS = Number(process.env.CAMPAIGN_QUIET_HOURS) || 72;

// Nothing older than this is ever followed up. A message about a reading from
// two months ago reads as a mailing list, not a person.
const MAX_AGE_HOURS = Number(process.env.CAMPAIGN_MAX_AGE_HOURS) || 21 * 24;

/**
 * Each campaign names its own audience.
 *
 * delayHours is measured from the thing that triggered it, and `after` names a
 * campaign that must already have been sent - that is what makes a two-step
 * sequence a sequence rather than two independent messages.
 */
const CAMPAIGNS = {
  free_to_blueprint_1: {
    template: 'free_to_blueprint_1',
    label: 'Free reading, first follow-up',
    delayHours: Number(process.env.CAMPAIGN_FREE_1_HOURS) || 24,
    trigger: 'free_report'
  },
  free_to_blueprint_2: {
    template: 'free_to_blueprint_2',
    label: 'Free reading, last follow-up',
    delayHours: Number(process.env.CAMPAIGN_FREE_2_HOURS) || 5 * 24,
    trigger: 'free_report',
    after: 'free_to_blueprint_1'
  },
  checkout_abandoned: {
    template: 'checkout_abandoned',
    label: 'Started checkout, did not pay',
    delayHours: Number(process.env.CAMPAIGN_ABANDON_HOURS) || 3,
    trigger: 'abandoned_checkout'
  },
  blueprint_to_consultation: {
    template: 'blueprint_to_consultation',
    label: 'Blueprint delivered, suggest a call',
    delayHours: Number(process.env.CAMPAIGN_BLUEPRINT_HOURS) || 3 * 24,
    trigger: 'blueprint_delivered'
  },
  post_call_followup: {
    template: 'post_call_followup',
    label: 'After the consultation',
    delayHours: Number(process.env.CAMPAIGN_POST_CALL_HOURS) || 24,
    trigger: 'call_finished'
  }
};

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Campaigns need Supabase');
  return supabase;
}

function runtimeEnvironment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production' ? 'production' : 'test';
  return process.env.NODE_ENV === 'production' ? 'production' : 'test';
}

/** Every reason this lead must not be messaged right now. Empty means send. */
async function blockers(lead, campaign, environment) {
  const reasons = [];

  if (!lead.marketing_consent) reasons.push('no marketing consent');
  if (lead.marketing_opt_out_at) reasons.push('opted out');
  if (!lead.phone && !lead.email) reasons.push('no contact details');

  const supabase = client();

  const already = await supabase.from('campaign_sends').select('id')
    .eq('environment', environment).eq('lead_id', lead.id).eq('campaign', campaign).maybeSingle();
  if (already.data) reasons.push('already sent');

  const recent = await supabase.from('campaign_sends').select('campaign, sent_at')
    .eq('environment', environment).eq('lead_id', lead.id)
    .gte('sent_at', hoursAgo(QUIET_HOURS)).limit(1);
  if (recent.data && recent.data.length) reasons.push(`another follow-up within ${QUIET_HOURS}h`);

  const spec = CAMPAIGNS[campaign];
  if (spec && spec.after) {
    const prior = await supabase.from('campaign_sends').select('id')
      .eq('environment', environment).eq('lead_id', lead.id).eq('campaign', spec.after).maybeSingle();
    if (!prior.data) reasons.push(`${spec.after} has not been sent yet`);
  }

  return reasons;
}

/**
 * Writes the send down BEFORE sending.
 *
 * The unique index means a second caller gets a duplicate-key error and stops.
 * Recording first costs an occasional row for a message that then failed to
 * send - recoverable, visible in the panel - where recording afterwards risks
 * sending the same promotion twice, which is not recoverable at all.
 */
async function claim({ environment, leadId, campaign }) {
  const supabase = client();
  const { data, error } = await supabase.from('campaign_sends').insert({
    id: id('cmp'), environment, lead_id: leadId, campaign,
    channel: '', status: 'sending', detail: '', sent_at: now()
  }).select().single();

  if (error) {
    // 23505 is the unique index doing its job.
    if (String(error.code) === '23505') return null;
    throw new Error(error.message);
  }
  return data;
}

async function recordOutcome(sendId, { channel, status, detail }) {
  const supabase = client();
  await supabase.from('campaign_sends')
    .update({ channel: channel || '', status, detail: String(detail || '').slice(0, 300) })
    .eq('id', sendId);
}

/** Someone asked to stop. Applies to every campaign, immediately and for good. */
async function optOut({ phone, email, via = 'whatsapp' }) {
  const supabase = client();
  const digits = String(phone || '').replace(/\D/g, '');
  const candidates = await db.getLeads(digits ? { search: digits.slice(-10) } : {});

  const matches = candidates.filter(lead => {
    if (digits) {
      const leadDigits = String(lead.normalized_phone || lead.phone || '').replace(/\D/g, '');
      if (leadDigits.slice(-10) === digits.slice(-10)) return true;
    }
    if (email) {
      return String(lead.normalized_email || lead.email || '').toLowerCase() === String(email).toLowerCase();
    }
    return false;
  });

  for (const lead of matches) {
    await supabase.from('leads').update({
      marketing_consent: false,
      marketing_opt_out_at: now(),
      marketing_opt_out_via: via
    }).eq('id', lead.id);
  }

  return { opted_out: matches.length };
}

/** Leads eligible for one campaign, before the per-lead blockers run. */
async function audience(campaign, environment) {
  const spec = CAMPAIGNS[campaign];
  if (!spec) return [];
  const supabase = client();

  const readyBefore = hoursAgo(spec.delayHours);
  const notOlderThan = hoursAgo(MAX_AGE_HOURS);

  if (spec.trigger === 'free_report' || spec.trigger === 'blueprint_delivered') {
    const wantPaid = spec.trigger === 'blueprint_delivered';
    const reports = await supabase.from('reports')
      .select('id, lead_id, type, status, created_at')
      .eq('status', 'completed')
      .lte('created_at', readyBefore).gte('created_at', notOlderThan)
      .order('created_at', { ascending: false }).limit(200);
    if (reports.error) throw new Error(reports.error.message);

    const rows = (reports.data || []).filter(r => wantPaid
      ? String(r.type || '').includes('paid')
      : String(r.type || '').includes('free'));

    const seen = new Set();
    const leads = [];
    for (const row of rows) {
      if (!row.lead_id || seen.has(row.lead_id)) continue;
      seen.add(row.lead_id);
      const lead = await db.getLead(row.lead_id);
      if (lead) leads.push(lead);
    }
    return leads;
  }

  if (spec.trigger === 'abandoned_checkout') {
    const jobs = await supabase.from('report_jobs')
      .select('id, lead_id, created_at, status')
      .eq('environment', environment).eq('status', 'awaiting_payment')
      .lte('created_at', readyBefore).gte('created_at', notOlderThan).limit(100);
    if (jobs.error) throw new Error(jobs.error.message);

    const leads = [];
    for (const job of jobs.data || []) {
      if (!job.lead_id) continue;
      const lead = await db.getLead(job.lead_id);
      if (lead) leads.push(lead);
    }
    return leads;
  }

  if (spec.trigger === 'call_finished') {
    const appointments = await supabase.from('appointments')
      .select('id, lead_id, ends_at, status')
      .eq('environment', environment).eq('status', 'confirmed')
      .lte('ends_at', readyBefore).gte('ends_at', notOlderThan).limit(100);
    if (appointments.error) throw new Error(appointments.error.message);

    const leads = [];
    for (const appointment of appointments.data || []) {
      if (!appointment.lead_id) continue;
      const lead = await db.getLead(appointment.lead_id);
      if (lead) leads.push(lead);
    }
    return leads;
  }

  return [];
}

/** Has this lead already bought what the campaign is about to suggest? */
async function alreadyConverted(lead, campaign, environment) {
  const supabase = client();

  if (campaign.startsWith('free_to_blueprint') || campaign === 'checkout_abandoned') {
    const paid = await supabase.from('orders').select('id')
      .eq('environment', environment).eq('lead_id', lead.id)
      .eq('product_code', 'paid_blueprint').eq('status', 'paid').limit(1);
    return Boolean(paid.data && paid.data.length);
  }

  if (campaign === 'blueprint_to_consultation') {
    const booked = await supabase.from('appointments').select('id')
      .eq('environment', environment).eq('lead_id', lead.id)
      .in('status', ['pending_payment', 'confirmed']).limit(1);
    return Boolean(booked.data && booked.data.length);
  }

  return false;
}

module.exports = {
  CAMPAIGNS, QUIET_HOURS, MAX_AGE_HOURS, runtimeEnvironment,
  blockers, claim, recordOutcome, optOut, audience, alreadyConverted
};
