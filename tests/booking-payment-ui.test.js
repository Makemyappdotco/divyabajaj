// The consultation booking screen (both the full page and the modal embedded
// elsewhere on the site) used to show the same green checkmark and "Your slot
// is reserved" heading whether the booking succeeded outright OR a Razorpay
// payment attempt had just failed. A customer who watched Razorpay say
// "Payment failed" would then land on a screen that looked identical to
// success - nothing distinguished "we never tried to charge you, message
// Divya to pay" from "we tried to charge you and it did not work".
//
// The fix gives showDone() a third state, 'failed', with its own icon and
// heading, and makes every failure branch inside pay() use it. This asserts
// that at the source level, since these are plain browser scripts with no
// DOM test harness in this project.

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : '  <- ' + detail}`); };

function payBlock(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error('could not find ' + startMarker);
  // Up to the closing of the pay() function - the next top-level "function "
  // after it, which is far enough for both files' remaining structure.
  const rest = source.slice(start);
  const nextFn = rest.indexOf('\n  function ', 10);
  return nextFn > -1 ? rest.slice(0, nextFn) : rest;
}

[
  { file: 'public/consultation.html', payMarker: 'function pay(booking)', showDoneMarker: 'function showDone(' },
  { file: 'public/booking-modal.js', payMarker: 'function pay(booking)', showDoneMarker: 'function showDone(' }
].forEach(({ file, payMarker, showDoneMarker }) => {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const pay = payBlock(source, payMarker);
  const showDone = payBlock(source, showDoneMarker);

  console.log(`\n--- ${file} ---`);

  check('showDone() takes a status, not a boolean',
    /function showDone\(d, status, note\)/.test(showDone), 'signature changed shape');

  check('a failed payment never gets the checkmark used for real success',
    /failed \? '!' /.test(showDone) || /failed \? "!" /.test(showDone),
    'the tick glyph is not conditioned on the failed flag');

  check('a failed payment gets its own heading, distinct from "reserved" and "booked"',
    /'Payment not completed'/.test(showDone));

  check('the warn class is toggled by the failed flag, so CSS can style it differently',
    /classList\.toggle\('warn', failed\)/.test(showDone));

  // Exactly one call inside pay() is the true success path (the verify
  // handler's .then). Every other call - verify-catch, dismiss, payment.failed,
  // checkout-open-catch - is a way the attempt did NOT succeed, and must use
  // 'failed', never silently 'held' or 'paid'.
  const showDoneCallsInPay = pay.match(/showDone\(booking,\s*'(\w+)'/g) || [];
  check('pay() calls showDone() at least 4 times (verify-catch, dismiss, payment.failed, checkout-open-catch)',
    showDoneCallsInPay.length >= 4, showDoneCallsInPay.join(', '));
  check('exactly one call inside pay() is the real success path ("paid")',
    showDoneCallsInPay.filter(c => c.includes("'paid'")).length === 1,
    showDoneCallsInPay.join(', '));
  check('every non-success call inside pay() uses status "failed", none silently succeed as "held"',
    showDoneCallsInPay.filter(c => !c.includes("'paid'")).every(c => c.includes("'failed'")),
    showDoneCallsInPay.filter(c => !c.includes("'paid'") && !c.includes("'failed'")).join(', '));

  check('no call site inside pay() still passes the old boolean form',
    !/showDone\(booking,\s*(true|false)\s*[,)]/.test(pay));

  // The one case where money may already have moved (verify() rejects after a
  // successful Razorpay handler) must not tell the customer they were not
  // charged, and must not invite a retry - both would risk a double charge.
  const verifyCatch = pay.slice(pay.indexOf('.then(function () { showDone(booking'), pay.indexOf("modal: {"));
  check('the verify-failed branch never claims "not been charged"',
    !/not been charged/.test(verifyCatch), verifyCatch);
  check('the verify-failed branch never says "try again"',
    !/try again/.test(verifyCatch), verifyCatch);
  check('the verify-failed branch tells them to message and not pay again',
    /do not pay again/.test(verifyCatch));

  // The two genuine no-charge cases (dismissed, card declined) SHOULD say so,
  // since it is true there and reassures the customer.
  const dismissAndFailed = pay.slice(pay.indexOf('ondismiss:'), pay.indexOf('checkout.open()'));
  check('the dismiss/decline branches do say the customer was not charged',
    (dismissAndFailed.match(/not been charged/g) || []).length >= 2, dismissAndFailed);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
