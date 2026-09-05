// Getting a finished report to the customer, over WhatsApp and email.
//
// NEITHER CHANNEL IS WIRED YET. Uomox has not given us an API key and there is
// no email provider on the account, so every send currently returns
// { sent: false, reason: 'not_configured' }.
//
// That is the point of this module existing before either provider does. The
// rest of the system needs one honest answer to "can we message this person",
// because the customer-facing copy depends on it: a page that says "you can
// close this, it will reach your WhatsApp" when nothing can send is a lie that
// costs someone their report. isConfigured() is what that copy is driven from.
//
// When the keys arrive, fill in sendWhatsApp/sendEmail below. Nothing else in
// the codebase has to change.

const crypto = require('crypto');
const db = require('../database');

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

// --------------------------------------------------------------- providers

function whatsappConfigured() {
  return Boolean(process.env.UOMOX_API_KEY && process.env.UOMOX_SENDER);
}

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/** Whether ANY channel can actually deliver. Drives what the customer is told. */
function isConfigured() {
  return whatsappConfigured() || emailConfigured();
}

function channels() {
  return {
    whatsapp: whatsappConfigured(),
    email: emailConfigured()
  };
}

/**
 * Uomox. Placeholder until the API key and the endpoint shape are known -
 * deliberately not guessed, because a wrong request shape that returns 200
 * looks exactly like a working integration until a customer says they got
 * nothing.
 */
async function sendWhatsApp({ to, name, reportUrl }) {
  if (!whatsappConfigured()) return { sent: false, reason: 'not_configured' };
  throw new Error('Uomox transport is not implemented yet');
}

async function sendEmail({ to, name, subject, reportUrl }) {
  if (!emailConfigured()) return { sent: false, reason: 'not_configured' };
  throw new Error('Email transport is not implemented yet');
}

// ----------------------------------------------------------------- logging

/**
 * Every attempt is recorded, successes and skips alike, so Divya's panel can
 * show exactly who is still owed a message rather than inferring it.
 */
async function record({ environment, jobId, channel, to, status, detail }) {
  const supabase = db.getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.from('delivery_attempts').insert({
      id: id('dlv'),
      environment: environment || 'test',
      job_id: jobId || '',
      channel,
      recipient: to || '',
      status,
      detail: String(detail || '').slice(0, 500),
      created_at: now()
    });
  } catch (error) {
    // Never let bookkeeping fail a delivery, or a report the customer paid for.
    console.error('[delivery] could not record attempt:', error.message);
  }
}

/**
 * Send a finished report on every channel we have a provider for.
 *
 * Never throws. A delivery problem must not roll back a report that was
 * successfully generated and paid for; it is recorded and surfaced instead.
 */
async function deliverReport({ environment, jobId, name, email, phone, reportUrl }) {
  const result = { attempted: false, whatsapp: null, email: null };

  if (!isConfigured()) {
    await record({ environment, jobId, channel: 'none', to: email || phone, status: 'skipped', detail: 'no provider configured' });
    return Object.assign(result, { reason: 'not_configured' });
  }

  result.attempted = true;

  if (whatsappConfigured() && phone) {
    try {
      result.whatsapp = await sendWhatsApp({ to: phone, name, reportUrl });
      await record({ environment, jobId, channel: 'whatsapp', to: phone, status: result.whatsapp.sent ? 'sent' : 'skipped', detail: result.whatsapp.reason });
    } catch (error) {
      result.whatsapp = { sent: false, reason: error.message };
      await record({ environment, jobId, channel: 'whatsapp', to: phone, status: 'failed', detail: error.message });
    }
  }

  if (emailConfigured() && email) {
    try {
      result.email = await sendEmail({ to: email, name, subject: 'Your Full Blueprint from Divya Bajaj', reportUrl });
      await record({ environment, jobId, channel: 'email', to: email, status: result.email.sent ? 'sent' : 'skipped', detail: result.email.reason });
    } catch (error) {
      result.email = { sent: false, reason: error.message };
      await record({ environment, jobId, channel: 'email', to: email, status: 'failed', detail: error.message });
    }
  }

  return result;
}

module.exports = { isConfigured, channels, deliverReport, whatsappConfigured, emailConfigured };
