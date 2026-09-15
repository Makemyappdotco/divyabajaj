// Getting things to the customer, and to Divya.
//
// Two transports underneath (Uomox for WhatsApp, Resend for email), one set of
// message definitions beside it, and this file to decide who gets what.
//
// Nothing here ever throws at its caller. A report that was generated and paid
// for must not be rolled back because a message failed to send; the failure is
// recorded, surfaced in the panel, and the report stays delivered by every
// other means. That is also why every attempt is logged including the skips -
// "nobody was told" has to be visible, not inferred.

const crypto = require('crypto');
const db = require('../database');
const whatsapp = require('./transports/whatsapp');
const email = require('./transports/email');
const messages = require('./messages');
const reportLinks = require('./reportLinks');

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

function ownerPhone() { return process.env.OWNER_WHATSAPP || process.env.CONTACT_WHATSAPP || ''; }
function ownerEmail() { return process.env.OWNER_EMAIL || ''; }

function whatsappConfigured() { return whatsapp.isConfigured(); }
function emailConfigured() { return email.isConfigured(); }

/** Whether ANY channel can deliver. Drives what the customer is promised. */
function isConfigured() { return whatsappConfigured() || emailConfigured(); }

function channels() {
  return {
    whatsapp: whatsappConfigured(),
    email: emailConfigured(),
    // True while Resend is still on its shared sender, which only delivers to
    // the account owner. Looks configured, cannot reach a customer.
    email_sandbox: emailConfigured() && email.isSandboxSender()
  };
}

async function record({ environment, jobId, channel, to, status, detail }) {
  const supabase = db.getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.from('delivery_attempts').insert({
      id: id('dlv'),
      environment: environment || 'test',
      job_id: jobId || '',
      channel,
      recipient: String(to || '').slice(0, 120),
      status,
      detail: String(detail || '').slice(0, 500),
      created_at: now()
    });
  } catch (error) {
    console.error('[delivery] could not record attempt:', error.message);
  }
}

/** Runs one send, catches everything, and writes down what happened. */
async function attempt({ environment, jobId, channel, to, run }) {
  if (!to) {
    await record({ environment, jobId, channel, to, status: 'skipped', detail: 'no recipient' });
    return { sent: false, reason: 'no recipient' };
  }
  try {
    const result = await run();
    await record({
      environment, jobId, channel, to,
      status: result.sent ? 'sent' : 'skipped',
      detail: result.sent ? (result.id || '') : (result.reason || '')
    });
    return result;
  } catch (error) {
    // error.message alone hides WHY - a WhatsApp BSP's rejection reason lives
    // in the raw body (error.provider), which used to be thrown away here.
    // Keeping it is what let a guessed request shape (see uomoxBody() in
    // transports/whatsapp.js) actually get diagnosed instead of re-guessed.
    const raw = error.provider ? ` | provider: ${JSON.stringify(error.provider)}` : '';
    await record({ environment, jobId, channel, to, status: 'failed', detail: error.message + raw });
    console.error(`[delivery:${channel}]`, error.message, error.provider || '');
    return { sent: false, reason: error.message };
  }
}

// ------------------------------------------------------------ the report

/**
 * The finished blueprint, to the customer, on every channel we have.
 *
 * @param {Buffer} [pdf] attached to the email when present. WhatsApp always
 * gets a link instead - it cannot carry a file of its own.
 */
