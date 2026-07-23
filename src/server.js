const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Reuse the existing live AstrologyAPI credential until the V2 token is promoted to Production.
if (!process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN && process.env.ASTROLOGYAPI_ACCESS_TOKEN) {
  process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN = process.env.ASTROLOGYAPI_ACCESS_TOKEN;
}

const routes = require('./routes');
const publicPaidRoutes = require('./publicPaidRoutes');
const { adminAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');
const browserScripts = ['paid-live-flow.js', 'landing-live-polish.js', 'paid-modal-scroll-photo.js', 'paid-profile-repair.js', 'free-download-top-fix.js'];

function assertBrowserScriptsAreValid() {
  browserScripts.forEach(file => {
    const filePath = path.join(publicDir, file);
    if (!fs.existsSync(filePath)) throw new Error(`Required browser script is missing: ${file}`);
    new vm.Script(fs.readFileSync(filePath, 'utf8'), { filename: file });
  });
  return true;
}

const browserScriptsValid = assertBrowserScriptsAreValid();

function sendLandingWithPatches(res) {
  const landingPath = path.join(publicDir, 'landing.html');
  if (!fs.existsSync(landingPath)) return res.status(404).send('Landing page not found');

  let html = fs.readFileSync(landingPath, 'utf8');
  const paidScript = '<script src="/paid-live-flow.js?v=paid-live-ui-2"></script>';
  const polishScript = '<script src="/landing-live-polish.js?v=landing-polish-2"></script>';
  const modalFixScript = '<script src="/paid-modal-scroll-photo.js?v=paid-modal-profile-2"></script>';
  const profileRepairScript = '<script src="/paid-profile-repair.js?v=paid-profile-repair-5"></script>';
  const freeDownloadFixScript = '<script src="/free-download-top-fix.js?v=free-download-position-2"></script>';

  html = html.replace(/<script src="\/paid-test-flow\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-v2-live-conversion\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-live-flow\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/landing-live-polish\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-modal-scroll-photo\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-profile-repair\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/free-download-top-fix\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-background-patch\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-fast-patch\.js[^>]*><\/script>/g, '');
  html = html.replace('</body>', `${paidScript}\n${polishScript}\n${modalFixScript}\n${profileRepairScript}\n${freeDownloadFixScript}\n</body>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.send(html);
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidName(value) {
  return /^[A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{1,79}$/.test(String(value || '').trim());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function isValidPhone(value) {
  const length = cleanDigits(value).length;
  return length >= 10 && length <= 15;
}

function isValidIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && date <= new Date() && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  return Boolean(match) && Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function validateReportInput(req, res, next) {
  const isFree = req.path === '/reports/free';
  const isPaid = req.path === '/reports/paid-test-v2';
  if (!isFree && !isPaid) return next();

  const body = req.body || {};
  const errors = {};
  if (!isValidName(body.name)) errors.name = 'Enter a valid full name.';
  if (!isValidEmail(body.email)) errors.email = 'Enter a valid email address.';
  if (!isValidPhone(body.phone)) errors.phone = 'Enter a valid WhatsApp number with 10 to 15 digits.';
  if (!isValidIsoDate(body.dob)) errors.dob = 'Enter a valid date of birth.';

  if (isPaid) {
    if (!['male', 'female'].includes(String(body.gender || '').toLowerCase())) errors.gender = 'Select a valid gender.';
    if (!isValidTime(body.tob)) errors.tob = 'Enter a valid time of birth.';
    if (!['exact_record', 'family_confirmed', 'approximate'].includes(String(body.birth_time_accuracy || ''))) errors.birth_time_accuracy = 'Select birth time accuracy.';
    if (!String(body.pob || '').trim()) errors.pob = 'Select a valid birthplace.';
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const timezone = Number(body.timezone);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = 'Invalid birthplace latitude.';
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = 'Invalid birthplace longitude.';
    if (!Number.isFinite(timezone) || timezone < -14 || timezone > 14) errors.timezone = 'Invalid birthplace timezone.';
    if (String(body.question || '').trim().length < 5) errors.question = 'Add your main concern in a few words.';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, error: 'Please correct the submitted information.', fields: errors });
  }
  return next();
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', validateReportInput);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ui_scripts_valid: browserScriptsValid, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', publicPaidRoutes);
app.use('/api', adminAuth, routes);

app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.use('/admin', adminAuth, express.static(publicDir));
app.get('/', (req, res) => sendLandingWithPatches(res));
app.get('/landing.html', (req, res) => sendLandingWithPatches(res));
app.get('/consultation', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.sendFile(path.join(publicDir, 'consultation.html'));
});
app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  console.error('[Global server error]', err);
  if (res.headersSent) return next(err);

  const isApi = req.path.startsWith('/api');
  if (isApi) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Something went wrong while processing the request.'
    });
  }

  return res.status(err.status || 500).send('Something went wrong while loading the page.');
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Divya Bajaj Backend System running on ${PORT}`));
}

module.exports = app;
