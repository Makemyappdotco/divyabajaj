const { BASE } = require('./base');
const crypto = require('crypto');

// Pay before generate.
//
// The four things that must be true, in order of how much they cost if wrong:
//   1. No payment, no report. (Otherwise the ₹999 product is free.)
//   2. One payment, exactly one report - even when the browser and the webhook
//      race each other, which they routinely do.
//   3. A closed tab still gets its report, because the webhook and the sweep
//      finish the job.
//   4. A report that can never be built refunds the money, exactly once.

const SECRET = process.env.RAZORPAY_KEY_SECRET;

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
}

async function j(path, options) {
  const r = await fetch(BASE + path, options);
  const text = await r.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (e) { body = { raw: text }; }
  return { status: r.status, body };
}
const post = (path, body, headers) => j(path, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
  body: JSON.stringify(body)
});

const generator = mode => post('/__generator', mode);
const reset = () => fetch(BASE + '/__reset', { method: 'POST' });

function form(overrides) {
  return Object.assign({
    name: 'Test Customer', gender: 'female', email: 'test@example.com', phone: '9812345678',
    dob: '1992-03-14', tob: '09:45', birth_time_accuracy: 'exact_record',
    pob: 'Pune, India', latitude: 18.5204, longitude: 73.8567, timezone: 5.5,
    timezone_id: 'Asia/Kolkata', country_code: 'IN',
    question: 'career direction and timing'
  }, overrides || {});
}

function sign(orderId, paymentId) {
  return crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

async function checkout(overrides) {
  const res = await post('/api/reports/blueprint/checkout', form(overrides));
  return res.body;
}

async function payFor(order, paymentId) {
  return post('/api/reports/blueprint/verify', {
    razorpay_order_id: order.order_id,
    razorpay_payment_id: paymentId,
    razorpay_signature: sign(order.order_id, paymentId)
  });
}

function webhookFor(orderId, paymentId, eventId) {
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId } } }
  });
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  return fetch(BASE + '/api/booking/payment/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': eventId || ('evt_' + Math.random().toString(16).slice(2))
    },
    body
  }).then(async r => ({ status: r.status, body: await r.json() }));
}

const calls = () => j('/__generator').then(r => r.body.generator.calls);
const refunds = () => j('/__generator').then(r => r.body.refunds);
const status = jobId => j('/api/reports/blueprint/status?job_id=' + jobId).then(r => r.body);

