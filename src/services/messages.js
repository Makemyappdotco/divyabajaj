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

/**
 * The free report.
 *
 * The landing page has always promised "sent instantly to your email and
 * WhatsApp". It was the highest-volume moment on the site and the only one
 * with a promise attached, and nothing was sending. This is that promise.
 */
function freeReportEmail({ name, reportUrl }) {
  const who = firstName(name);
  return {
    subject: 'Your free numerology reading from Divya Bajaj',
    text: [
      `Hi ${who},`,
      '',
      'Your free numerology reading is ready, and it is attached.',
      '',
      'It covers your ruling number, your destiny path and current life phase,',
      'and one remedy chosen for your numbers.',
      '',
      reportUrl ? `You can also open it here: ${reportUrl}` : '',
      '',
      'If you want the full picture, the Full Blueprint adds your birth chart,',
      'your current Dasha and a 30-day plan. Just reply and Divya will explain.',
      '',
      'Divya Bajaj',
      'Astro-Numerologist'
    ].filter(Boolean).join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
<p style="margin:0 0 18px">Your free numerology reading is ready, and it is attached to this email.</p>
<p style="margin:0 0 18px">It covers your ruling number, your destiny path and current life phase, and one remedy chosen for your numbers.</p>
${reportUrl ? `<p style="margin:0 0 24px"><a href="${escapeHtml(reportUrl)}" style="display:inline-block;background:#B08D4A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">Open your reading</a></p>` : ''}
<p style="margin:0 0 18px;color:#6b6156;font-size:14px">If you want the full picture, the Full Blueprint adds your birth chart, your current Dasha and a 30-day plan. Reply to this email and Divya will explain.</p>
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj<br><span style="font-size:14px">Astro-Numerologist</span></p>
</div>`
  };
}

/**
 * Paid, but the report is held back on purpose - see reportJobs.js for why.
 * This is the only thing the customer hears until it arrives, so it says
 * plainly that the wait is expected rather than a sign anything is wrong.
 */
function paymentReceivedEmail({ name, amountInr }) {
  const who = firstName(name);
  return {
    subject: 'Payment received - your Full Blueprint is being prepared',
    text: [
      `Hi ${who},`,
      '',
      amountInr ? `We have received your payment of ₹${Number(amountInr).toLocaleString('en-IN')}.` : 'We have received your payment.',
      '',
      'Divya is preparing your Full Blueprint personally. You will have it here',
      'and on WhatsApp within the hour.',
      '',
      'You do not need to do anything.',
      '',
      'Divya Bajaj',
      'Astro-Numerologist'
    ].join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
<p style="margin:0 0 18px">${amountInr ? `We have received your payment of &#8377;${Number(amountInr).toLocaleString('en-IN')}.` : 'We have received your payment.'}</p>
<p style="margin:0 0 18px">Divya is preparing your Full Blueprint personally. You will have it here and on WhatsApp within the hour.</p>
<p style="margin:0 0 18px;color:#6b6156">You do not need to do anything.</p>
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj<br><span style="font-size:14px">Astro-Numerologist</span></p>
</div>`
  };
}

/** It could not be built. Said plainly, with the money already on its way back. */
function refundedEmail({ name, amountInr }) {
  const who = firstName(name);
  return {
    subject: 'Your payment has been refunded in full',
    text: [
      `Hi ${who},`,
      '',
      'We could not complete your Full Blueprint, so your payment',
      amountInr ? `of ₹${Number(amountInr).toLocaleString('en-IN')} has been refunded in full.` : 'has been refunded in full.',
      'It should be back with you within a few working days.',
      '',
      'This was our fault, not anything to do with your details.',
      'Reply to this email and Divya will prepare your reading personally.',
      '',
      'Divya Bajaj',
      'Astro-Numerologist'
    ].join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
<p style="margin:0 0 18px">We could not complete your Full Blueprint, so your payment${amountInr ? ` of &#8377;${Number(amountInr).toLocaleString('en-IN')}` : ''} has been refunded in full. It should be back with you within a few working days.</p>
<p style="margin:0 0 18px">This was our fault, not anything to do with your details. Reply to this email and Divya will prepare your reading personally.</p>
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj<br><span style="font-size:14px">Astro-Numerologist</span></p>
</div>`
  };
}

function consultationReminderEmail({ name, startsAt, mode, joinUrl, soon }) {
  const who = firstName(name);
  const when = inIst(startsAt);
  return {
    subject: soon ? 'Your consultation with Divya starts in an hour' : 'Your consultation with Divya is tomorrow',
    text: [
      `Hi ${who},`,
      '',
      soon ? 'Your consultation starts in about an hour.' : 'A reminder that your consultation is tomorrow.',
      '',
      `When: ${when}`,
      `Format: ${mode === 'phone_call' ? 'Phone call' : 'Video call'}`,
      joinUrl ? `Join here: ${joinUrl}` : '',
      '',
      'Have your questions ready. Reply here if you need to move it.',
      '',
      'Divya Bajaj'
    ].filter(Boolean).join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
<p style="margin:0 0 18px">${soon ? 'Your consultation starts in about an hour.' : 'A reminder that your consultation is tomorrow.'}</p>
<p style="margin:0 0 18px"><strong>${escapeHtml(when)}</strong><br>${mode === 'phone_call' ? 'Phone call' : 'Video call'}</p>
${joinUrl ? `<p style="margin:0 0 24px"><a href="${escapeHtml(joinUrl)}" style="display:inline-block;background:#B08D4A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">Join the call</a></p>` : ''}
<p style="margin:0 0 18px;color:#6b6156">Have your questions ready. Reply here if you need to move it.</p>
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj</p>
</div>`
  };
}

