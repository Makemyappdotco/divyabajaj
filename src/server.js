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
const adminPricingRoutes = require('./adminPricingRoutes');
const paidReportRoutes = require('./paidReportRoutes');
const adminReportRoutes = require('./adminReportRoutes');
const reportSweep = require('./services/reportSweep');
const pricing = require('./services/pricing');
const pricingPatch = require('./services/pricingPatch');
const { validateReportInput } = require('./services/reportInputValidation');
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

async function sendLandingWithPatches(res) {
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

  // Prices come from the panel. getPrices() never throws - on a database blip
  // it returns what the page has always advertised - so this cannot be the
  // reason the landing page fails to render.
  html = pricingPatch.patchLandingPrices(html, await pricing.getPrices());

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

// The birth-detail validators now live in services/reportInputValidation.js
// so the test harness mounts the exact same middleware the live site does.

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
// Pay-before-generate for the Full Blueprint. Mounted before the general /api
// routes so its namespace is unambiguous.
app.use('/api/reports/blueprint', paidReportRoutes);

/**
 * The retry-and-refund sweep, for customers who paid and closed the tab.
 *
 * Protected by a shared secret rather than the admin password, because Vercel
 * Cron calls it unattended. Without CRON_SECRET set it refuses to run at all,
 * rather than leaving a public endpoint that anyone can hammer.
 */
app.all('/api/internal/report-sweep', async (req, res) => {
  const expected = process.env.CRON_SECRET || '';
  const supplied = req.get('x-cron-secret') ||
    String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (!expected) return res.status(503).json({ error: 'CRON_SECRET is not configured' });
  if (supplied !== expected) return res.status(401).json({ error: 'unauthorised' });

  try {
    const summary = await reportSweep.sweep({ runJob: paidReportRoutes.runJob });
    return res.json({ ok: true, ...summary });
  } catch (error) {
    console.error('[report-sweep]', error);
    return res.status(500).json({ error: error.message });
  }
});

app.use('/api', personalBlueprintPreviewRoutes);
app.use('/api', publicPaidRoutes);
// admin panel API - read-only, mounted before the general /api routes so its
// own namespace is unambiguous; shares the same Basic auth
// schedule WRITES live in their own module so adminRoutes stays read-only;
// mounted first so /schedule is not swallowed by the analytics router
// What every surface quotes. Public and read-only: the consultation page, the
// booking modal and the report modal all render from this, so there is exactly
// one number in play and it is the one the charge is built from.
app.get('/api/pricing', async (req, res) => {
  const rows = await pricing.getPrices();
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    success: true,
    products: rows.map(r => Object.assign({}, r, {
      formatted: pricing.formatInr(r.amount_inr),
      compare_at_formatted: r.compare_at_inr == null ? null : pricing.formatInr(r.compare_at_inr),
      saving_percent: pricing.savingPercent(r)
    }))
  });
});

app.use('/api/admin/schedule', adminAuth, adminScheduleRoutes);
app.use('/api/admin/pricing', adminAuth, adminPricingRoutes);
app.use('/api/admin/paid-reports', adminAuth, adminReportRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api', adminAuth, routes);

app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.use('/admin', adminAuth, express.static(publicDir));
function serveLanding(req, res) {
  return sendLandingWithPatches(res).catch(error => {
    console.error('[landing]', error);
    if (!res.headersSent) res.status(500).send('Landing page unavailable');
  });
}

app.get('/', serveLanding);
app.get('/landing.html', serveLanding);
app.get(['/full-blueprint', '/paid-report'], serveLanding);

// paid-live-flow.js builds the report modal from a template literal with the
// blueprint and consultation prices written into it, so it is served through a
// patch rather than as a static file. Registered before express.static below,
// which would otherwise answer first.
app.get('/paid-live-flow.js', async (req, res) => {
  const scriptPath = path.join(publicDir, 'paid-live-flow.js');
  try {
    const source = fs.readFileSync(scriptPath, 'utf8');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.send(pricingPatch.patchPaidFlowScript(source, await pricing.getPrices()));
  } catch (error) {
    console.error('[paid-live-flow]', error);
    return res.sendFile(scriptPath);
  }
});

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
