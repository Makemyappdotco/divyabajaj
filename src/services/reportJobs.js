// The state of every paid Full Blueprint, from form to delivered.
//
// The hard requirement here is that ONE payment produces EXACTLY ONE report.
// Three different callers can each try to start generation for the same job:
// the customer's browser after checkout returns, Razorpay's webhook (which
// retries until it gets a 2xx), and the sweep that catches abandoned tabs.
// They will overlap.
//
// claim() is what makes that safe. It is a conditional update - "move this row
// to generating only if it is not already generating" - so the database, not
// the order the calls happen to arrive in, decides who does the work. Exactly
// one caller gets the row back; the others get null and stop.

const crypto = require('crypto');
const db = require('../database');

// Generation has been observed taking over six minutes, longer than a Vercel
// function is allowed to run. A claim older than this is treated as a caller
// that died mid-generation, and the job becomes retryable.
const CLAIM_TIMEOUT_MS = 12 * 60 * 1000;

// Three goes before the money is handed back.
const MAX_ATTEMPTS = 3;

function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function now() { return new Date().toISOString(); }

function runtimeEnvironment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production' ? 'production' : 'test';
  return process.env.NODE_ENV === 'production' ? 'production' : 'test';
}

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Paid reports need Supabase');
  return supabase;
}

async function create({ environment = runtimeEnvironment(), leadId, payload }) {
  const supabase = client();
  const row = {
    id: id('rjb'),
    environment,
    product_code: 'paid_blueprint',
    lead_id: leadId || null,
    status: 'awaiting_payment',
    payload: payload || {},
    attempts: 0,
    created_at: now(),
    updated_at: now()
  };
  const { data, error } = await supabase.from('report_jobs').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function get(jobId) {
  const supabase = client();
  const { data, error } = await supabase.from('report_jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getByGatewayOrder(gatewayOrderId) {
  const supabase = client();
  const { data, error } = await supabase.from('report_jobs').select('*')
    .eq('gateway_order_id', gatewayOrderId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function update(jobId, patch) {
  const supabase = client();
  const { data, error } = await supabase.from('report_jobs')
    .update(Object.assign({ updated_at: now() }, patch)).eq('id', jobId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/** Links the job to the Razorpay order it will be paid by. */
async function attachOrder(jobId, { orderId, gatewayOrderId }) {
  return update(jobId, { order_id: orderId, gateway_order_id: gatewayOrderId });
}

/**
 * Money has arrived. Moves the job into the queue.
 *
 * Idempotent, because the browser and the webhook both call it: a job already
 * past this point is returned unchanged rather than being dragged backwards
 * into the queue and generated a second time.
 */
async function markPaid(jobId, { paymentId } = {}) {
  const job = await get(jobId);
  if (!job) return null;
  if (job.status !== 'awaiting_payment') {
    // Already queued, generating, generated or refunded. Record the payment id
    // if this is the first caller to know it, but do not touch the status.
    if (paymentId && !job.gateway_payment_id) {
      return update(jobId, { gateway_payment_id: paymentId });
    }
    return job;
  }
  return update(jobId, {
    status: 'queued',
    paid_at: now(),
    gateway_payment_id: paymentId || job.gateway_payment_id || ''
  });
}

/**
 * Take ownership of a job, or return null.
 *
 * The .in() on status is the guard: the row only moves to 'generating' if it
 * is currently queued or failed. PostgREST turns that into a single UPDATE ...
 * WHERE, so two simultaneous callers cannot both match - the first commits and
 * the second finds nothing to update.
 *
 * A stale claim is reclaimable, otherwise a function that was killed by the
 * platform's time limit would strand a paid customer's report forever.
 */
async function claim(jobId) {
  const supabase = client();
  const job = await get(jobId);
  if (!job) return null;

  const claimable = ['queued', 'failed'];
  const staleClaim = job.status === 'generating' && job.claimed_at &&
    (Date.now() - new Date(job.claimed_at).getTime()) > CLAIM_TIMEOUT_MS;

  if (!claimable.includes(job.status) && !staleClaim) return null;
  if (job.attempts >= MAX_ATTEMPTS) return null;

  const { data, error } = await supabase.from('report_jobs')
    .update({ status: 'generating', claimed_at: now(), attempts: job.attempts + 1, updated_at: now() })
    .eq('id', jobId)
    // The race guard. Without this the check above is only advisory.
    .in('status', staleClaim ? ['generating'] : claimable)
    .eq('attempts', job.attempts)
    .select();

  if (error) throw new Error(error.message);
  // Empty means somebody else claimed it between the read and the write.
  return (data && data[0]) || null;
}

async function markGenerated(jobId, { reportId }) {
  return update(jobId, {
    status: 'generated', report_id: reportId, generated_at: now(), last_error: ''
  });
}

async function markFailed(jobId, message) {
  return update(jobId, { status: 'failed', last_error: String(message || '').slice(0, 500) });
}

async function markRefunded(jobId, { refundId }) {
  return update(jobId, { status: 'refunded', refunded_at: now(), refund_id: refundId || '' });
}

async function recordDelivery(jobId, delivery) {
  return update(jobId, { delivery: delivery || {} });
}

/**
 * Jobs the sweep should look at: paid, not finished, not out of attempts.
 * Ordered oldest first so nobody waits behind a newer customer.
 */
async function pending({ environment = runtimeEnvironment(), limit = 10 } = {}) {
  const supabase = client();
  const { data, error } = await supabase.from('report_jobs').select('*')
    .eq('environment', environment)
    .in('status', ['queued', 'generating', 'failed'])
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data || []).filter(job => {
    if (job.status === 'generating') {
      // Only the ones whose owner has plainly died.
      return job.claimed_at && (Date.now() - new Date(job.claimed_at).getTime()) > CLAIM_TIMEOUT_MS;
    }
    return true;
  });
}

/** Out of retries and still not generated: the money should go back. */
function isExhausted(job) {
  return Boolean(job) && job.status === 'failed' && job.attempts >= MAX_ATTEMPTS;
}

async function listForPanel({ environment = runtimeEnvironment(), limit = 50 } = {}) {
  const supabase = client();
  const { data, error } = await supabase.from('report_jobs').select('*')
    .eq('environment', environment)
    .neq('status', 'awaiting_payment')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  MAX_ATTEMPTS, CLAIM_TIMEOUT_MS, runtimeEnvironment,
  create, get, getByGatewayOrder, update, attachOrder,
  markPaid, claim, markGenerated, markFailed, markRefunded, recordDelivery,
  pending, isExhausted, listForPanel
};
