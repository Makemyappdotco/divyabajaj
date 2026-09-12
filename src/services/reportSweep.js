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
const delivery = require('./delivery');

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
    let amountInr = null;
    if (supabase && job.order_id) {
      const order = await supabase.from('orders').select('amount').eq('id', job.order_id).maybeSingle();
      amountInr = order.data ? Number(order.data.amount) : null;
      await supabase.from('orders').update({ status: 'refunded', updated_at: now() }).eq('id', job.order_id);
    }

    // Tell them. Learning about a refund from a bank statement, with no idea
    // why, is worse than the failed report was.
    const payload = job.payload || {};
    await delivery.notifyRefunded({
      environment: job.environment, jobId: job.id,
      name: payload.name, email: payload.email, phone: payload.phone, amountInr
    }).catch(error => console.error('[sweep] refund notice failed', error.message));

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
 * @param {function} deliverJob same, for sending a report that finished
 * generating on an earlier pass and has now waited long enough.
 */
async function sweep({ runJob, deliverJob, environment, limit = 5 } = {}) {
  const summary = { looked_at: 0, generated: 0, retried: 0, refunded: 0, delivered: 0, skipped: 0, errors: [] };

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

  // Second pass: reports that finished generating on an earlier sweep and are
  // now old enough to send. Separate from the loop above because those jobs
  // are already 'generated' - jobs.pending() does not return them at all.
  if (deliverJob) {
    const awaitingDelivery = await jobs.pendingDelivery({ environment, limit });
    for (const job of awaitingDelivery) {
      if (!jobs.dueForDelivery(job)) { summary.skipped += 1; continue; }
      try {
        const outcome = await deliverJob(job.id);
        if (outcome.delivered) summary.delivered += 1;
        else summary.skipped += 1;
      } catch (error) {
        console.error('[sweep:deliver]', job.id, error.message);
        summary.errors.push({ job_id: job.id, error: error.message });
      }
    }
  }

  return summary;
}

module.exports = { sweep, refund, RETRY_BACKOFF_MS };
