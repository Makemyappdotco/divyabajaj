const crypto = require('crypto');

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const MOCK = !KEY_ID || !KEY_SECRET;

async function createOrder(amount, currency = 'INR', receipt = '', notes = {}) {
  if (MOCK) {
    return {
      id: `order_mock_${Date.now()}`,
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt,
      notes,
      status: 'created',
      mock: true
    };
  }

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`
    },
    body: JSON.stringify({ amount: Math.round(Number(amount) * 100), currency, receipt, notes })
  });

  if (!response.ok) throw new Error(`Razorpay order failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function verifySignature(orderId, paymentId, signature) {
  if (MOCK) return true;
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return expected === signature;
}

function getCheckoutConfig(order, lead = {}) {
  return {
    key: KEY_ID || 'rzp_test_mock',
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'Divya Bajaj',
    description: lead.tier || 'Astrology Numerology Report',
    order_id: order.id,
    prefill: {
      name: lead.name || '',
      email: lead.email || '',
      contact: lead.phone || ''
    },
    notes: order.notes || {},
    theme: { color: '#C9A96E' },
    mock: Boolean(order.mock)
  };
}

async function createRefund(paymentId, amount) {
  if (MOCK) return { id: `refund_mock_${Date.now()}`, payment_id: paymentId, amount, status: 'processed', mock: true };
  const payload = amount ? { amount: Math.round(Number(amount) * 100) } : {};
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Razorpay refund failed: ${response.status} ${await response.text()}`);
  return response.json();
}

module.exports = { createOrder, verifySignature, getCheckoutConfig, createRefund, MOCK };
