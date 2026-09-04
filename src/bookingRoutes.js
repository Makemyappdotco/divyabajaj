// Public booking API. Mounted at /api/booking in server.js.
//
// Separate from routes.js and publicPaidRoutes.js on purpose: nothing here
// touches report generation, PDF rendering or the paid blueprint flow. These
// are the only endpoints in the codebase that write to slot_holds and
// appointments.

const express = require('express');
const store = require('./services/booking/store');
const db = require('./database');

const router = express.Router();

const CONSULTATION_FEE_INR = Number(process.env.CONSULTATION_FEE_INR) || 4999;
const CONSULTATION_MINUTES = Number(process.env.CONSULTATION_MINUTES) || 60;

/**
 * Razorpay is not live yet. Until it is, a booking is created and held as
 * pending_payment and Divya is told to send a payment link - which is exactly
 * what happens today over WhatsApp, except the slot is now actually reserved
 * and nothing is lost. Turning the keys on switches the flow to pay-to-confirm
 * with no further code change.
 */
function paymentsLive() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

function handle(name, fn) {
  return async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res);
    } catch (error) {
      console.error(`[booking:${name}]`, error);
      return fail(res, 500, 'Something went wrong on our side. Please try again in a moment.');
    }
  };
}

function cleanText(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

function validEmail(value) {
  const email = cleanText(value, 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

// ---------------------------------------------------------------- availability

router.get('/availability', handle('availability', async (req, res) => {
  if (!db.usingSupabase()) return fail(res, 503, 'Booking is temporarily unavailable.');

  const days = Math.min(Math.max(Number(req.query.days) || 21, 1), store.MAX_DAYS_AHEAD);
  // Google Calendar busy times are added here once the calendar is connected.
  // Passing an empty list means availability falls back to Divya's own rules
  // rather than the whole page failing when Google is unreachable.
  const result = await store.listAvailability({ days, busy: [] });

  return res.json({
    success: true,
    fee_inr: CONSULTATION_FEE_INR,
    duration_minutes: CONSULTATION_MINUTES,
    hold_minutes: store.HOLD_MINUTES,
    payments_live: paymentsLive(),
    timezone: 'Asia/Kolkata',
    // Says "she has not set her hours yet" rather than "no slots", so an
    // unconfigured environment is distinguishable from a fully booked one.
    configured: result.rules_configured > 0,
    days: groupDays(result.slots)
  });
}));

function groupDays(slots) {
  const byDate = new Map();
  for (const slot of slots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date).push({
      slot_key: slot.slot_key,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      duration_minutes: slot.duration_minutes
    });
  }
  return Array.from(byDate, ([date, items]) => ({ date, slots: items }));
}

// ------------------------------------------------------------------ hold

/**
 * Reserve the slot before asking for any details, so a customer never fills in
 * a form only to be told the slot went while they were typing.
 */
router.post('/hold', handle('hold', async (req, res) => {
  if (!db.usingSupabase()) return fail(res, 503, 'Booking is temporarily unavailable.');

  const slotKey = cleanText(req.body && req.body.slot_key, 100);
  const startsAt = cleanText(req.body && req.body.starts_at, 40);
  const endsAt = cleanText(req.body && req.body.ends_at, 40);
  if (!slotKey || !startsAt || !endsAt) return fail(res, 400, 'Pick a slot first.');

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return fail(res, 400, 'That slot is not valid.');
  }

  // Never trust the slot the browser sends. It is re-derived from Divya's rules
  // here, so a crafted request cannot book 3am or a day she is not working.
  const available = await store.listAvailability({ days: store.MAX_DAYS_AHEAD, busy: [] });
  const match = available.slots.find(slot => slot.slot_key === slotKey);
  if (!match) return fail(res, 409, 'That slot is no longer available. Please pick another.');

  const held = await store.holdSlot({
    slotKey: match.slot_key, startsAt: match.starts_at, endsAt: match.ends_at
  });
  if (!held.ok) return fail(res, 409, 'Someone just took that slot. Please pick another.');

  return res.json({
    success: true,
    hold_id: held.hold.id,
    expires_at: held.hold.expires_at,
    slot: { slot_key: match.slot_key, starts_at: match.starts_at, ends_at: match.ends_at }
  });
}));

// ------------------------------------------------------------------ book

router.post('/book', handle('book', async (req, res) => {
  if (!db.usingSupabase()) return fail(res, 503, 'Booking is temporarily unavailable.');

  const body = req.body || {};
  const holdId = cleanText(body.hold_id, 60);
  const name = cleanText(body.name, 120);
  const phone = validPhone(body.phone);
  const email = validEmail(body.email);
  const slotKey = cleanText(body.slot_key, 100);

  if (!holdId || !slotKey) return fail(res, 400, 'Your slot reservation expired. Please pick a slot again.');
  if (name.length < 2) return fail(res, 400, 'Please enter your name.');
  if (!phone) return fail(res, 400, 'Please enter a valid WhatsApp number.');
  if (!email) return fail(res, 400, 'Please enter a valid email address.');

  // The hold is the authority on what is being booked - not the request body -
  // so a tampered slot_key cannot move the appointment to a different time.
  const supabase = db.getSupabaseClient();
  const holdRow = await supabase.from('slot_holds').select('*').eq('id', holdId).maybeSingle();
  if (holdRow.error) throw new Error(holdRow.error.message);
  const hold = holdRow.data;

  if (!hold || hold.status !== 'active' || new Date(hold.expires_at) <= new Date() || hold.slot_key !== slotKey) {
    return fail(res, 409, `Your ${store.HOLD_MINUTES}-minute hold expired. Please pick a slot again.`);
  }

  const lead = await db.createLead({
    name, phone, email,
    dob: cleanText(body.dob, 20) || null,
    tob: cleanText(body.tob, 20),
    pob: cleanText(body.pob, 200),
    question: cleanText(body.question, 1000),
    source: 'consultation_booking',
    utm_source: cleanText(body.utm_source, 100),
    utm_medium: cleanText(body.utm_medium, 100),
    utm_campaign: cleanText(body.utm_campaign, 100),
    status: 'consultation_requested',
    tier: 'consultation',
    email_consent: true,
    whatsapp_consent: true,
    consent_recorded_at: new Date().toISOString()
  });

  const created = await store.createAppointment({
    leadId: lead.id,
    startsAt: hold.starts_at,
    endsAt: hold.ends_at,
    mode: body.mode === 'phone_call' ? 'phone_call' : 'video_call',
    question: cleanText(body.question, 1000)
  });

  if (!created.ok) {
    await store.releaseHold(holdId, 'released');
    return fail(res, 409, 'That time was just booked. Please pick another slot.');
  }

  // The hold has done its job; the appointment row now guards the slot.
  await supabase.from('slot_holds')
    .update({ status: 'converted', lead_id: lead.id })
    .eq('id', holdId);

  return res.json({
    success: true,
    appointment_id: created.appointment.id,
    starts_at: created.appointment.starts_at,
    ends_at: created.appointment.ends_at,
    status: created.appointment.status,
    payments_live: paymentsLive(),
    fee_inr: CONSULTATION_FEE_INR,
    next_step: paymentsLive() ? 'payment' : 'divya_will_confirm'
  });
}));

module.exports = router;
