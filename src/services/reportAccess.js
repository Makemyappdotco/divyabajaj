const crypto = require('crypto');

function secret() {
  const value = process.env.REPORT_ACCESS_SECRET || process.env.REPORT_DOWNLOAD_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error('Report access signing secret is not configured');
  return String(value);
}

function ttlSeconds() {
  const configured = Number(process.env.REPORT_ACCESS_TTL_SECONDS);
  return Number.isFinite(configured) && configured >= 300 ? Math.floor(configured) : 60 * 60 * 24 * 30;
}

function signature(reportId, leadId, exp) {
  return crypto.createHmac('sha256', secret()).update(`${reportId}.${leadId}.${exp}`).digest('base64url');
}

function issueReportAccess(reportId, leadId) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds();
  return `${exp}.${signature(reportId, leadId, exp)}`;
}

function verifyReportAccess(token, reportId, leadId) {
  const [expRaw, sig] = String(token || '').split('.');
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !sig) return false;
  const expected = signature(reportId, leadId, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { issueReportAccess, verifyReportAccess };