(async () => {
  console.log('\npaid blueprint: pay before generate\n');

  // ------------------------------------------------- 1. the gate itself
  console.log('--- no payment, no report ---');
  await reset();

  const order = await checkout();
  check('checkout returns a Razorpay order', Boolean(order.order_id && order.job_id), JSON.stringify(order));
  check('priced from the panel, in paise', order.amount === 99900, 'amount=' + order.amount);
  check('only the publishable key reaches the browser', String(order.key_id || '').startsWith('rzp_test_'));
  check('the secret is never in the response', !JSON.stringify(order).includes(SECRET));
  check('nothing has been generated yet', (await calls()) === 0);

  const early = await post('/api/reports/blueprint/run', { job_id: order.job_id });
  check('running an unpaid job is refused with 402', early.status === 402, JSON.stringify(early.body));
  check('and still nothing was generated', (await calls()) === 0);

  const peek = await status(order.job_id);
  check('status shows it as unpaid', peek.paid === false && peek.status === 'awaiting_payment', JSON.stringify(peek));

  // ------------------------------------------ a forged payment buys nothing
  const forged = await post('/api/reports/blueprint/verify', {
    razorpay_order_id: order.order_id, razorpay_payment_id: 'pay_forged', razorpay_signature: 'not_a_signature'
  });
  check('a forged signature is rejected', forged.status === 400, JSON.stringify(forged.body));
  check('a forged signature generates nothing', (await calls()) === 0);
  check('and the job is still unpaid', (await status(order.job_id)).status === 'awaiting_payment');

  // ------------------------------------------------- 2. the happy path
  console.log('\n--- paid, then generated ---');
  const paid = await payFor(order, 'pay_ok_1');
  check('a real signature is accepted', paid.status === 200, JSON.stringify(paid.body));
  check('payment only QUEUES the job, it does not generate inline',
    paid.body.status === 'queued' && (await calls()) === 0, 'status=' + paid.body.status + ' calls=' + (await calls()));

  const ran = await post('/api/reports/blueprint/run', { job_id: order.job_id });
  check('run generates the report', ran.body.status === 'generated', JSON.stringify(ran.body));
  check('the generator ran exactly once', (await calls()) === 1);

  const done = await status(order.job_id);
  check('status now carries the report', Boolean(done.report_text), JSON.stringify(done).slice(0, 200));
  check('the report is the customer\'s own', String(done.report_text).includes('Test Customer'));

  const again = await post('/api/reports/blueprint/run', { job_id: order.job_id });
  check('running a finished job does nothing', again.body.already === true && (await calls()) === 1);

  // --------------------------------- 3. one payment, exactly one report
  console.log('\n--- browser and webhook racing ---');
  await reset();
  const race = await checkout({ email: 'race@example.com' });
  const before = await calls();

  // Both arrive at once, which is exactly what happens in production when the
  // customer's browser returns while Razorpay is already calling the webhook.
  const [, ] = await Promise.all([
    payFor(race, 'pay_race'),
    webhookFor(race.order_id, 'pay_race')
  ]);
  await Promise.all([
    post('/api/reports/blueprint/run', { job_id: race.job_id }),
    post('/api/reports/blueprint/run', { job_id: race.job_id }),
    post('/api/reports/blueprint/run', { job_id: race.job_id })
  ]);

  const raceCalls = (await calls()) - before;
  check('three simultaneous runs produced exactly one report', raceCalls === 1, 'generator calls=' + raceCalls);
  check('and the job is generated', (await status(race.job_id)).status === 'generated');

  // ------------------------------- 4. the customer who closed their tab
  console.log('\n--- paid, then closed the tab ---');
  await reset();
  const gone = await checkout({ email: 'gone@example.com' });
  // No verify call at all: the browser never came back. Only Razorpay's
  // webhook knows the money arrived.
  await webhookFor(gone.order_id, 'pay_gone');

  const queued = await status(gone.job_id);
  check('the webhook alone marks it paid', queued.paid === true && queued.status === 'queued', JSON.stringify(queued));
  check('the webhook did NOT generate inline', (await calls()) === 0);

  const swept = await post('/api/internal/report-sweep', {});
  check('the sweep picks it up', swept.body.generated === 1, JSON.stringify(swept.body));
  check('the abandoned customer has their report', (await status(gone.job_id)).status === 'generated');

  // ----------------------------------------- 5. it can never be built
  console.log('\n--- generation keeps failing ---');
  await reset();
  await generator({ mode: 'fail' });
  const doomed = await checkout({ email: 'doomed@example.com' });
  await payFor(doomed, 'pay_doomed');

  const first = await post('/api/reports/blueprint/run', { job_id: doomed.job_id });
  check('the first attempt fails cleanly', first.body.status === 'failed', JSON.stringify(first.body));
  check('the customer is not told it succeeded', first.body.success === false);

  let sweeps = 0;
  // The sweep backs off between attempts; the test drives it directly rather
  // than waiting five minutes per retry.
  while (sweeps < 6 && (await status(doomed.job_id)).status !== 'refunded') {
    await post('/api/internal/report-sweep', {});
    // Clear the backoff so the next pass is allowed to try.
    await post('/__generator', {});
    sweeps += 1;
    const s = await status(doomed.job_id);
    if (s.status === 'refunded') break;
    if (s.attempts >= 3) { await post('/api/internal/report-sweep', {}); }
  }

  const dead = await status(doomed.job_id);
  const given = await refunds();
  check('after the retries are spent the money goes back',
    dead.status === 'refunded' || given.length === 1, 'status=' + dead.status + ' refunds=' + given.length);
  check('refunded exactly once, never twice', given.length <= 1, JSON.stringify(given));
  check('the refund is against the real payment', !given.length || given[0].payment_id === 'pay_doomed', JSON.stringify(given));

  await post('/api/internal/report-sweep', {});
  check('sweeping again does not refund a second time', (await refunds()).length <= 1);

  // ------------------------------------------------ 6. bad input, no charge
  console.log('\n--- broken details are caught before payment ---');
  await reset();
  const bad = await post('/api/reports/blueprint/checkout', form({ dob: 'not-a-date' }));
  check('a bad date of birth is refused before checkout', bad.status === 400, JSON.stringify(bad.body));
  check('and no Razorpay order was created', !bad.body.order_id);

  const noPob = await post('/api/reports/blueprint/checkout', form({ latitude: 'x', longitude: 'x' }));
  check('an unresolved birthplace is refused before checkout', noPob.status === 400, JSON.stringify(noPob.body));

  // ---------------------------------------------- 7. honesty about delivery
  console.log('\n--- what the customer is promised ---');
  const config = await j('/api/reports/blueprint/config');
  check('config reports that nothing can be delivered yet',
    config.body.can_deliver === false, JSON.stringify(config.body));
  check('and names both channels as off',
    config.body.delivery_channels.whatsapp === false && config.body.delivery_channels.email === false);

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
