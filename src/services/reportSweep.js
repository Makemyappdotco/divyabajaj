// The safety net for people who paid and then closed the tab.
//
// The browser is the fast path: pay, and generation starts in the same breath.
// But a customer can pay and shut their laptop, or the platform can kill a
// function that has been generating for five minutes. Either way money has
// moved and no report exists, and nothing in the browser is ever coming back
// to fix it.
//
// So this runs on a schedule. It picks up anything paid and unfinished,
// retries it, and - once the retries are spent - refunds the payment rather
// than quietly keeping money for a report that was never delivered.

const jobs = require('./reportJobs');
const razorpay = require('./razorpay');
const db = require('../database');

// Room to breathe between attempts, so a provider having a bad minute is not
// hammered three times inside that minute and marked permanently broken.
//
// Overridable so the tests can drive three attempts and a refund without
// sitting through fifteen real minutes. Production leaves it alone.
const RETRY_BACKOFF_MS = Number(process.env.REPORT_RETRY_BACKOFF_MS) >= 0
  ? Number(process.env.REPORT_RETRY_BACKOFF_MS)
  : 5 * 60 * 1000;

function now() { return new Date().toISOString(); }

function readyForRetry(job) {
  if (job.status !== 'failed') return true;
  const last = new Date(job.updated_at || job.created_at).getTime();
  return Date.now() - last >= RETRY_BACKOFF_MS;
}

/**
 * Hands the money back.
 *
 * Idempotent in two layers: the job's status moves to 'refunded' so a later
 * sweep skips it, and Razorpay itself is only called when there is a payment
 * id and no refund id recorded yet. A double refund is not something you can
 * take back.
 */
async function refund(job) {
  if (job.status === 'refunded' || job.refund_id) return { refunded: false, reason: 'already refunded' };
  if (!job.gateway_payment_id) {
    // Nothing to refund against. Leave it failed and visible in the panel
    // rather than inventing a refund that never happened.
    console.error('[sweep] job exhausted with no payment id', job.id);
    return { refunded: false, reason: 'no payment id' };
  }

  try {
    const created = await razorpay.createRefund(job.gateway_payment_id);
    await jobs.markRefunded(job.id, { refundId: created.id || '' });

    const supabase = db.getSupabaseClient();
    if (supabase && job.order_id) {
      await supabase.from('orders').update({ status: 'refunded', updated_at: now() }).eq('id', job.order_id);
    }
    return { refunded: true, refundId: created.id };
  } catch (error) {
    // A refund that fails must stay loud. The customer is owed money.
    console.error('[sweep] REFUND FAILED for job', job.id, error.message);
    return { refunded: false, reason: error.message };
  }
}

/**
 * One pass.
 *
 * @param {function} runJob injected rather than required, to keep this module
 * free of the route layer and testable on its own.
 */
async function sweep({ runJob, environment, limit = 5 } = {}) {
  const summary = { looked_at: 0, generated: 0, retried: 0, refunded: 0, skipped: 0, errors: [] };

  const pending = await jobs.pending({ environment, limit });
  summary.looked_at = pending.length;

  for (const job of pending) {
    try {
      if (jobs.isExhausted(job)) {
        const result = await refund(job);
        if (result.refunded) summary.refunded += 1;
        else summary.skipped += 1;
        continue;
      }

      if (!readyForRetry(job)) { summary.skipped += 1; continue; }

      const outcome = await runJob(job.id);
      if (!outcome.claimed) { summary.skipped += 1; continue; }
      summary.retried += 1;
      if (outcome.ok) summary.generated += 1;

      // Last attempt just failed: refund now rather than making the customer
      // wait a further five minutes for the next pass.
      if (!outcome.ok) {
        const fresh = await jobs.get(job.id);
        if (jobs.isExhausted(fresh)) {
          const result = await refund(fresh);
          if (result.refunded) summary.refunded += 1;
        }
      }
    } catch (error) {
      console.error('[sweep]', job.id, error.message);
      summary.errors.push({ job_id: job.id, error: error.message });
    }
  }

  return summary;
}

module.exports = { sweep, refund, RETRY_BACKOFF_MS };
