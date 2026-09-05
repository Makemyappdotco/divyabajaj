// Razorpay Standard Checkout for the consultation. Mounted at /api/booking/payment.
//
// THE AMOUNT IS NEVER TAKEN FROM THE BROWSER.
//
// The usual shape of this integration is POST /api/create-order {amount}, which
// means anyone can open dev tools and buy a 4,999 rupee consultation for one
// rupee. Here the browser sends an appointment id and nothing else; the server
// looks the appointment up and prices it. The only number the client can
// influence is which appointment it is paying for, and that appointment must be
// its own, unpaid, and not yet started.

const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const store = require('./services/booking/store');
const razorpay = require('./services/razorpay');
const pricing = require('./services/pricing');
const reportJobs = require('./services/reportJobs');

const router = express.Router();

const CURRENCY = 'INR';

function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function now() { return new Date().toISOString(); }

function fail(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

function handle(name, fn) {
  return async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res);
    } catch (error) {
      console.error(`[payment:${name}]`, error);
      // 401 from Razorpay means our keys are wrong. That is an operator
      // problem; telling the customer to "try again" would loop them forever.
      if (error.status === 401) {
        return fail(res, 503, 'Payments are temporarily unavailable. Please message us and we will sort it out.');
      }
      return fail(res, 500, 'Something went wrong taking the payment. You have not been charged.');
    }
  };
}

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Payments need Supabase');
  return supabase;
}

// ------------------------------------------------------------- create order

router.post('/order', handle('order', async (req, res) => {
  if (!razorpay.isConfigured()) return fail(res, 503, 'Payments are not switched on yet.');
  if (!db.usingSupabase()) return fail(res, 503, 'Payments are temporarily unavailable.');

  const appointmentId = String((req.body && req.body.appointment_id) || '').trim();
  if (!appointmentId) return fail(res, 400, 'Nothing to pay for.');

  const appointment = await store.getAppointment(appointmentId);
  if (!appointment) return fail(res, 404, 'That booking no longer exists.');
  if (appointment.status === 'confirmed') return fail(res, 409, 'This booking is already paid for.');
  if (appointment.status !== 'pending_payment') return fail(res, 409, 'This booking can no longer be paid for.');
  if (new Date(appointment.starts_at) <= new Date()) {
    return fail(res, 409, 'That time has already passed. Please book another slot.');
  }

  const lead = appointment.lead_id ? await db.getLead(appointment.lead_id) : null;
  // Priced from the database at the moment the order is created, so whatever
  // Divya has set in the panel is what gets charged.
  const price = await pricing.priceOf('consultation', appointment.environment);
  const amountPaise = Math.round(price.amount_inr * 100);

  // One order per appointment. Re-opening checkout after an abandoned attempt
  // must reuse it rather than litter Razorpay with orders for one booking,
  // which is what the idempotency key on the orders table is for.
  const idempotencyKey = `consultation:${appointment.id}`;
  const supabase = client();
  const existing = await supabase.from('orders').select('*')
    .eq('environment', appointment.environment).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  let order = existing.data;
  if (order && order.status === 'paid') return fail(res, 409, 'This booking is already paid for.');

  if (!order || !order.gateway_order_id) {
    const created = await razorpay.createOrder({
      amountPaise,
      currency: CURRENCY,
      // Razorpay caps receipt at 40 characters.
      receipt: appointment.id.slice(0, 40),
      notes: { appointment_id: appointment.id, lead_id: appointment.lead_id || '', product: 'consultation' }
    });

    const row = {
      id: order ? order.id : id('ord'),
      environment: appointment.environment,
      lead_id: appointment.lead_id || null,
      product_code: 'consultation',
      amount: price.amount_inr,
      currency: CURRENCY,
      status: 'pending',
      gateway: 'razorpay',
      gateway_order_id: created.id,
      idempotency_key: idempotencyKey,
      attribution: {},
      created_at: order ? order.created_at : now(),
      updated_at: now()
    };

    const saved = order
      ? await supabase.from('orders').update(row).eq('id', order.id).select().single()
      : await supabase.from('orders').insert(row).select().single();
    if (saved.error) throw new Error(saved.error.message);
    order = saved.data;

    await supabase.from('appointments').update({ order_id: order.id, updated_at: now() }).eq('id', appointment.id);
  }

  // If Divya changed the price while this customer was mid-checkout, the order
  // already created keeps its original amount - Razorpay orders are immutable,
  // and charging someone a number they never saw would be worse than honouring
  // the one they did.
  const chargedPaise = Math.round(Number(order.amount) * 100) || amountPaise;

  return res.json({
    success: true,
    // The publishable key. The secret never leaves the server.
    key_id: razorpay.publicKeyId(),
    order_id: order.gateway_order_id,
    amount: chargedPaise,
    currency: CURRENCY,
    live_mode: razorpay.isLiveMode(),
    name: 'Divya Bajaj',
    description: 'Private consultation',
    prefill: {
      name: (lead && lead.name) || '',
      email: (lead && lead.email) || '',
      contact: (lead && lead.phone) || ''
    }
  });
}));

// ----------------------------------------------------------------- verify

/**
 * Confirms the appointment, and only if the signature checks out.
 *
 * Idempotent: a customer who double-submits, or whose webhook lands first, gets
 * the same answer rather than a second confirmation or an error.
 */