async function deliverReport({ environment, jobId, reportId, name, email: to, phone, pdf }) {
  const result = { attempted: false, whatsapp: null, email: null };

  if (!isConfigured()) {
    await record({ environment, jobId, channel: 'none', to: to || phone, status: 'skipped', detail: 'no provider configured' });
    return Object.assign(result, { reason: 'not_configured' });
  }
  result.attempted = true;

  // One link, both channels, minted once so they cannot disagree.
  let link = '';
  let linkToken = '';
  try {
    if (reportId) {
      linkToken = reportLinks.token(reportId);
      link = `${reportLinks.siteUrl()}/r/${linkToken}`;
    }
  } catch (error) {
    // Signing is not configured. The email can still carry the attachment.
    console.error('[delivery] could not mint a report link:', error.message);
  }

  if (whatsappConfigured()) {
    const vars = messages.reportReadyWhatsapp({ name, reportToken: linkToken });
    // No document header here - blueprint_ready has none (confirmed by
    // reading the template's own setup in Uomox), whatever its body text
    // says. It DOES have a static image header (the "Your Full Blueprint Is
    // Ready" banner), same requirement as the free report - resend on every
    // message or the send fails. The button link travels as the second body
    // value; see the long comment on reportReadyWhatsapp() in messages.js
    // for why. The SAME /r/ link used for the button is also what the email
    // points at, minted once above so the two channels cannot disagree.
    result.whatsapp = await attempt({
      environment, jobId, channel: 'whatsapp', to: phone,
      run: () => whatsapp.send({
        to: phone,
        template: whatsapp.templateName('report_ready'),
        bodyParams: vars.body,
        imageUrl: `${reportLinks.siteUrl()}/whatsapp/blueprint-ready.png`
      })
    });
  }

  if (emailConfigured()) {
    const mail = messages.reportReadyEmail({ name, reportUrl: link });
    result.email = await attempt({
      environment, jobId, channel: 'email', to,
      run: () => email.send({
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachment: pdf ? { filename: 'Divya-Bajaj-Full-Blueprint.pdf', content: pdf } : null
      })
    });
  }

  result.delivered = Boolean((result.whatsapp && result.whatsapp.sent) || (result.email && result.email.sent));
  return result;
}

/**
 * The free reading.
 *
 * The landing page has promised "sent instantly to your email and WhatsApp"
 * since launch, and nothing was sending. This is the highest-volume moment on
 * the site, so it is also the one where a silent failure costs most.
 */
async function deliverFreeReport({ environment, reportId, name, email: to, phone, pdf }) {
  const result = { attempted: false, whatsapp: null, email: null };
  if (!isConfigured()) return Object.assign(result, { reason: 'not_configured' });
  result.attempted = true;

  let link = '';
  let linkToken = '';
  try {
    if (reportId) {
      linkToken = reportLinks.token(reportId);
      link = `${reportLinks.siteUrl()}/r/${linkToken}`;
    }
  } catch (error) {
    console.error('[delivery] could not mint a free report link:', error.message);
  }

  if (whatsappConfigured()) {
    const vars = messages.freeReportWhatsapp({ name, reportToken: linkToken });
    // No document header here - this template does not carry the PDF
    // itself. It DOES carry a static image header though (the "Your Free
    // Reading Is Ready" banner Divya's team uploaded when the template was
    // approved), which is why every send has to resend that same image -
    // WhatsApp never stores it against the template for reuse, so leaving
    // this out is what was producing the "Media upload error" customers saw.
    // The button link travels as the second body value; see the long
    // comment on freeReportWhatsapp() in messages.js for why.
    result.whatsapp = await attempt({
      environment, jobId: reportId, channel: 'whatsapp', to: phone,
      run: () => whatsapp.send({
        to: phone,
        template: whatsapp.templateName('free_report_ready'),
        bodyParams: vars.body,
        imageUrl: `${reportLinks.siteUrl()}/whatsapp/free-report-ready.png`
      })
    });
  }

  if (emailConfigured()) {
    const mail = messages.freeReportEmail({ name, reportUrl: link });
    result.email = await attempt({
      environment, jobId: reportId, channel: 'email', to,
      run: () => email.send({
        to, subject: mail.subject, text: mail.text, html: mail.html,
        attachment: pdf ? { filename: 'Divya-Bajaj-Numerology-Reading.pdf', content: pdf } : null
      })
    });
  }

  result.delivered = Boolean((result.whatsapp && result.whatsapp.sent) || (result.email && result.email.sent));
  return result;
}

/**
 * Paid, but the report takes minutes to write.
 *
 * Without this the customer pays and hears nothing until the report lands,
 * which is the window where people assume it failed and pay again or complain.
 */
