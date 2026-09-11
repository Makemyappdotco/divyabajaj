// What each message actually says.
//
// Kept away from the transports on purpose. The wording of "your report is
// ready" should not be buried inside an HTTP call, and Divya will want to
// change it without anyone touching Uomox or Resend.
//
// WhatsApp wording lives here too, but only as the variables that fill an
// approved template - Meta will not let a business send free text to someone
// who has not messaged first, so the body itself is fixed at approval time and
// all we supply is the blanks.

function inIst(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true
  }) + ' IST';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

// ------------------------------------------------------------------- email

/**
 * Plain and HTML together. Some mail clients, and every spam filter, want a
 * text part; sending HTML alone is a reliable way into the junk folder.
 */
function reportReadyEmail({ name, reportUrl }) {
  const who = firstName(name);
  return {
    subject: 'Your Full Blueprint from Divya Bajaj',
    text: [
      `Hi ${who},`,
      '',
      'Your Full Blueprint is ready, and it is attached to this email.',
      '',
      'It covers your birth chart and key planetary patterns, your current Dasha,',
      'guidance on career, money and relationships, and a 30-day action plan.',
      '',
      reportUrl ? `You can also download it here: ${reportUrl}` : '',
      reportUrl ? 'That link works for 30 days.' : '',
      '',
      'If anything in it raises a question, reply to this email and Divya will answer.',
      '',
      'Divya Bajaj',
      'Astro-Numerologist'
    ].filter(Boolean).join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
<p style="margin:0 0 18px">Your Full Blueprint is ready, and it is attached to this email.</p>
<p style="margin:0 0 18px">It covers your birth chart and key planetary patterns, your current Dasha, guidance on career, money and relationships, and a 30-day action plan.</p>
${reportUrl ? `<p style="margin:0 0 24px"><a href="${escapeHtml(reportUrl)}" style="display:inline-block;background:#B08D4A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">Download your blueprint</a></p>
<p style="margin:0 0 18px;color:#6b6156;font-size:14px">That link works for 30 days.</p>` : ''}
<p style="margin:0 0 18px">If anything in it raises a question, reply to this email and Divya will answer.</p>
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj<br><span style="font-size:14px">Astro-Numerologist</span></p>
</div>`
  };
}

function consultationConfirmedEmail({ name, startsAt, mode }) {
  const who = firstName(name);
  const when = inIst(startsAt);
  return {
    subject: 'Your consultation with Divya Bajaj is confirmed',
    text: [
      `Hi ${who},`,
      '',
      'Your private consultation is confirmed.',
      '',
      `When: ${when}`,
      'Duration: 60 minutes',
      `Format: ${mode === 'phone_call' ? 'Phone call' : 'Video call'}`,
      '',
      'You will get the joining details before the call.',
      'Reply to this email if you need to move it.',
      '',
      'Divya Bajaj',
      'Astro-Numerologist'
    ].join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
<p style="margin:0 0 18px">Your private consultation is confirmed.</p>
<table style="margin:0 0 18px;border-collapse:collapse">
<tr><td style="padding:4px 18px 4px 0;color:#6b6156">When</td><td style="padding:4px 0;font-weight:600">${escapeHtml(when)}</td></tr>
<tr><td style="padding:4px 18px 4px 0;color:#6b6156">Duration</td><td style="padding:4px 0">60 minutes</td></tr>
<tr><td style="padding:4px 18px 4px 0;color:#6b6156">Format</td><td style="padding:4px 0">${mode === 'phone_call' ? 'Phone call' : 'Video call'}</td></tr>
</table>
<p style="margin:0 0 18px">You will get the joining details before the call. Reply to this email if you need to move it.</p>
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj<br><span style="font-size:14px">Astro-Numerologist</span></p>
</div>`
  };
}

/** Divya's own copy. Everything she needs to act, nothing she has to look up. */
function ownerAlertEmail({ event, name, phone, email, question, startsAt, amountInr }) {
  const isBooking = event === 'consultation';
  const lines = [
    isBooking ? 'A consultation has just been booked and paid for.' : 'Someone has just paid for a Full Blueprint.',
    '',
    `Name: ${name || '-'}`,
    `WhatsApp: ${phone || '-'}`,
    `Email: ${email || '-'}`,
    amountInr ? `Paid: ₹${Number(amountInr).toLocaleString('en-IN')}` : '',
    isBooking && startsAt ? `Call: ${inIst(startsAt)}` : '',
    question ? `They asked about: ${question}` : ''
  ].filter(Boolean);

  return {
    subject: isBooking ? `New consultation booked - ${name || 'customer'}` : `Blueprint sold - ${name || 'customer'}`,
    text: lines.join('\n'),
    html: `<div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:30rem;padding:20px">
${lines.map(line => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`).join('')}
</div>`
  };
}

// ---------------------------------------------------------------- whatsapp

/**
 * The variables for an approved template, in the order Meta numbered them.
 *
 * The template body is fixed at approval time and lives in the Uomox
 * dashboard, not here. Changing the wording means submitting a new template
 * and waiting for approval, which is exactly why these are kept short.
 */
function reportReadyWhatsapp({ name, reportToken }) {
  return {
    // blueprint_ready:  "Hi {{1}}, your Full Blueprint is ready..."
    body: [firstName(name)],
    // The button is a dynamic URL: base https://divyabajaj.com/r/ plus this.
    buttonUrlSuffix: reportToken || ''
  };
}

function consultationConfirmedWhatsapp({ name, startsAt }) {
  return {
    // consultation_confirmed:  "Hi {{1}}, ... When: {{2}}"
    body: [firstName(name), inIst(startsAt)]
  };
}

/**
 * Divya's heads-up, as free text.
 *
 * Allowed without a template only because she will have messaged her own
 * business number at some point, which opens the 24-hour window. If she has
 * not, this silently fails and the panel is still the source of truth - which
 * is why it is never what a customer depends on.
 */
function ownerAlertWhatsapp({ event, name, phone, question, startsAt, amountInr }) {
  const isBooking = event === 'consultation';
  return [
    isBooking ? '📅 New consultation booked' : '✅ Blueprint sold',
    '',
    `${name || 'Customer'}  ${phone || ''}`.trim(),
    amountInr ? `₹${Number(amountInr).toLocaleString('en-IN')}` : '',
    isBooking && startsAt ? inIst(startsAt) : '',
    question ? `"${String(question).slice(0, 120)}"` : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  reportReadyEmail, consultationConfirmedEmail, ownerAlertEmail,
  reportReadyWhatsapp, consultationConfirmedWhatsapp, ownerAlertWhatsapp,
  inIst, firstName
};
