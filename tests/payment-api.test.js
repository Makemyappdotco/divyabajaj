const { BASE } = require('./base');
// Run against the local harness in /tmp/bookpreview, which stubs Razorpay's
// outbound call but keeps the real signature maths. Needs RAZORPAY_KEY_SECRET
// and RAZORPAY_WEBHOOK_SECRET set to whatever the harness uses.
// Security-focused tests for the Razorpay integration. These run against the
// REAL paymentRoutes.js with Razorpay's HTTP call stubbed - the point is the
// trust boundary, not Razorpay's own API.
const crypto = require('crypto');
const B = `${BASE}`;
const post = (p, body, headers) => fetch(B + p, { method:'POST',
  headers: Object.assign({'Content-Type':'application/json'}, headers||{}),
  body: typeof body === 'string' ? body : JSON.stringify(body) })
  .then(async r => ({ status: r.status, body: await r.json().catch(()=>({})) }));
const get = p => fetch(B + p).then(r => r.json());
let pass = 0, fail = 0;
const check = (l, ok, d='') => { ok?pass++:fail++; console.log(`${ok?'PASS':'FAIL'}  ${l}${ok?'':'  <- '+d}`); };

const SECRET = process.env.RAZORPAY_KEY_SECRET;
const sign = (o, p) => crypto.createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');

(async () => {
  await fetch(B + '/__reset', { method:'POST' });

  // book a real appointment first
  const av = await get('/api/booking/availability?days=21');
  const slot = av.days[0].slots[0];
  const h = await post('/api/booking/hold', { slot_key:slot.slot_key, starts_at:slot.starts_at, ends_at:slot.ends_at });
  const booking = await post('/api/booking/book', { hold_id:h.body.hold_id, slot_key:slot.slot_key,
    name:'Pay Test', phone:'9812345678', email:'pay@example.com', dob:'1993-07-14', pob:'Pune' });
  check('booking created and awaiting payment', booking.status===200 && booking.body.next_step==='payment', JSON.stringify(booking.body));
  const apptId = booking.body.appointment_id;

  console.log('\n--- the amount cannot come from the browser ---');
  const order = await post('/api/booking/payment/order', { appointment_id: apptId, amount: 100, amount_paise: 100 });
  check('order created', order.status===200, JSON.stringify(order.body));
  check('server prices it at 4999, ignoring the amount the client sent', order.body.amount===499900, String(order.body.amount));
  check('only the publishable key reaches the browser', /^rzp_(test|live)_/.test(order.body.key_id||''), order.body.key_id);
  check('the secret is never in the response', !JSON.stringify(order.body).includes(SECRET));

  console.log('\n--- one order per booking ---');
  const again = await post('/api/booking/payment/order', { appointment_id: apptId });
  check('re-opening checkout reuses the same order', again.body.order_id === order.body.order_id, again.body.order_id + ' vs ' + order.body.order_id);

  console.log('\n--- paying for something that is not yours / not payable ---');
  const ghost = await post('/api/booking/payment/order', { appointment_id: 'appt_doesnotexist' });
  check('unknown appointment is rejected', ghost.status===404, JSON.stringify(ghost.body));

  console.log('\n--- signature verification ---');
  const orderId = order.body.order_id;
  const payId = 'pay_TESTPAYMENT123';

  const forged = await post('/api/booking/payment/verify', {
    razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: 'f'.repeat(64) });
  check('a forged signature is rejected', forged.status===400, JSON.stringify(forged.body));
  let st = await get('/__state');
  check('and the booking is NOT confirmed by it', st.appointments[0].status==='pending_payment', st.appointments[0].status);

  const missing = await post('/api/booking/payment/verify', { razorpay_order_id: orderId });
  check('missing fields are rejected', missing.status===400, JSON.stringify(missing.body));

  const wrongOrder = await post('/api/booking/payment/verify', {
    razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sign('order_SOMETHINGELSE', payId) });
  check('a signature for a different order is rejected', wrongOrder.status===400, JSON.stringify(wrongOrder.body));

  const good = await post('/api/booking/payment/verify', {
    razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sign(orderId, payId) });
  check('a genuine signature is accepted', good.status===200, JSON.stringify(good.body));
  st = await get('/__state');
  check('and the booking becomes confirmed', st.appointments[0].status==='confirmed', st.appointments[0].status);
  check('an audit row records who confirmed it', st.history.some(x=>x.to_status==='confirmed'&&/razorpay/.test(x.reason||'')), JSON.stringify(st.history.map(x=>x.to_status)));

  console.log('\n--- replaying a valid payment is harmless ---');
  const replay = await post('/api/booking/payment/verify', {
    razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sign(orderId, payId) });
  st = await get('/__state');
  check('replay still succeeds and does not double-confirm', replay.status===200 && st.appointments.filter(a=>a.status==='confirmed').length===1);

  console.log('\n--- a paid booking cannot be re-charged ---');
  const paidAgain = await post('/api/booking/payment/order', { appointment_id: apptId });
  check('ordering again for a paid booking is refused', paidAgain.status===409, JSON.stringify(paidAgain.body));

  console.log('\n--- webhook ---');
  const evt = JSON.stringify({ event:'payment.captured', payload:{ payment:{ entity:{ id:'pay_WEBHOOK1', order_id: orderId } } } });
  const bad = await post('/api/booking/payment/webhook', evt, { 'x-razorpay-signature':'deadbeef', 'x-razorpay-event-id':'evt_1' });
  check('a webhook with a bad signature is rejected', bad.status===400, JSON.stringify(bad.body));

  const whSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const whSig = crypto.createHmac('sha256', whSecret).update(evt).digest('hex');
  const okHook = await post('/api/booking/payment/webhook', evt, { 'x-razorpay-signature':whSig, 'x-razorpay-event-id':'evt_1' });
  check('a correctly signed webhook is accepted', okHook.status===200, JSON.stringify(okHook.body));
  const dupe = await post('/api/booking/payment/webhook', evt, { 'x-razorpay-signature':whSig, 'x-razorpay-event-id':'evt_1' });
  check('a repeated webhook is recognised as a duplicate', dupe.body.duplicate===true, JSON.stringify(dupe.body));

  console.log(`\n${fail===0?'ALL CHECKS PASSED':fail+' FAILED'} (${pass} passed)`);
  process.exitCode = fail===0?0:1;
})();
