// Pay first, then generate. Mounted at /api/reports/blueprint.
//
// Before this, /api/reports/paid-test-v2 answered `payment_required: false` and
// handed the ₹999 report to anyone who filled the form. This is the gate.
//
// The order of the flow matters. Birth details are collected and validated
// BEFORE the customer is asked for money, so that the moment payment lands we
// already have everything needed to build the report - and so nobody pays and
// is then told their date of birth is unreadable.
//
// The amount is never taken from the browser. It is read from the price Divya
// set in her panel, the same as the consultation.

const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const razorpay = require('./services/razorpay');
const pricing = require('./services/pricing');
const jobs = require('./services/reportJobs');
const blueprint = require('./services/paidBlueprint');
const delivery = require('./services/delivery');

const router = express.Router();

const CURRENCY = 'INR';
const PRODUCT = 'paid_blueprint';

function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function now() { return new Date().toISOString(); }
function fail(res, status, message) { return res.status(status).json({ success: false, error: message }); }

function handle(name, fn) {
  return async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res);
    } catch (error) {
      console.error(`[blueprint:${name}]`, error);
      if (error.status === 401) {
        return fail(res, 503, 'Payments are temporarily unavailable. Please message us and we will sort it out.');
      }
      return fail(res, 500, error.publicMessage || 'Something went wrong. If you have paid, your report is safe and will reach you.');
    }
  };
}

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Paid reports need Supabase');
  return supabase;
}

// A missing field should name itself in words a customer can act on.
const FIELD_LABELS = {
  name: 'your name', phone: 'your WhatsApp number', dob: 'your date of birth',
  email: 'your email address', tob: 'your time of birth', pob: 'your place of birth',
  gender: 'your gender', birth_time_accuracy: 'how sure you are of your birth time',
  latitude: 'your birthplace', longitude: 'your birthplace', timezone: 'your birthplace'
};

function describeMissing(missing) {
  const seen = [];
  missing.forEach(field => {
    const label = FIELD_LABELS[field] || field;
    if (!seen.includes(label)) seen.push(label);
  });
  if (seen.length === 1) return `Please add ${seen[0]}.`;
  return `Please add ${seen.slice(0, -1).join(', ')} and ${seen[seen.length - 1]}.`;
}

// --------------------------------------------------------------- what it costs

/**
 * What the modal asks before it renders. Price and, critically, whether we can
 * message the customer - the "you can close this page" line is only truthful
 * if a delivery channel actually exists.
 */
router.get('/config', handle('config', async (req, res) => {
  const price = await pricing.priceOf(PRODUCT);
  return res.json({
    success: true,
    amount_inr: price.amount_inr,
    amount_formatted: pricing.formatInr(price.amount_inr),
    compare_at_inr: price.compare_at_inr,
    saving_percent: pricing.savingPercent(price),
    payments_live: razorpay.isConfigured(),
    live_mode: razorpay.isLiveMode(),
    // False today. Uomox has no key and there is no email provider.
    can_deliver: delivery.isConfigured(),
    delivery_channels: delivery.channels()
  });
}));

// ------------------------------------------------------------------ checkout

router.post('/checkout', handle('checkout', async (req, res) => {
  if (!razorpay.isConfigured()) return fail(res, 503, 'Payments are not switched on yet.');
  if (!db.usingSupabase()) return fail(res, 503, 'This is temporarily unavailable. Please try again shortly.');

  const payload = blueprint.normalisePayload(req.body || {});
  const missing = blueprint.missingFields(payload);
  if (missing.length) return fail(res, 400, describeMissing(missing));

  const environment = jobs.runtimeEnvironment();

  // The lead exists before the money does, so an abandoned checkout still
  // leaves Divya someone to follow up with.
  const lead = await blueprint.upsertLead(payload, { status: 'paid_blueprint_checkout_started' });
  const job = await jobs.create({ environment, leadId: lead.id, payload });

  const price = await pricing.priceOf(PRODUCT, environment);
  const amountPaise = Math.round(price.amount_inr * 100);

  const idempotencyKey = `blueprint:${job.id}`;
  const created = await razorpay.createOrder({
    amountPaise,
    currency: CURRENCY,
    receipt: job.id.slice(0, 40),
    notes: { job_id: job.id, lead_id: lead.id, product: PRODUCT }
  });

  const supabase = client();
  const orderRow = {
    id: id('ord'),
    environment,
    lead_id: lead.id,
    product_code: PRODUCT,
    amount: price.amount_inr,
    currency: CURRENCY,
    status: 'pending',
    gateway: 'razorpay',
    gateway_order_id: created.id,
    idempotency_key: idempotencyKey,
    attribution: {},
    created_at: now(),
    updated_at: now()
  };
  const saved = await supabase.from('orders').insert(orderRow).select().single();
  if (saved.error) throw new Error(saved.error.message);

  await jobs.attachOrder(job.id, { orderId: saved.data.id, gatewayOrderId: created.id });

  return res.json({
    success: true,
    job_id: job.id,
    key_id: razorpay.publicKeyId(),
    order_id: created.id,
    amount: amountPaise,
    currency: CURRENCY,
    live_mode: razorpay.isLiveMode(),
    can_deliver: delivery.isConfigured(),
    name: 'Divya Bajaj',
    description: 'The Full Blueprint',
    prefill: { name: payload.name, email: payload.email, contact: payload.phone }
  });
}));

// -------------------------------------------------------------------- verify

