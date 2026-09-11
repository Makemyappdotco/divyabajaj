// Short, signed, expiring links to a finished report.
//
// Both delivery channels need a URL. WhatsApp cannot attach a file of its own
// - a document message carries a link - and an email that links rather than
// attaches survives a 25MB mailbox limit.
//
// The existing signedPdfUrl() is fine for a browser but far too long for a
// WhatsApp button, which appends a single variable to a fixed base URL. So
// this mints one compact blob instead:
//
//   https://divyabajaj.com/r/<base64url(reportId.expires.signature)>
//
// The signature is HMAC-SHA256 truncated to 16 bytes. Truncating a MAC to 128
// bits is standard practice and leaves nothing guessable: an attacker would
// need 2^128 attempts, and every wrong one is a 404.

const crypto = require('crypto');

// Same 30 days the customer-facing PDF links already use. Long enough that
// nobody loses their report over a holiday, short enough that a forwarded
// link does not live forever.
const TTL_SECONDS = 30 * 24 * 60 * 60;
const SIG_BYTES = 16;

function siteUrl() {
  return String(process.env.SITE_URL || 'https://divyabajaj.com').replace(/\/$/, '');
}

function secret() {
  const value = process.env.REPORT_DOWNLOAD_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error('Report link signing is not configured');
  return value;
}

function sign(reportId, expires) {
  return crypto.createHmac('sha256', secret())
    .update(`r.${reportId}.${expires}`)
    .digest()
    .subarray(0, SIG_BYTES);
}

function encode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(text) {
  const padded = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded + '='.repeat((4 - padded.length % 4) % 4), 'base64');
}

/** The bit that goes after /r/ - and the value of the WhatsApp button variable. */
function token(reportId, ttlSeconds = TTL_SECONDS) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = sign(reportId, expires);
  return encode(Buffer.from(`${reportId}.${expires}.${encode(signature)}`, 'utf8'));
}

/** Absolute, because a WhatsApp message and an email both leave the site. */
function url(reportId, ttlSeconds = TTL_SECONDS) {
  return `${siteUrl()}/r/${token(reportId, ttlSeconds)}`;
}

/**
 * Returns the report id, or null.
 *
 * Null for every failure - malformed, tampered, expired - so a caller cannot
 * accidentally tell the difference and neither can anyone probing it.
 */
function verify(tokenValue) {
  try {
    const parts = decode(tokenValue).toString('utf8').split('.');
    if (parts.length !== 3) return null;

    const [reportId, expiresRaw, signatureRaw] = parts;
    const expires = Number(expiresRaw);
    if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return null;

    const expected = sign(reportId, expires);
    const supplied = decode(signatureRaw);
    if (supplied.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(expected, supplied)) return null;

    return reportId;
  } catch (error) {
    return null;
  }
}

module.exports = { token, url, verify, TTL_SECONDS, siteUrl };
