const express = require('express');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Reuse the existing AstrologyAPI credential in Preview until a dedicated V2 token is promoted.
if (!process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN && process.env.ASTROLOGYAPI_ACCESS_TOKEN) {
  process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN = process.env.ASTROLOGYAPI_ACCESS_TOKEN;
}

const db = require('./database');
const routes = require('./routes');
const publicPaidRoutes = require('./publicPaidRoutes');
const adminRoutes = require('./adminRoutes');
const bookingRoutes = require('./bookingRoutes');
const paymentRoutes = require('./paymentRoutes');
const adminScheduleRoutes = require('./adminScheduleRoutes');
const personalBlueprintPreviewRoutes = require('./personalBlueprintPreviewRoutes');
const { adminAuth, adminConfigured } = require('./auth');
const {
  getKpHouseCusps,
  getKpHouseSignificators,
  getKpPlanetSignificators,
  getKpPlanets
} = require('./services/astrologyApiV2');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');
const browserScripts = ['paid-live-flow.js', 'paid-direct-link.js', 'landing-live-polish.js', 'why-section-balance.js', 'paid-modal-scroll-photo.js', 'paid-profile-repair.js', 'free-download-top-fix.js', 'reveal-failsafe.js'];

function validateBrowserScriptsSafely() {
  let allValid = true;

  browserScripts.forEach(file => {
    try {
      const filePath = path.join(publicDir, file);
      if (!fs.existsSync(filePath)) throw new Error(`Required browser script is missing: ${file}`);
      new vm.Script(fs.readFileSync(filePath, 'utf8'), { filename: file });
    } catch (error) {
      allValid = false;
      console.error(`[UI script validation] ${file}: ${error.message}`);
    }
  });

  return allValid;
}

const browserScriptsValid = validateBrowserScriptsSafely();

// Divya's real WhatsApp number, as already used by public/consultation.html.
const CONTACT_WHATSAPP = process.env.CONTACT_WHATSAPP || '919545136766';

