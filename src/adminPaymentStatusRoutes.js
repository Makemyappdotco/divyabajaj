// "Are the Razorpay keys actually working?" Mounted at
// /api/admin/payments/status behind adminAuth.
//
// This exists because the answer was previously invisible. The keys were set,
// payments_live said true, and every customer-facing path still failed with
// "Payments are temporarily unavailable" - which is what the code says when
// Razorpay answers 401. From the outside that is indistinguishable from a bug
// in the site, and the only way to tell them apart was reading server logs.
//
// So this asks Razorpay directly and reports what it said. The secret is never
// returned, and never logged.

const express = require('express');
const razorpay = require('./services/razorpay');

const router = express.Router();

/**
 * Describes a credential without revealing it.
 *
 * Whitespace is the single most common cause of a 401 here: copying a key out
 * of a dashboard or an email very often brings a trailing space or newline
 * with it, which is invisible in the Vercel input box and makes the HTTP Basic
 * header wrong. Reporting it costs nothing and saves an afternoon.
 */
function describe(value, { reveal = false } = {}) {
  const raw = String(value || '');
  if (!raw) return { set: false };
  const trimmed = raw.trim();
  return {
    set: true,
    length: raw.length,
    has_surrounding_whitespace: raw !== trimmed,
    // The key id is the publishable half and already reaches every browser, so
    // showing it is safe. The secret is only ever described, never shown.
    value: reveal ? raw : undefined,
    looks_like: reveal ? undefined : `${trimmed.slice(0, 4)}…${trimmed.slice(-2)}`
  };
}

router.get('/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  const report = {
    configured: razorpay.isConfigured(),
    mode: razorpay.isLiveMode() ? 'live' : 'test',
    key_id: describe(keyId, { reveal: true }),
    key_secret: describe(keySecret),
    webhook_secret: describe(webhookSecret),
    authenticated: null,
    message: ''
  };

  if (!report.configured) {
    report.message = 'No Razorpay keys are set on this deployment, so the site is taking no card payments. Customers are being sent to WhatsApp instead.';
    return res.json(report);
  }

  // A key id and a secret from different keypairs is the other common cause,
  // and it cannot be detected by looking at either one alone.
  const idIsTest = keyId.trim().startsWith('rzp_test_');
  const idIsLive = keyId.trim().startsWith('rzp_live_');
  if (!idIsTest && !idIsLive) {
    report.message = 'That does not look like a Razorpay key id. It should start with rzp_test_ or rzp_live_. Check you have not pasted the secret into the key id box.';
  }

  try {
    // The cheapest authenticated call there is: list one order. Nothing is
    // created, nothing is charged.
    await razorpay.ping();
    report.authenticated = true;
    report.message = report.mode === 'live'
      ? 'Razorpay is connected and in LIVE mode. Real cards will be charged.'
      : 'Razorpay is connected and in TEST mode. Only test cards will work; a real card will be declined.';
  } catch (error) {
    report.authenticated = false;
    if (error.status === 401) {
      const hints = [];
      if (report.key_secret.has_surrounding_whitespace) hints.push('the secret has a space or line break around it');
      if (report.key_id.has_surrounding_whitespace) hints.push('the key id has a space or line break around it');
      report.message = 'Razorpay rejected these credentials (401). ' + (hints.length
        ? 'Likely cause: ' + hints.join(', ') + '. Retype it rather than pasting, then redeploy.'
        : 'The key id and secret are probably from different keypairs, or the secret is wrong. Generate a fresh keypair in Razorpay, paste both halves, and redeploy.');
    } else {
      report.message = `Razorpay could not be reached: ${error.message}`;
    }
    report.razorpay_said = (error.razorpay && error.razorpay.description) || '';
  }

  return res.json(report);
});

module.exports = router;
