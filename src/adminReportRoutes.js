// What happened to every paid Full Blueprint. Mounted at
// /api/admin/paid-reports behind adminAuth.
//
// The reason this exists: money can move and a report can still not arrive.
// Without a list, a customer who paid and got nothing is invisible to Divya
// until they complain. Everything here is about making that impossible.

const express = require('express');
const db = require('./database');
const jobs = require('./services/reportJobs');
const pricing = require('./services/pricing');
const delivery = require('./services/delivery');
const paidReportRoutes = require('./paidReportRoutes');
const sweep = require('./services/reportSweep');

const router = express.Router();

function scope() { return jobs.runtimeEnvironment(); }

function environmentLabel() {
  return scope() === 'production' ? 'your live site' : 'this preview site';
}

function handle(name, fn) {
  return async (req, res) => {
    try {
      if (!db.usingSupabase()) {
        return res.status(503).json({ error: 'Paid reports need Supabase; this environment is on local fallback storage.' });
      }
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res);
    } catch (error) {
      console.error(`[admin:paid-reports:${name}]`, error);
      return res.status(error.status || 500).json({ error: error.message || `${name} failed` });
    }
  };
}

// One plain sentence per state, so the panel never shows Divya a status code.
const STATE_COPY = {
  queued: 'Paid, waiting to start',
  generating: 'Being written now',
  generated: 'Report ready',
  failed: 'Failed, will retry',
  refunded: 'Refunded in full',
  cancelled: 'Cancelled'
};

function describe(job) {
  if (job.status === 'failed' && jobs.isExhausted(job)) return 'Failed, refund due';
  return STATE_COPY[job.status] || job.status;
}

/** True when this is a customer Divya needs to do something about. */
function needsAttention(job) {
  if (job.status === 'failed') return true;
  if (job.status === 'refunded') return false;
  if (job.status === 'generated') {
    const sent = job.delivery || {};
    // Generated but never actually sent anywhere.
    return !sent.attempted || sent.reason === 'not_configured';
  }
  return false;
}

router.get('/', handle('list', async (req, res) => {
  const environment = scope();
  const rows = await jobs.listForPanel({ environment, limit: 60 });
  const price = await pricing.priceOf('paid_blueprint', environment);

  const items = rows.map(job => {
    const lead = job.payload || {};
    return {
      id: job.id,
      status: job.status,
      state_label: describe(job),
      needs_attention: needsAttention(job),
      attempts: job.attempts,
      max_attempts: jobs.MAX_ATTEMPTS,
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      question: String(lead.question || '').slice(0, 120),
      report_id: job.report_id || '',
      paid_at: job.paid_at,
      generated_at: job.generated_at,
      refunded_at: job.refunded_at,
      last_error: job.last_error || '',
      delivered: Boolean(job.delivery && job.delivery.attempted &&
        ((job.delivery.whatsapp && job.delivery.whatsapp.sent) || (job.delivery.email && job.delivery.email.sent))),
      created_at: job.created_at
    };
  });

  return res.json({
    environment,
    environment_label: environmentLabel(),
    // False today: no WhatsApp key, no email provider. The panel says so
    // rather than showing a row of reports that look delivered.
    can_deliver: delivery.isConfigured(),
    delivery_channels: delivery.channels(),
    price_inr: price.amount_inr,
    price_formatted: pricing.formatInr(price.amount_inr),
    counts: {
      total: items.length,
      ready: items.filter(i => i.status === 'generated').length,
      waiting: items.filter(i => ['queued', 'generating'].includes(i.status)).length,
      failed: items.filter(i => i.status === 'failed').length,
      refunded: items.filter(i => i.status === 'refunded').length,
      undelivered: items.filter(i => i.status === 'generated' && !i.delivered).length
    },
    items
  });
}));

/** Try a stuck report again by hand, without waiting for the next sweep. */
router.post('/:id/retry', handle('retry', async (req, res) => {
  const job = await jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'That report no longer exists.' });
  if (job.status === 'generated') return res.status(409).json({ error: 'That report is already done.' });
  if (job.status === 'awaiting_payment') return res.status(409).json({ error: 'That one was never paid for.' });
  if (job.status === 'refunded') return res.status(409).json({ error: 'That payment has already been refunded.' });

  // A hand retry gets a fresh budget - Divya has usually fixed whatever caused
  // the failure, and making her wait for a refund she does not want would be
  // the wrong default.
  if (job.attempts >= jobs.MAX_ATTEMPTS) {
    await jobs.update(job.id, { attempts: 0, status: 'queued', last_error: '' });
  }

  const outcome = await paidReportRoutes.runJob(job.id);
  if (!outcome.claimed) return res.json({ success: true, status: 'generating', note: 'Already being written.' });
  if (!outcome.ok) return res.status(500).json({ error: outcome.error || 'That attempt failed again.' });
  return res.json({ success: true, status: 'generated' });
}));

/** Send a finished report to the customer again. */
router.post('/:id/resend', handle('resend', async (req, res) => {
  const job = await jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'That report no longer exists.' });
  if (job.status !== 'generated') return res.status(409).json({ error: 'There is nothing finished to send yet.' });
  if (!delivery.isConfigured()) {
    return res.status(503).json({ error: 'No WhatsApp or email provider is connected yet, so nothing can be sent.' });
  }

  const lead = job.payload || {};
  const sent = await delivery.deliverReport({
    environment: job.environment, jobId: job.id,
    name: lead.name, email: lead.email, phone: lead.phone, reportUrl: ''
  });
  await jobs.recordDelivery(job.id, sent);
  return res.json({ success: true, delivery: sent });
}));

/** Hand the money back on purpose, before the retries are spent. */
router.post('/:id/refund', handle('refund', async (req, res) => {
  const job = await jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'That report no longer exists.' });
  if (!job.paid_at) return res.status(409).json({ error: 'That one was never paid for.' });

  const result = await sweep.refund(job);
  if (!result.refunded) return res.status(409).json({ error: result.reason || 'That refund did not go through.' });
  return res.json({ success: true, refund_id: result.refundId });
}));

module.exports = router;