async function notifyPaymentReceived({ environment, jobId, name, email: to, phone, amountInr }) {
  const result = { whatsapp: null, email: null };
  if (!isConfigured()) return result;

  if (whatsappConfigured()) {
    const vars = messages.paymentReceivedWhatsapp({ name, amountInr });
    result.whatsapp = await attempt({
      environment, jobId, channel: 'whatsapp', to: phone,
      run: () => whatsapp.send({
        to: phone, template: whatsapp.templateName('payment_received'), bodyParams: vars.body,
        imageUrl: `${reportLinks.siteUrl()}/whatsapp/payment-received.png`
      })
    });
  }
  if (emailConfigured()) {
    const mail = messages.paymentReceivedEmail({ name, amountInr });
    result.email = await attempt({
      environment, jobId, channel: 'email', to,
      run: () => email.send({ to, subject: mail.subject, text: mail.text, html: mail.html })
    });
  }
  return result;
}

/** The money is going back. Nobody should learn that from a bank statement. */
async function notifyRefunded({ environment, jobId, name, email: to, phone, amountInr }) {
  const result = { whatsapp: null, email: null };
  if (!isConfigured()) return result;

  if (whatsappConfigured()) {
    const vars = messages.refundedWhatsapp({ name, amountInr });
    result.whatsapp = await attempt({
      environment, jobId, channel: 'whatsapp', to: phone,
      run: () => whatsapp.send({
        to: phone, template: whatsapp.templateName('refunded'), bodyParams: vars.body,
        imageUrl: `${reportLinks.siteUrl()}/whatsapp/refunded.png`
      })
    });
  }
  if (emailConfigured()) {
    const mail = messages.refundedEmail({ name, amountInr });
    result.email = await attempt({
      environment, jobId, channel: 'email', to,
      run: () => email.send({ to, subject: mail.subject, text: mail.text, html: mail.html })
    });
  }
  return result;
}

// ------------------------------------------------------- the consultation

async function deliverBookingConfirmation({ environment, appointmentId, name, email: to, phone, startsAt, mode }) {
  const result = { attempted: false, whatsapp: null, email: null };
  if (!isConfigured()) return Object.assign(result, { reason: 'not_configured' });
  result.attempted = true;

  if (whatsappConfigured()) {
    const vars = messages.consultationConfirmedWhatsapp({ name, startsAt });
    result.whatsapp = await attempt({
      environment, jobId: appointmentId, channel: 'whatsapp', to: phone,
      run: () => whatsapp.send({
        to: phone,
        template: whatsapp.templateName('consultation_confirmed'),
        bodyParams: vars.body,
        imageUrl: `${reportLinks.siteUrl()}/whatsapp/consultation-confirmed.png`
      })
    });
  }

  if (emailConfigured()) {
    const mail = messages.consultationConfirmedEmail({ name, startsAt, mode });
    result.email = await attempt({
      environment, jobId: appointmentId, channel: 'email', to,
      run: () => email.send({ to, subject: mail.subject, text: mail.text, html: mail.html })
    });
  }

  result.delivered = Boolean((result.whatsapp && result.whatsapp.sent) || (result.email && result.email.sent));
  return result;
}

/**
 * Sent when Divya cancels a booked consultation from the panel.
 *
 * The message content (consultationMovedWhatsapp/Email with cancelled: true)
 * already existed in messages.js, written for this exact template pair, but
 * nothing ever called it - the admin cancel route only updated the database
 * row. A cancelled booking with no word to the customer is worse than no
 * cancel button at all, so this is not optional the way a marketing
 * follow-up is: it always attempts, like the confirmation does.
 */