function sendLandingWithPatches(res) {
  const landingPath = path.join(publicDir, 'landing.html');
  if (!fs.existsSync(landingPath)) return res.status(404).send('Landing page not found');

  let html = fs.readFileSync(landingPath, 'utf8');
  const paidScript = '<script src="/paid-live-flow.js?v=paid-live-ui-2"></script>';
  const directPaidScript = '<script src="/paid-direct-link.js?v=paid-direct-link-1"></script>';
  const polishScript = '<script src="/landing-live-polish.js?v=landing-polish-3"></script>';
  const whyBalanceScript = '<script src="/why-section-balance.js?v=why-balance-1"></script>';
  const modalFixScript = '<script src="/paid-modal-scroll-photo.js?v=paid-modal-profile-4"></script>';
  const profileRepairScript = '<script src="/paid-profile-repair.js?v=paid-profile-repair-6"></script>';
  const freeDownloadFixScript = '<script src="/free-download-top-fix.js?v=free-download-position-3"></script>';
  const revealFailsafeScript = '<script src="/reveal-failsafe.js?v=reveal-failsafe-1"></script>';
  const bookingModalScript = '<script src="/booking-modal.js?v=booking-modal-1"></script>';

  html = html.replace(/<script src="\/paid-test-flow\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-v2-live-conversion\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-live-flow\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-direct-link\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/landing-live-polish\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/why-section-balance\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-modal-scroll-photo\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-profile-repair\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/free-download-top-fix\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/light-mode-live-fixes\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/reveal-failsafe\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/booking-modal\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-background-patch\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-fast-patch\.js[^>]*><\/script>/g, '');
  // The landing page ships a literal placeholder WhatsApp number in five
  // places - the float button, the booking CTA, the footer, the sticky bar and
  // the SVC_WA_NUMBER constant - so every one of those buttons currently goes
  // nowhere. Patched on the way out rather than by editing the 5.6MB source.
  html = html.split('91XXXXXXXXXX').join(CONTACT_WHATSAPP);

  html = html.replace('</body>', `${paidScript}\n${directPaidScript}\n${polishScript}\n${whyBalanceScript}\n${modalFixScript}\n${profileRepairScript}\n${freeDownloadFixScript}\n${revealFailsafeScript}\n${bookingModalScript}\n</body>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.send(html);
}

function isProductionRuntime() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production';
}

function persistentStorageGuard(req, res, next) {
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const storageRequired = isProductionRuntime() || process.env.REQUIRE_PERSISTENT_STORAGE === 'true';

  if (isWrite && storageRequired && !db.usingSupabase()) {
    return res.status(503).json({
      success: false,
      error: 'Persistent storage is not configured. This request was stopped to prevent customer data loss.',
      code: 'PERSISTENT_STORAGE_REQUIRED'
    });
  }

  return next();
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

app.disable('x-powered-by');
// Razorpay signs the webhook over the exact bytes it sent, so this one route
// needs the raw body and must be mounted BEFORE the global JSON parser.
app.post('/api/booking/payment/webhook', express.raw({ type: '*/*', limit: '1mb' }), paymentRoutes);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', persistentStorageGuard);
app.use('/api', validateReportInput);

app.get('/health', (req, res) => {
  const storageMode = db.usingSupabase() ? 'supabase' : 'local_fallback';
  const downloadSigningReady = Boolean(
    process.env.REPORT_DOWNLOAD_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY
  );
  const explicitDownloadSecretReady = Boolean(process.env.REPORT_DOWNLOAD_SECRET);
  const freeReportReady = Boolean(process.env.OPENAI_API_KEY && downloadSigningReady);
  const paidPreviewReady = Boolean(
    process.env.OPENAI_API_KEY &&
    (process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN || process.env.ASTROLOGYAPI_ACCESS_TOKEN)
  );
  const foundationReady = browserScriptsValid && db.usingSupabase();
  const adminReady = adminConfigured();
  const productionReleaseApproved = process.env.SYSTEM_PRODUCTION_READY === 'true';

  res.json({
    status: 'ok',
    ui_scripts_valid: browserScriptsValid,
    storage_mode: storageMode,
    persistent_storage_ready: db.usingSupabase(),
    download_signing_ready: downloadSigningReady,
    admin_ready: adminReady,
    foundation_ready: foundationReady,
    free_report_ready: freeReportReady,
    report_preview_ready: paidPreviewReady,
    production_ready: foundationReady && freeReportReady && adminReady && explicitDownloadSecretReady && productionReleaseApproved,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/astrology-v2/kp-access-test', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (isProductionRuntime()) return res.status(404).json({ success: false, error: 'Not found' });

  const sample = {
    name: 'KP Access Diagnostic',
    gender: 'male',
    dob: '2000-01-06',
    tob: '07:45',
    pob: 'Mumbai, Maharashtra, India',
    latitude: 19.132,
    longitude: 72.342,
    timezone: 5.5
  };

  const checks = [
    ['kp_planets', getKpPlanets(sample)],
    ['kp_house_cusps', getKpHouseCusps(sample)],
    ['kp_planet_significator', getKpPlanetSignificators(sample)],
    ['kp_house_significator', getKpHouseSignificators(sample)]
  ];
  const settled = await Promise.allSettled(checks.map(([, promise]) => promise));
  const endpoints = {};

  checks.forEach(([name], index) => {
    const result = settled[index];
    if (result.status === 'fulfilled') {
      endpoints[name] = {
        ok: true,
        rows: Array.isArray(result.value) ? result.value.length : null
      };
    } else {
      endpoints[name] = {
        ok: false,
        error: String(result.reason?.message || 'Unknown AstrologyAPI error').slice(0, 500)
      };
    }
  });

  const success = Object.values(endpoints).every(item => item.ok);
  return res.json({
    success,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
    endpoints
  });
});

// public booking API - no auth, this is the customer-facing consultation flow
app.use('/api/booking', bookingRoutes);
app.use('/api/booking/payment', paymentRoutes);
app.use('/api', personalBlueprintPreviewRoutes);
app.use('/api', publicPaidRoutes);
// admin panel API - read-only, mounted before the general /api routes so its
// own namespace is unambiguous; shares the same Basic auth
// schedule WRITES live in their own module so adminRoutes stays read-only;
// mounted first so /schedule is not swallowed by the analytics router
app.use('/api/admin/schedule', adminAuth, adminScheduleRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api', adminAuth, routes);

app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.use('/admin', adminAuth, express.static(publicDir));
app.get('/', (req, res) => sendLandingWithPatches(res));
app.get('/landing.html', (req, res) => sendLandingWithPatches(res));
app.get(['/full-blueprint', '/paid-report'], (req, res) => sendLandingWithPatches(res));

app.get(['/book-consultation', '/private-consultation', '/consultation/book'], (req, res) => {
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  return res.redirect(302, `/consultation${query}#bookingForm`);
});

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
