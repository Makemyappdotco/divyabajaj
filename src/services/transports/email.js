// Email, through Resend.
//
// No SDK: one HTTP call, and this deploys to serverless where every dependency
// is cold-start weight.
//
// Resend needs divyabajaj.com verified by DNS before it will send as
// hello@divyabajaj.com. Until then MAIL_FROM has to be onboarding@resend.dev,
// which only delivers to the account owner's own address - useful for a test,
// useless for customers. isConfigured() cannot tell those apart, so the panel
// reports the from-address and lets a human notice.

const API = 'https://api.resend.com/emails';

function apiKey() { return process.env.RESEND_API_KEY || ''; }
function from() { return process.env.MAIL_FROM || ''; }
function replyTo() { return process.env.MAIL_REPLY_TO || ''; }

function isConfigured() { return Boolean(apiKey() && from()); }

/** True while still on Resend's shared sender, which cannot reach customers. */
function isSandboxSender() {
  return /@resend\.dev>?\s*$/i.test(from());
}

/**
 * @param {Buffer} [attachment.content] the PDF itself. Attached rather than
 * only linked, because an attachment survives the link expiring and arrives
 * even when someone opens the mail offline.
 */
async function send({ to, subject, text, html, attachment }) {
  if (!isConfigured()) return { sent: false, reason: 'not_configured' };
  if (!to) return { sent: false, reason: 'no recipient' };

  const body = {
    from: from(),
    to: [to],
    subject,
    text,
    html
  };
  if (replyTo()) body.reply_to = replyTo();
  if (attachment && attachment.content) {
    body.attachments = [{
      filename: attachment.filename || 'report.pdf',
      content: Buffer.from(attachment.content).toString('base64')
    }];
  }

  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify(body)
  });

  const raw = await response.text();
  let payload;
  try { payload = raw ? JSON.parse(raw) : {}; } catch (e) { payload = { raw }; }

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `Resend refused the message (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return { sent: true, id: payload.id || '' };
}

/** Does the key work? Used by the panel so "not arriving" has an answer. */
async function ping() {
  if (!apiKey()) throw Object.assign(new Error('No Resend API key is set'), { status: 0 });
  const response = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey()}` }
  });
  if (!response.ok) {
    const error = new Error(response.status === 401
      ? 'Resend rejected the API key'
      : `Resend answered ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  return { domains: (payload.data || []).map(d => ({ name: d.name, status: d.status })) };
}

module.exports = { send, ping, isConfigured, isSandboxSender, from };