async function deliverConsultationCancelled({ environment, appointmentId, name, email: to, phone }) {
  const result = { attempted: false, whatsapp: null, email: null };
  if (!isConfigured()) return Object.assign(result, { reason: 'not_configured' });
  result.attempted = true;

  if (whatsappConfigured()) {
    const vars = messages.consultationMovedWhatsapp({ name, cancelled: true });
    result.whatsapp = await attempt({
      environment, jobId: appointmentId, channel: 'whatsapp', to: phone,
      run: () => whatsapp.send({
        to: phone,
        template: whatsapp.templateName('consultation_cancelled'),
        bodyParams: vars.body
      })
    });
  }

  if (emailConfigured()) {
    const mail = messages.consultationMovedEmail({ name, cancelled: true });
    result.email = await attempt({
      environment, jobId: appointmentId, channel: 'email', to,
      run: () => email.send({ to, subject: mail.subject, text: mail.text, html: mail.html })
    });
  }

  result.delivered = Boolean((result.whatsapp && result.whatsapp.sent) || (result.email && result.email.sent));
  return result;
}

/** Sent when Divya moves a booked consultation to a new time. Same gap as
 * deliverConsultationCancelled above - the message content already existed,
 * nothing ever called it. */
async function deliverConsultationMoved({ environment, appointmentId, name, email: to, phone, startsAt }) {
  const result = { attempted: false, whatsapp: null, email: null };
  if (!isConfigured()) return Object.assign(result, { reason: 'not_configured' });
  result.attempted = true;

  if (whatsappConfigured()) {
    const vars = messages.consultationMovedWhatsapp({ name, startsAt, cancelled: false });
    result.whatsapp = await attempt({
      environment, jobId: appointmentId, channel: 'whatsapp', to: phone,
      run: () => whatsapp.send({
        to: phone,
        template: whatsapp.templateName('consultation_moved'),
        bodyParams: vars.body
      })
    });
  }

  if (emailConfigured()) {
    const mail = messages.consultationMovedEmail({ name, startsAt, cancelled: false });
    result.email = await attempt({
      environment, jobId: appointmentId, channel: 'email', to,
      run: () => email.send({ to, subject: mail.subject, text: mail.text, html: mail.html })
    });
  }

  result.delivered = Boolean((result.whatsapp && result.whatsapp.sent) || (result.email && result.email.sent));
  return result;
}

// -------------------------------------------------------------- to Divya

/**
 * Divya's heads-up.
 *
 * Deliberately separate from the customer's message and deliberately
 * best-effort: this is a convenience so she does not have to watch the panel,
 * never the thing a customer depends on. Her WhatsApp copy is written as free
 * text, which was written for a generic Cloud-API-shaped provider that allows
 * free text inside a 24-hour reply window. Uomox (the provider actually in
 * use) has no free-text send at all, ever - only approved templates, on both
 * customer and owner sends alike - so this WhatsApp attempt will record as
 * "skipped" until an approved owner-alert template exists. The email below is
 * not a fallback for the 24-hour window; today it is the only channel that
 * actually reaches her.
 */
async function notifyOwner({ environment, event, name, phone, email: customerEmail, question, startsAt, amountInr }) {
  const result = { whatsapp: null, email: null };

  if (whatsappConfigured() && ownerPhone()) {
    result.whatsapp = await attempt({
      environment, jobId: `owner:${event}`, channel: 'whatsapp-owner', to: ownerPhone(),
      run: () => whatsapp.send({
        to: ownerPhone(),
        text: messages.ownerAlertWhatsapp({ event, name, phone, question, startsAt, amountInr })
      })
    });
  }

  if (emailConfigured() && ownerEmail()) {
    const mail = messages.ownerAlertEmail({ event, name, phone, email: customerEmail, question, startsAt, amountInr });
    result.email = await attempt({
      environment, jobId: `owner:${event}`, channel: 'email-owner', to: ownerEmail(),
      run: () => email.send({ to: ownerEmail(), subject: mail.subject, text: mail.text, html: mail.html })
    });
  }

  return result;
}

module.exports = {
  isConfigured, channels, whatsappConfigured, emailConfigured,
  deliverReport, deliverFreeReport, deliverBookingConfirmation,
  deliverConsultationCancelled, deliverConsultationMoved,
  notifyPaymentReceived, notifyRefunded, notifyOwner,
  ownerPhone, ownerEmail
};