function consultationMovedEmail({ name, startsAt, cancelled }) {
  const who = firstName(name);
  return {
    subject: cancelled ? 'Your consultation has been cancelled' : 'Your consultation has been moved',
    text: cancelled
      ? [`Hi ${who},`, '', 'Your consultation has been cancelled and any payment will be returned.',
         'Reply here if you would like to book another time.', '', 'Divya Bajaj'].join('\n')
      : [`Hi ${who},`, '', 'Your consultation has been moved.', '', `New time: ${inIst(startsAt)}`,
         '', 'Reply here if that does not work.', '', 'Divya Bajaj'].join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
${cancelled
  ? '<p style="margin:0 0 18px">Your consultation has been cancelled and any payment will be returned. Reply here if you would like to book another time.</p>'
  : `<p style="margin:0 0 18px">Your consultation has been moved.</p><p style="margin:0 0 18px"><strong>${escapeHtml(inIst(startsAt))}</strong></p><p style="margin:0 0 18px;color:#6b6156">Reply here if that does not work.</p>`}
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj</p>
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

function freeReportWhatsapp({ name }) {
  // free_report_ready:  "Hi {{1}}, your free numerology reading is ready..."
  //
  // Confirmed with Uomox support (2026-09-14), against a real failing send:
  // this template has no document-header component, and its "View Report"
  // button is a FIXED link baked into the approved template, not a dynamic
  // one - Uomox's own working example for it sends no media and no button at
  // all, just two plain body variables. The guessed shape this used to send
  // (a document header plus a per-customer dynamic button) is what every
  // real free-report WhatsApp send was failing on, with (#131008) Required
  // parameter is missing, every single time.
  //
  // KNOWN LIMITATION, not fixed by this change: because the button's link is
  // fixed, every customer sees the same "View Report" link right now, not
  // their own report. Fixing that needs the template itself rebuilt with a
  // dynamic button and resubmitted to Meta - tracked separately, on purpose,
  // so today's fix is only the part that is actually confirmed.
  return { body: [firstName(name), 'Divya-Bajaj-Numerology-Reading.pdf'] };
}

function paymentReceivedWhatsapp({ name, amountInr }) {
  // payment_received:  "Hi {{1}}, we have received your payment of {{2}}..."
  return { body: [firstName(name), `₹${Number(amountInr || 0).toLocaleString('en-IN')}`] };
}

function refundedWhatsapp({ name, amountInr }) {
  // blueprint_refunded:  "Hi {{1}}, ... refunded {{2}} in full..."
  return { body: [firstName(name), `₹${Number(amountInr || 0).toLocaleString('en-IN')}`] };
}

function consultationReminderWhatsapp({ name, startsAt, soon }) {
  // consultation_reminder_day / consultation_reminder_hour
  return { body: [firstName(name), inIst(startsAt)], soon: Boolean(soon) };
}

function consultationMovedWhatsapp({ name, startsAt, cancelled }) {
  // consultation_moved / consultation_cancelled
  return cancelled
    ? { body: [firstName(name)] }
    : { body: [firstName(name), inIst(startsAt)] };
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

// ------------------------------------------------------------- follow-ups

/**
 * The only messages here that the customer did not ask for.
 *
 * Written to be worth receiving on their own: each one says something useful
 * or asks a real question, and mentions the paid thing once, at the end. A
 * follow-up that is only a sales pitch gets reported as spam, and on WhatsApp
 * enough reports take the business number down - so restraint here is not
 * only taste, it is what keeps the channel working.
 */
const CAMPAIGN_COPY = {
  free_to_blueprint_1: {
    subject: 'Did your reading make sense?',
    opening: 'I hope your free reading made sense.',
    body: 'A free reading works from your name and date of birth alone. It cannot see your birth chart, your current Dasha, or the timing of what is coming - and timing is usually the part people actually need.',
    close: 'The Full Blueprint covers all three. If you have a question about your reading in the meantime, just reply here.'
  },
  free_to_blueprint_2: {
    subject: 'One more thing about your reading',
    opening: 'A last note about the reading you got.',
    body: 'The question you asked is the kind that usually depends on timing - which planetary period you are in, and how long it lasts. That needs your birth time and place, not just your date.',
    close: 'That is what the Full Blueprint adds. This is the last message you will get about it.'
  },
  checkout_abandoned: {
    subject: 'Your Full Blueprint is still waiting',
    opening: 'You started ordering a Full Blueprint and did not finish.',
    body: 'Nothing was charged, and your birth details are still saved, so picking it up takes a moment rather than starting again.',
    close: 'If something went wrong at the payment step, reply here and Divya will sort it out personally.'
  },
  blueprint_to_consultation: {
    subject: 'Any questions on your blueprint?',
    opening: 'I hope you have had a chance to read your blueprint.',
    body: 'Most people finish it with one specific question left over - whether to take the offer, when to start, how to read a particular period. A written report cannot go back and forth with you on that.',
    close: 'A one-to-one call can. Or reply here and Divya will answer what she can in writing.'
  },
  post_call_followup: {
    subject: 'How did your consultation go?',
    opening: 'I hope your call with Divya was useful.',
    body: 'If anything from it has become clearer, or harder, since you spoke, she would genuinely like to know.',
    close: 'Reply here whenever you want to pick the thread back up.'
  }
};

function campaignEmail(campaign, lead) {
  const copy = CAMPAIGN_COPY[campaign];
  if (!copy) throw new Error(`Unknown campaign: ${campaign}`);
  const who = firstName(lead && lead.name);

  return {
    subject: copy.subject,
    text: [
      `Hi ${who},`, '', copy.opening, '', copy.body, '', copy.close, '',
      'Divya Bajaj', 'Astro-Numerologist', '',
      'To stop these follow-ups, just reply STOP.'
    ].join('\n'),
    html: `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2520;max-width:34rem;margin:0 auto;padding:24px">
<p style="margin:0 0 18px">Hi ${escapeHtml(who)},</p>
<p style="margin:0 0 18px">${escapeHtml(copy.opening)}</p>
<p style="margin:0 0 18px">${escapeHtml(copy.body)}</p>
<p style="margin:0 0 18px">${escapeHtml(copy.close)}</p>
<p style="margin:24px 0 0;color:#6b6156">Divya Bajaj<br><span style="font-size:14px">Astro-Numerologist</span></p>
<p style="margin:22px 0 0;color:#9a9084;font-size:12px">To stop these follow-ups, just reply STOP.</p>
</div>`
  };
}

/** Only the blanks. The body is fixed by whatever Meta approved. */
function campaignWhatsapp(campaign, lead) {
  if (!CAMPAIGN_COPY[campaign]) throw new Error(`Unknown campaign: ${campaign}`);
  return { body: [firstName(lead && lead.name)] };
}

module.exports = {
  CAMPAIGN_COPY, campaignEmail, campaignWhatsapp,
  // email
  reportReadyEmail, freeReportEmail, paymentReceivedEmail, refundedEmail,
  consultationConfirmedEmail, consultationReminderEmail, consultationMovedEmail,
  ownerAlertEmail,
  // whatsapp template variables
  reportReadyWhatsapp, freeReportWhatsapp, paymentReceivedWhatsapp, refundedWhatsapp,
  consultationConfirmedWhatsapp, consultationReminderWhatsapp, consultationMovedWhatsapp,
  ownerAlertWhatsapp,
  inIst, firstName
};
