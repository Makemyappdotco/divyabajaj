// Reproduces the exact bug Dhruv reported: the payment received message
// going out twice, on both WhatsApp and email, for one Full Blueprint sale.
//
// Root cause: markPaid() used to read the job's status, decide in JS whether
// it was still 'awaiting_payment', and only THEN write 'queued' - two
// separate round trips. The browser's /verify call and Razorpay's webhook
// fire within milliseconds of each other, so both could read
// 'awaiting_payment' before either had written 'queued', and both believed
// they were the one that moved the job - so both sent the receipt.
//
// The fix makes the write itself conditional (WHERE status = 'awaiting_payment',
// same pattern claim() already used correctly), so only one of two
// simultaneous callers can ever have their update actually match a row.
//
// This uses a fake Supabase where every operation resolves on a fresh tick
// (setImmediate), specifically so that two concurrent markPaid() calls both
// finish their internal read before either one's conditional write lands -
// the exact interleaving that caused the bug. Without the fix (a plain
// unconditional update after a JS-side check), this test fails because both
// calls come back as winners.
//
//   node tests/paid-report-notify-once.test.js

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  <- ' + detail}`); };

function tick() { return new Promise(resolve => setImmediate(resolve)); }

// Minimal thenable query builder, same style as the fakeSupabase in
// tests/public-hours.test.js: every call returns the builder itself, and the
// builder is the thing that resolves, so any chain shape the real code uses
// works without having to special-case each one.
function fakeReportJobsTable(initialRow) {
  let row = { ...initialRow };

  return {
    from(table) {
      if (table !== 'report_jobs') throw new Error(`unexpected table ${table}`);
      const state = { patch: null, conditions: {}, mode: 'array' };

      const builder = {
        select() { return builder; },
        eq(key, value) { state.conditions[key] = value; return builder; },
        update(patch) { state.patch = patch; return builder; },
        single() { state.mode = 'single'; return builder; },
        maybeSingle() { state.mode = 'maybeSingle'; return builder; },
        then(resolve, reject) {
          return tick().then(() => {
            const matchesAll = Object.entries(state.conditions)
              .every(([key, value]) => row && row[key] === value);

            if (state.patch) {
              // An update: this is the database-side race guard the fix
              // depends on - the patch only applies if the row STILL
              // matches every .eq() condition at the instant this runs.
              if (!matchesAll) {
                return state.mode === 'array' ? { data: [], error: null } : { data: null, error: null };
              }
              row = { ...row, ...state.patch };
              const saved = { ...row };
              return state.mode === 'array' ? { data: [saved], error: null } : { data: saved, error: null };
            }

            // A plain read.
            if (!matchesAll) return { data: state.mode === 'array' ? [] : null, error: null };
            const saved = row ? { ...row } : null;
            return state.mode === 'array' ? { data: saved ? [saved] : [], error: null } : { data: saved, error: null };
          }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

(async () => {
  delete require.cache[require.resolve('../src/database')];
  delete require.cache[require.resolve('../src/services/reportJobs')];
  const db = require('../src/database');
  const originalGetClient = db.getSupabaseClient;

  const table = fakeReportJobsTable({
    id: 'rjb_test1', status: 'awaiting_payment', gateway_payment_id: '', paid_at: null
  });
  db.getSupabaseClient = () => table;

  const jobs = require('../src/services/reportJobs');

  try {
    // Simulates the browser's /verify and Razorpay's webhook calling
    // markPaid() for the same job at essentially the same instant.
    const [fromVerify, fromWebhook] = await Promise.all([
      jobs.markPaid('rjb_test1', { paymentId: 'pay_from_browser' }),
      jobs.markPaid('rjb_test1', { paymentId: 'pay_from_webhook' })
    ]);

    const winners = [fromVerify, fromWebhook].filter(Boolean);

    check('exactly one of the two simultaneous callers wins the race',
      winners.length === 1, `got ${winners.length} winners`);
    check('the loser gets null, so notifyFirstPaid (if (!queued) return) never fires for it',
      (fromVerify === null) !== (fromWebhook === null));

    const finalRow = await jobs.get('rjb_test1');
    check('the job actually ended up queued', finalRow.status === 'queued', finalRow.status);
    check('paid_at got set exactly once', Boolean(finalRow.paid_at));
  } finally {
    db.getSupabaseClient = originalGetClient;
    delete require.cache[require.resolve('../src/services/reportJobs')];
  }
})().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
