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
  // change, so whichever of /verify or the webhook first moves the job out
  // of awaiting_payment must notify her, not runJob()/deliverJob().
  const notifyFirstPaid = source.slice(
    source.indexOf('async function notifyFirstPaid'),
    source.indexOf("router.post('/verify'")
  );
  const verify = source.slice(source.indexOf("router.post('/verify'"), source.indexOf('// ----------------------------------------------------------------------- run'));

  check('notifyFirstPaid() is the one place that sends the receipt and the owner alert',
    /delivery\.notifyOwner/.test(notifyFirstPaid) && /delivery\.notifyPaymentReceived/.test(notifyFirstPaid));
  check('notifyFirstPaid() only fires on the transition out of awaiting_payment, never on a duplicate call',
    /previousStatus === 'awaiting_payment'/.test(notifyFirstPaid) && /queued\.status === 'queued'/.test(notifyFirstPaid));
  check('/verify calls notifyFirstPaid() instead of notifying inline',
    /notifyFirstPaid\(\{\s*job,\s*previousStatus:\s*job\.status,\s*queued\s*\}\)/.test(verify));
  check('runJob() no longer notifies the owner (moved to notifyFirstPaid)',
    !/notifyOwner/.test(runJob));
  check('notifyFirstPaid is exported so the webhook path can share it',
    /module\.exports\.notifyFirstPaid = notifyFirstPaid/.test(source));
})();

// --------------------------------------------------- the webhook backstop
// notifies too, not only the browser's /verify call. A customer who pays and
// closes the tab before /verify ever runs used to get no receipt, and Divya
// got no sale alert, even though the webhook still queued and generated
// their report - the report existed and nobody was told. This is that fix.

(() => {
  const source = read('src/paymentRoutes.js');
  check('paymentRoutes.js requires paidReportRoutes to reach notifyFirstPaid',
    /require\(['"]\.\/paidReportRoutes['"]\)/.test(source));

  const webhook = source.slice(source.indexOf("router.post('/webhook'"));
  check('the webhook captures the job status BEFORE calling markPaid',
    /previousStatus\s*=\s*job\.status/.test(webhook));
  check('the webhook calls notifyFirstPaid so a webhook-only payment still gets a receipt and an owner alert',
    /paidReportRoutes\.notifyFirstPaid\(\{\s*job,\s*previousStatus,\s*queued\s*\}\)/.test(webhook));
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

// --------------------------------------------------- something has to call
// the sweep. The route existing is not enough - Vercel only runs it on a
// schedule if vercel.json actually declares that schedule. Without this a
// generated report can sit finished and undelivered forever: nothing else
// in this codebase ever calls /api/internal/report-sweep.

(() => {
  const vercelConfig = JSON.parse(read('vercel.json'));
  const crons = vercelConfig.crons || [];
  const sweepCron = crons.find(c => c.path === '/api/internal/report-sweep');

  check('vercel.json declares a Cron Job that actually calls the report sweep',
    Boolean(sweepCron), JSON.stringify(crons));
  check('the sweep cron has a schedule string set',
    Boolean(sweepCron && typeof sweepCron.schedule === 'string' && sweepCron.schedule.trim()));
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
  check('confirmPayment() shows the full success popup on both the happy path and the "money moved but confirm failed" path',
    (confirmPayment.match(/showPaymentSuccess\(/g) || []).length === 2, confirmPayment);

  const waitingCopySource = source.slice(source.indexOf('function waitingCopy'), source.indexOf('function supportWhatsappLink'));
  check('waitingCopy() promises the hour, not instant arrival',
    /within the hour/.test(waitingCopySource));
  check('waitingCopy() no longer says the report "takes a few minutes"',
    !/few minutes/.test(waitingCopySource), waitingCopySource);
  check('waitingCopy() never tells the customer to keep the page open',
    !/keep this page open/.test(waitingCopySource), waitingCopySource);

  // The payment-confirmation screen: a proper popup (tick, heading, message,
  // a WhatsApp CTA), not just a one-line status message under the button -
  // Dhruv was explicit that the small inline text was not enough on its own.
  const showPaymentSuccessSource = source.slice(source.indexOf('function showPaymentSuccess'), source.indexOf('async function submitReport'));
  check('showPaymentSuccess() defaults to waitingCopy() when no override message is given',
    /message \|\| waitingCopy\(\)/.test(showPaymentSuccessSource), showPaymentSuccessSource);
  check('showPaymentSuccess() hides the form and shows the dedicated success view',
    /dbpForm.*display\s*=\s*.none./s.test(showPaymentSuccessSource) && /dbpSuccess.*classList\.add\(.show.\)/s.test(showPaymentSuccessSource),
    showPaymentSuccessSource);
  check('showPaymentSuccess() points the WhatsApp button at a real support link',
    /dbpSuccessWhatsapp.*\.href\s*=\s*supportWhatsappLink\(\)/.test(showPaymentSuccessSource), showPaymentSuccessSource);

  check('the modal markup includes a WhatsApp CTA in the success view',
    /id="dbpSuccessWhatsapp"/.test(source) && /wa\.me/.test(source));

  // Closing the popup must never be blocked - not by "still generating", not
  // by "we cannot message you yet". Money moving or a report still being
  // written is never a reason to trap someone on this page.
  const closeModalSource = source.slice(source.indexOf('function closeModal'), source.indexOf('function formatDate'));
  check('closeModal() no longer conditions closing on payment/generation/delivery state',
    !/state\.paid/.test(closeModalSource) && !/state\.generating/.test(closeModalSource) && !/can_deliver/.test(closeModalSource),
    closeModalSource);
  check('closeModal() always removes is-open, unconditionally',
    /classList\.remove\(.is-open.\)/.test(closeModalSource), closeModalSource);
})();

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
