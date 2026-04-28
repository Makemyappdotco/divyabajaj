const API_KEY = process.env.WHATSAPP_API_KEY;
const API_URL = process.env.WHATSAPP_API_URL;
const MOCK = !API_KEY || !API_URL;

async function sendMessage(phone, message, meta = {}) {
  if (MOCK) {
    console.log('[WhatsApp mock]', {
      phone,
      message: message.slice(0, 120),
      meta
    });
    return { success: true, mock: true };
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      'x-api-key': API_KEY
    },
    body: JSON.stringify({ phone, message, meta })
  });

  if (!response.ok) {
    throw new Error(`WhatsApp API failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function cleanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendFreeReport(phone, name, reportText) {
  const message = `Namaste ${name}, your free Awareness Report is ready.\n\n${reportText}\n\nThis is your first snapshot. For deeper clarity, you can upgrade to a detailed report.`;
  return sendMessage(cleanPhone(phone), message, { type: 'free_report' });
}

async function sendPaidReport(phone, name, tier, reportText) {
  const message = `Namaste ${name}, your ${tier} report is ready.\n\n${reportText}\n\nFor personal guidance, you can book a one-to-one consultation with Divya Bajaj.`;
  return sendMessage(cleanPhone(phone), message, { type: 'paid_report', tier });
}

async function sendPaymentConfirm(phone, name, amount, tier) {
  const message = `Namaste ${name}, payment of ₹${amount} for ${tier} has been received. We are preparing your report now.`;
  return sendMessage(cleanPhone(phone), message, { type: 'payment_confirmation', amount, tier });
}

async function sendBookingConfirm(phone, name, date, timeSlot, mode) {
  const message = `Namaste ${name}, your consultation is confirmed for ${date} at ${timeSlot}. Mode: ${mode || 'online'}.`;
  return sendMessage(cleanPhone(phone), message, { type: 'booking_confirmation', date, timeSlot, mode });
}

async function sendFollowUp(phone, name, insightText) {
  const message = `Hi ${name}, did your free report feel relatable?\n\n${insightText}\n\nThe free report only covers the first layer. Reply DEEP if you want the detailed report.`;
  return sendMessage(cleanPhone(phone), message, { type: 'upsell_followup' });
}

module.exports = {
  sendMessage,
  sendFreeReport,
  sendPaidReport,
  sendPaymentConfirm,
  sendBookingConfirm,
  sendFollowUp,
  MOCK
};