/**
 * The browser's word that payment succeeded, checked against the signature.
 *
 * This only QUEUES the job. It does not generate, because generation takes
 * minutes and this response needs to come back immediately so the customer
 * sees "paid" rather than a spinner.
 */
router.post('/verify', handle('verify', async (req, res) => {
  if (!razorpay.isConfigured()) return fail(res, 503, 'Payments are not switched on yet.');

  const body = req.body || {};
  const orderId = String(body.razorpay_order_id || '').trim();
  const paymentId = String(body.razorpay_payment_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();

  if (!orderId || !paymentId || !signature) {
    return fail(res, 400, 'That payment could not be checked. Please contact us before paying again.');
  }

  if (!razorpay.verifyCheckoutSignature({ orderId, paymentId, signature })) {
    console.error('[blueprint:verify] signature mismatch', { orderId, paymentId });
    return fail(res, 400, 'We could not verify that payment. Please contact us before trying again.');
  }

  const job = await jobs.getByGatewayOrder(orderId);
  if (!job) return fail(res, 404, 'We could not find what that payment was for. Please contact us.');

  const supabase = client();
  if (job.order_id) {
    await supabase.from('orders').update({ status: 'paid', updated_at: now() }).eq('id', job.order_id);
  }
  await supabase.from('payment_attempts').insert({
    id: id('pay'), order_id: job.order_id || job.id, gateway: 'razorpay',
    gateway_payment_id: paymentId, status: 'captured', method: '',
    error_code: '', error_message: '', raw_response: { source: 'checkout' },
    created_at: now(), updated_at: now()
  });

  const queued = await jobs.markPaid(job.id, { paymentId });

  return res.json({
    success: true,
    job_id: job.id,
    status: queued ? queued.status : 'queued',
    can_deliver: delivery.isConfigured()
  });
}));

// ----------------------------------------------------------------------- run

/**
 * Actually builds the report.
 *
 * Called by the customer's browser right after payment, and by the sweep for
 * anyone who closed their tab. Whoever calls it, claim() guarantees only one
 * of them does the work.
 */
async function runJob(jobId) {
  const claimed = await jobs.claim(jobId);
  if (!claimed) return { claimed: false };

  try {
    const result = await blueprint.generate(claimed.payload);
    const saved = await blueprint.saveGeneratedReport({
      payload: claimed.payload,
      result,
      leadId: claimed.lead_id,
      paidWith: { orderId: claimed.order_id, paymentId: claimed.gateway_payment_id }
    });

    await jobs.markGenerated(claimed.id, { reportId: saved.report_id });

    // Delivery is best effort and never rolls back a generated report. Today
    // it always reports 'not_configured'.
    const sent = await delivery.deliverReport({
      environment: claimed.environment,
      jobId: claimed.id,
      name: claimed.payload.name,
      email: claimed.payload.email,
      phone: claimed.payload.phone,
      reportUrl: ''
    });
    await jobs.recordDelivery(claimed.id, sent);

    return { claimed: true, ok: true, report: result, reportId: saved.report_id };
  } catch (error) {
    console.error('[blueprint:run] generation failed', error);
    await jobs.markFailed(jobId, error.message);
    return { claimed: true, ok: false, error: error.message };
  }
}

router.post('/run', handle('run', async (req, res) => {
  const jobId = String((req.body && req.body.job_id) || '').trim();
  if (!jobId) return fail(res, 400, 'Nothing to generate.');

  const job = await jobs.get(jobId);
  if (!job) return fail(res, 404, 'We could not find that report.');
  // The gate. No paid order, no report.
  if (job.status === 'awaiting_payment') return fail(res, 402, 'This report has not been paid for yet.');
  if (job.status === 'generated') {
    return res.json({ success: true, status: 'generated', already: true });
  }

  const outcome = await runJob(jobId);
  if (!outcome.claimed) {
    // Someone else is already on it. Not an error - the customer should keep
    // polling rather than be told something went wrong.
    return res.json({ success: true, status: 'generating', already: true });
  }
  if (!outcome.ok) return res.json({ success: false, status: 'failed', error: outcome.error });

  return res.json({ success: true, status: 'generated' });
}));

// -------------------------------------------------------------------- status

/** What the page polls while it waits. Returns the report once it exists. */
router.get('/status', handle('status', async (req, res) => {
  const jobId = String(req.query.job_id || '').trim();
  if (!jobId) return fail(res, 400, 'Nothing to check.');

  const job = await jobs.get(jobId);
  if (!job) return fail(res, 404, 'We could not find that report.');

  const payload = {
    success: true,
    status: job.status,
    attempts: job.attempts,
    can_deliver: delivery.isConfigured(),
    refunded: job.status === 'refunded',
    // Only ever true once the money is in.
    paid: Boolean(job.paid_at)
  };

  if (job.status === 'generated' && job.report_id) {
    const report = await db.getReport(job.report_id);
    if (report) {
      payload.report_text = report.ai_report;
      payload.report_json = report.report_json || null;
      payload.numbers = report.horosoft_data || {};
      payload.astrology_data = report.astrology_data || null;
      payload.lead = job.payload;
      payload.report_id = job.report_id;
    }
  }

  if (job.status === 'failed') {
    payload.exhausted = jobs.isExhausted(job);
    payload.message = payload.exhausted
      ? 'We could not complete your report, so your payment is being refunded in full.'
      : 'That attempt did not complete. We are trying again.';
  }

  return res.json(payload);
}));

module.exports = router;
module.exports.runJob = runJob;