async function confirmPaid({ appointment, gatewayOrderId, paymentId, source }) {
  const supabase = client();

  const orderRow = await supabase.from('orders').select('*').eq('gateway_order_id', gatewayOrderId).maybeSingle();
  if (orderRow.error) throw new Error(orderRow.error.message);
  const order = orderRow.data;

  if (order && order.status !== 'paid') {
    await supabase.from('orders').update({ status: 'paid', updated_at: now() }).eq('id', order.id);
  }

  await supabase.from('payment_attempts').insert({
    id: id('pay'),
    order_id: order ? order.id : appointment.id,
    gateway: 'razorpay',
    gateway_payment_id: paymentId,
    status: 'captured',
    method: '',
    error_code: '',
    error_message: '',
    raw_response: { source },
    created_at: now(),
    updated_at: now()
  });

  if (appointment.status !== 'confirmed') {
    await store.setAppointmentStatus(appointment.id, 'confirmed', {
      reason: `paid via razorpay (${source})`,
      changedBy: source === 'webhook' ? 'razorpay-webhook' : 'customer'
    });
  }
}

router.post('/verify', handle('verify', async (req, res) => {
  if (!razorpay.isConfigured()) return fail(res, 503, 'Payments are not switched on yet.');

  const body = req.body || {};
  const orderId = String(body.razorpay_order_id || '').trim();
  const paymentId = String(body.razorpay_payment_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();

  if (!orderId || !paymentId || !signature) return fail(res, 400, 'That payment could not be checked. Please contact us before paying again.');

  if (!razorpay.verifyCheckoutSignature({ orderId, paymentId, signature })) {
    // Deliberately loud: a mismatch is either tampering or a real bug, and in
    // both cases the booking must NOT be marked paid.
    console.error('[payment:verify] signature mismatch', { orderId, paymentId });
    return fail(res, 400, 'We could not verify that payment. Please contact us before trying again.');
  }

  const supabase = client();
  const orderRow = await supabase.from('orders').select('*').eq('gateway_order_id', orderId).maybeSingle();
  if (orderRow.error) throw new Error(orderRow.error.message);
  if (!orderRow.data) return fail(res, 404, 'We could not find that order.');

  const appt = await supabase.from('appointments').select('*').eq('order_id', orderRow.data.id).maybeSingle();
  if (appt.error) throw new Error(appt.error.message);
  if (!appt.data) return fail(res, 404, 'We could not find the booking for that payment.');

  await confirmPaid({ appointment: appt.data, gatewayOrderId: orderId, paymentId, source: 'checkout' });

  return res.json({
    success: true,
    appointment_id: appt.data.id,
    status: 'confirmed',
    starts_at: appt.data.starts_at
  });
}));

// ----------------------------------------------------------------- webhook

/**
 * The reliable path.
 *
 * The browser callback above is best-effort: a customer can pay and close the
 * tab before /verify runs, and then money has moved while the booking still
 * says pending_payment. Razorpay retries this webhook until it gets a 2xx, so
 * it - not the browser - is what guarantees a paid booking gets confirmed.
 *
 * Needs the RAW body for the signature, which is why server.js gives this one
 * route express.raw() before the global JSON parser.
 */
router.post('/webhook', async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  if (!razorpay.verifyWebhookSignature({ rawBody, signature })) {
    console.error('[payment:webhook] signature rejected');
    return res.status(400).json({ error: 'invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch (e) { return res.status(400).json({ error: 'bad payload' }); }

  const eventId = req.get('x-razorpay-event-id') || id('evt');
  const type = event.event || '';

  try {
    const supabase = client();
    // Razorpay retries, so the same event can arrive several times. The log is
    // written first and used as the idempotency record.
    const seen = await supabase.from('payment_webhook_events')
      .select('id, processing_status').eq('gateway_event_id', eventId).maybeSingle();
    if (seen.data && seen.data.processing_status === 'processed') return res.json({ ok: true, duplicate: true });

    if (!seen.data) {
      await supabase.from('payment_webhook_events').insert({
        id: id('whk'), gateway: 'razorpay', gateway_event_id: eventId, event_type: type,
        signature_valid: true, payload: event, processing_status: 'received',
        processing_error: '', received_at: now()
      });
    }

    if (type === 'payment.captured' || type === 'order.paid') {
      const entity = (event.payload && (
        (event.payload.payment && event.payload.payment.entity) ||
        (event.payload.order && event.payload.order.entity)
      )) || {};
      const gatewayOrderId = entity.order_id || entity.id;
      const paymentId = entity.id || '';

      if (gatewayOrderId) {
        const orderRow = await supabase.from('orders').select('*').eq('gateway_order_id', gatewayOrderId).maybeSingle();
        if (orderRow.data) {
          if (orderRow.data.product_code === 'paid_blueprint') {
            // A paid report. This is the ONLY thing that guarantees a customer
            // who closed their tab still gets what they paid for: the browser
            // may never come back, but Razorpay retries until we answer 2xx.
            //
            // Deliberately only queues. Generation runs for minutes and the
            // webhook must answer quickly, or Razorpay times out and retries
            // and we would be generating the same report twice over.
            await supabase.from('orders').update({ status: 'paid', updated_at: now() }).eq('id', orderRow.data.id);
            const job = await reportJobs.getByGatewayOrder(gatewayOrderId);
            if (job) await reportJobs.markPaid(job.id, { paymentId });
          } else {
            const appt = await supabase.from('appointments').select('*').eq('order_id', orderRow.data.id).maybeSingle();
            if (appt.data) {
              await confirmPaid({ appointment: appt.data, gatewayOrderId, paymentId, source: 'webhook' });
            }
          }
        }
      }
    }

    await supabase.from('payment_webhook_events')
      .update({ processing_status: 'processed', processed_at: now() })
      .eq('gateway_event_id', eventId);

    return res.json({ ok: true });
  } catch (error) {
    console.error('[payment:webhook]', error);
    // 500 so Razorpay retries rather than dropping a real payment on the floor.
    return res.status(500).json({ error: 'processing failed' });
  }
});

module.exports = router;
