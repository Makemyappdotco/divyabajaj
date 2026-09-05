// Razorpay, over the REST API.
//
// No SDK on purpose: this deploys to Vercel serverless where every dependency
// is bundle weight on a cold start, the whole surface we need is three calls,
// and the rest of this codebase already talks to third parties with fetch.
//
// This module FAILS CLOSED. The version it replaces treated missing keys as
// "mock mode" and had verifySignature return true unconditionally in it - so a
// deploy that lost its environment variables would have marked every booking
// paid without a rupee moving. Anything that cannot be verified is now an
// error, never a pass.

const crypto = require('crypto');

const API = 'https://api.razorpay.com/v1';

function keyId() {
  return process.env.RAZORPAY_KEY_ID || '';
}

function keySecret() {
  return process.env.RAZORPAY_KEY_SECRET || '';
}

/** Whether payments can run at all. Checked before any money path is offered. */
function isConfigured() {
  return Boolean(keyId() && keySecret());
}

/** Test keys are rzp_test_*; live keys are rzp_live_*. Surfaced so the panel can say so. */
function isLiveMode() {
  return keyId().startsWith('rzp_live_');
}

function authHeader() {
  if (!isConfigured()) throw new Error('Razorpay keys are not configured');
  return `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`;
}

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch (e) { payload = { raw: text }; }

  if (!response.ok) {
    // 401 means the keys are wrong, which is an operator problem, not a
    // customer one - it is separated so the route can say so and alert rather
    // than telling a customer to try again forever.
    const error = new Error(
      (payload.error && payload.error.description) || `Razorpay ${method} ${path} failed (${response.status})`
    );
    error.status = response.status;
    error.razorpay = payload.error || null;
    throw error;
  }
  return payload;
}

/**
 * @param {number} amountPaise integer paise. Razorpay's minimum is 100 (₹1).
 * Paise, not rupees, because the unit confusion in the old signature
 * (rupees in, ×100 inside) is exactly how a 100x charge happens.
 */
async function createOrder({ amountPaise, currency = 'INR', receipt = '', notes = {} }) {
  const amount = Number(amountPaise);
  if (!Number.isInteger(amount) || amount < 100) {
    throw new Error(`Order amount must be a whole number of paise, at least 100. Got ${amountPaise}.`);
  }
  return call('/orders', {
    method: 'POST',
    // receipt is capped at 40 chars by Razorpay and rejected above it.
    body: { amount, currency, receipt: String(receipt).slice(0, 40), notes }
  });
}

/**
 * Checkout callback signature: HMAC-SHA256(order_id|payment_id, key_secret).
 *
 * timingSafeEqual rather than === so the comparison cannot be timed. Returns
 * false on any malformed input rather than throwing, so a hostile body is a
 * clean rejection.
 */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', keySecret()).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Webhook signature: HMAC-SHA256(raw body, webhook secret).
 *
 * A DIFFERENT secret from the API key secret, and computed over the exact
 * bytes received - re-serialising the parsed JSON changes them and the
 * signature will never match.
 */
function verifyWebhookSignature({ rawBody, signature }) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Authoritative status, straight from Razorpay. Used when a callback is doubted. */
async function fetchPayment(paymentId) {
  return call(`/payments/${encodeURIComponent(paymentId)}`);
}

async function createRefund(paymentId, amountPaise) {
  return call(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    body: amountPaise ? { amount: Math.round(Number(amountPaise)) } : {}
  });
}

module.exports = {
  isConfigured, isLiveMode, publicKeyId: keyId,
  createOrder, verifyCheckoutSignature, verifyWebhookSignature, fetchPayment, createRefund
};
