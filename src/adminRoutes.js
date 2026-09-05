// Admin panel API. Mounted at /api/admin behind adminAuth in server.js.
//
// Deliberately separate from routes.js and publicPaidRoutes.js: nothing here
// touches report generation, PDF rendering, payments or any customer-facing
// path. Every handler is read-only.

const express = require('express');
const analytics = require('./services/adminAnalytics');
const db = require('./database');
const { signedPdfUrl } = require('./routes');

const router = express.Router();

// Environment defaults to production so the panel shows real business numbers,
// not the test reports that were inflating the old dashboard. 'all' and 'test'
// stay available behind the toggle.
function scope(req) {
  const requested = String(req.query.environment || 'production').toLowerCase();
  return ['production', 'test', 'all'].includes(requested) ? requested : 'production';
}

function windowDays(req, fallback = 30) {
  const days = Number(req.query.days);
  return Number.isFinite(days) && days >= 1 && days <= 365 ? Math.floor(days) : fallback;
}

// Every route runs through here so a Supabase outage returns a clear message
// rather than an unhandled rejection, and so one failing panel section cannot
// take down the rest.
function handle(name, fn) {
  return async (req, res) => {
    try {
      if (!db.usingSupabase()) {
        return res.status(503).json({ error: 'Analytics need Supabase; this environment is on local fallback storage.' });
      }
      const data = await fn(req);
      res.setHeader('Cache-Control', 'no-store');
      return res.json(data);
    } catch (error) {
      console.error(`[admin:${name}]`, error);
      return res.status(error.status || 500).json({ error: error.message || `${name} failed` });
    }
  };
}

router.get('/overview', handle('overview', req =>
  analytics.getOverview({ environment: scope(req), days: windowDays(req) })
));

router.get('/reports', handle('reports', req =>
  analytics.listReports({
    environment: scope(req),
    category: String(req.query.category || 'all'),
    status: String(req.query.status || 'all'),
    search: String(req.query.search || ''),
    page: req.query.page,
    pageSize: req.query.pageSize
  })
));

router.get('/customers', handle('customers', req =>
  analytics.listCustomers({
    environment: scope(req),
    search: String(req.query.search || ''),
    page: req.query.page,
    pageSize: req.query.pageSize
  })
));

router.get('/customer/:id', handle('customer', async req => {
  const result = await analytics.getCustomer(String(req.params.id));
  if (!result || result.found === false) {
    const error = new Error('Customer not found');
    error.notFound = true;
    throw error;
  }
  return result;
}));

router.get('/consultations', handle('consultations', req =>
  analytics.getConsultations({ environment: scope(req) })
));

router.get('/health', handle('health', req =>
  analytics.getHealth({ environment: scope(req), days: windowDays(req) })
));

router.get('/activity', handle('activity', req =>
  analytics.getActivity({ limit: req.query.limit })
));

/**
 * A fresh, short-lived download link for any report.
 *
 * Read-only in spirit: it mints a signature, it does not render or store
 * anything. The PDF itself is regenerated on demand from the stored row, which
 * costs nothing but CPU - no AI call, no astrology API call - so there is no
 * archive to keep and nothing to expire.
 *
 * Two hours rather than the customer-facing thirty days: this link is for Divya
 * clicking a button, not for an email that has to survive a month.
 */
router.get('/report/:id/download', handle('download', async req => {
  const report = await db.getReport(String(req.params.id));
  if (!report) {
    const error = new Error('That report no longer exists.');
    error.status = 404;
    throw error;
  }
  if (report.status !== 'completed') {
    const error = new Error(`This report is "${report.status}", so there is nothing to download yet.`);
    error.status = 409;
    throw error;
  }
  return { url: signedPdfUrl(report.id, 2 * 60 * 60), report_id: report.id, category: report.category };
}));

module.exports = router;
