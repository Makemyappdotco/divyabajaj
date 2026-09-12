// The Full Blueprint used to arrive on WhatsApp and email within a few
// minutes of paying - generation finished, and delivery happened in the same
// breath, in the same function call. The landing page promises a reading
// Divya prepares personally; a report that lands minutes after payment reads
// as automated no matter what the copy says.
//
// The fix: generation and delivery are now separate steps. Generation still
// happens promptly (so there is time to retry a failure). Delivery is held
// until jobs.dueForDelivery() says enough time has passed since payment - by
// default an hour - and a page reload or a closed tab must never reveal the
// finished report early either.
//
// jobs.dueForDelivery() is pure (no database), so it is tested directly.
// Everything downstream of it - runJob() no longer delivering inline, the
// sweep's separate delivery pass, the frontend no longer polling for and
// revealing the report - is asserted at the source level, the same way
// pdf-download.test.js and booking-payment-ui.test.js do for changes that
// have no isolated unit to call (this project's paid-report flow needs a real
// Supabase-backed harness to exercise end to end; see paid-report.test.js).

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  <- ' + detail}`); };

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

console.log('\nreport delivery delay\n');

// ------------------------------------------------------- dueForDelivery()

(() => {
  // Isolated so REPORT_DELIVERY_DELAY_MS overrides below cannot leak into
  // other suites run in the same process (run-all.sh runs each in a fresh
  // node invocation, but this file may also be run alone).
  delete require.cache[require.resolve('../src/services/reportJobs')];
  const jobs = require('../src/services/reportJobs');

  check('the default delay is an hour', jobs.DELIVERY_DELAY_MS === 60 * 60 * 1000,
    String(jobs.DELIVERY_DELAY_MS));

  const hourAgo = new Date(Date.now() - 61 * 60 * 1000).toISOString();
  const justNow = new Date(Date.now() - 60 * 1000).toISOString();

  check('a job paid over an hour ago is due',
    jobs.dueForDelivery({ paid_at: hourAgo }) === true);
  check('a job paid a minute ago is not due',
    jobs.dueForDelivery({ paid_at: justNow }) === false);
  check('a job with no paid_at at all is treated as due rather than held forever',
    jobs.dueForDelivery({ paid_at: null }) === true);
  check('a job with no paid_at field is treated as due rather than held forever',
    jobs.dueForDelivery({}) === true);
})();

(() => {
  delete require.cache[require.resolve('../src/services/reportJobs')];
  process.env.REPORT_DELIVERY_DELAY_MS = '0';
  const jobs = require('../src/services/reportJobs');
  check('REPORT_DELIVERY_DELAY_MS=0 makes a job paid this instant already due',
    jobs.dueForDelivery({ paid_at: new Date().toISOString() }) === true);
  delete process.env.REPORT_DELIVERY_DELAY_MS;
  delete require.cache[require.resolve('../src/services/reportJobs')];
})();

// --------------------------------------------------- runJob() no longer
// delivers inline - it only reaches deliverJob() through dueForDelivery().

(() => {
  const source = read('src/paidReportRoutes.js');
  const runJob = source.slice(source.indexOf('async function runJob'), source.indexOf('async function deliverJob'));
  const deliverJob = source.slice(source.indexOf('async function deliverJob'));

  check('runJob() checks dueForDelivery before ever delivering',
    /jobs\.dueForDelivery\(claimed\)/.test(runJob));
  check('runJob() does not call delivery.deliverReport directly anymore',
    !/delivery\.deliverReport/.test(runJob), runJob);
  check('runJob() routes through deliverJob() instead',
    /deliverJob\(claimed\.id\)/.test(runJob));
  check('deliverJob() is the only place that calls delivery.deliverReport',
    /delivery\.deliverReport/.test(deliverJob));
  check('deliverJob() refuses to re-send an already-delivered report unless forced',
    /already delivered/.test(deliverJob) && /force/.test(deliverJob));
  check('deliverJob() is exported for the sweep and the admin resend button to use',
    /module\.exports\.deliverJob = deliverJob/.test(source));

  // Divya should hear about a sale immediately, not an hour later when the
  // report finally goes out - that decoupling is the point of this whole
  // change, so /verify must notify her, not runJob()/deliverJob().
  const verify = source.slice(source.indexOf("router.post('/verify'"), source.indexOf('// ----------------------------------------------------------------------- run'));
  check('the owner is notified at payment time, not delivery time',
    /delivery\.notifyOwner/.test(verify));
  check('runJob() no longer notifies the owner (moved to /verify)',
    !/notifyOwner/.test(runJob));
})();

// ------------------------------------------------------------- the sweep

(() => {
  const source = read('src/services/reportSweep.js');
  check('sweep() accepts an injected deliverJob',
    /async function sweep\(\{[^}]*deliverJob/.test(source));
  check('sweep() looks at jobs.pendingDelivery for reports waiting to go out',
    /jobs\.pendingDelivery/.test(source));
  check('sweep() checks dueForDelivery before calling deliverJob, does not just fire on a timer',
    /jobs\.dueForDelivery\(job\)/.test(source));

  const wiring = read('src/server.js');
  check('server.js wires deliverJob into the sweep call, not just runJob',
    /reportSweep\.sweep\(\{[^}]*deliverJob:\s*paidReportRoutes\.deliverJob/.test(wiring));
})();

// --------------------------------------------------------- the copy itself

(() => {
  const messages = read('src/services/messages.js');
  const paymentReceived = messages.slice(
    messages.indexOf('function paymentReceivedEmail'),
    messages.indexOf('function paymentReceivedEmail') + 1500
  );
  check('the payment-received email no longer promises it "as soon as it is ready"',
    !/as soon as it is ready/.test(paymentReceived), paymentReceived);
  check('the payment-received email no longer says "a few minutes"',
    !/few minutes/.test(paymentReceived), paymentReceived);
  check('the payment-received email says the honest thing: within the hour',
    /within the hour/.test(paymentReceived));
})();

// --------------------------------------------------------- the frontend

(() => {
  const source = read('public/paid-live-flow.js');
  // Up to the function's own closing brace, not the explanatory comment that
  // follows it - that comment mentions pollStatus() by name on purpose, to
  // say it is no longer called, which would otherwise read as a false match.
  const start = source.indexOf('async function confirmPayment');
  const confirmPayment = source.slice(start, source.indexOf('\n  }\n', start) + 5);
  check('confirmPayment() no longer starts the fake progress ticker',
    !/startProgress\(\)/.test(confirmPayment), confirmPayment);
  check('confirmPayment() no longer calls pollStatus() to reveal the report on this page',
    !/[^\/\s]pollStatus\(\)/.test(confirmPayment) && !confirmPayment.includes('pollStatus();'),
    confirmPayment);
  check('confirmPayment() still kicks off generation in the background',
    /reports\/blueprint\/run/.test(confirmPayment));
  check('the waiting copy says the report is prepared personally within the hour',
    /waitingCopy/.test(confirmPayment));

  const waitingCopySource = source.slice(source.indexOf('function waitingCopy'), source.indexOf('function submitReport'));
  check('waitingCopy() promises the hour, not instant arrival',
    /within the hour/.test(waitingCopySource));
  check('waitingCopy() no longer says the report "takes a few minutes"',
    !/few minutes/.test(waitingCopySource), waitingCopySource);
})();

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
