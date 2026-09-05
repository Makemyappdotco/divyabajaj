// Data access for the booking engine.
//
// Kept apart from the pure availability maths so the rules can be tested without
// a database, and apart from src/database.js so nothing here can disturb the
// lead, report or PDF paths that are already live.

const crypto = require('crypto');
const db = require('../../database');
const { computeSlots } = require('./availability');

const HOLD_MINUTES = Number(process.env.BOOKING_HOLD_MINUTES) || 10;
const MIN_NOTICE_MINUTES = Number(process.env.BOOKING_MIN_NOTICE_MINUTES) || 120;
const MAX_DAYS_AHEAD = Number(process.env.BOOKING_MAX_DAYS_AHEAD) || 45;

// Postgres unique_violation. The partial unique indexes on slot_holds and
// appointments are the real concurrency guard - two customers pressing "book"
// on the last slot in the same second both reach the insert, and the database
// picks a winner. This code's only job is to turn the loser's error into a
// polite "someone just took that" rather than a 500.
const UNIQUE_VIOLATION = '23505';

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function runtimeEnvironment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production' ? 'production' : 'test';
  return process.env.NODE_ENV === 'production' ? 'production' : 'test';
}

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Booking needs Supabase; this environment is on local fallback storage.');
  return supabase;
}

async function unwrap(query, context) {
  const { data, error } = await query;
  if (error) throw new Error(`${context}: ${error.message}`);
  return data || [];
}

// Statuses that still occupy the slot. This list MUST match the predicate of
// active_appointment_slot_unique exactly:
//   ... where status in ('pending_payment','confirmed')
// If availability treats a status as live that the index does not, the slot
// looks busy but the database will happily accept a second booking on it - and
// the reverse is worse. There is deliberately no 'rescheduled' status: moving a
// call updates starts_at on the same row and leaves the trail in
// appointment_status_history, so an appointment is never in two places.
const LIVE_APPOINTMENT_STATUSES = ['pending_payment', 'confirmed'];

async function getRules(environment) {
  return unwrap(
    client().from('availability_rules').select('*').eq('environment', environment).eq('is_active', true),
    'Load availability rules'
  );
}

async function getBlocked(environment, from, to) {
  return unwrap(
    client().from('blocked_dates').select('starts_at, ends_at, reason')
      .eq('environment', environment).lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()),
    'Load blocked dates'
  );
}

/**
 * Everything already occupying time in the window: live appointments plus holds
 * that have not expired. Expired holds are ignored here rather than waited on,
 * so a customer who abandoned checkout never keeps a slot hostage even if the
 * reaper has not run yet.
 */
async function getTaken(environment, from, to) {
  const [appointments, holds] = await Promise.all([
    unwrap(
      client().from('appointments').select('id, starts_at, ends_at, status')
        .eq('environment', environment).in('status', LIVE_APPOINTMENT_STATUSES)
        .lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()),
      'Load appointments'
    ),
    unwrap(
      client().from('slot_holds').select('id, starts_at, ends_at, expires_at, slot_key')
        .eq('environment', environment).eq('status', 'active').gt('expires_at', now())
        .lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()),
      'Load slot holds'
    )
  ]);
  return [...appointments, ...holds];
}

/**
 * The bookable slots a customer should be offered.
 *
 * `busy` is passed in rather than fetched so the Google Calendar call stays the
 * caller's decision: if Google is down or not yet connected, availability still
 * works off Divya's own rules instead of the whole page failing.
 */
async function listAvailability({
  environment = runtimeEnvironment(), days = 14, busy = [], now: clock, from: windowStart
} = {}) {
  // `now` is the clock (what "too soon to book" is measured against) and
  // `from` is where the window starts. They are almost always the same, but
  // validating a single future slot needs a narrow window WITHOUT moving the
  // clock - collapsing the two would let a caller silently bypass the minimum
  // notice period by asking about a window that starts in the future.
  const now = clock ? new Date(clock) : new Date();
  const from = windowStart ? new Date(windowStart) : now;
  const span = Math.min(Math.max(Number(days) || 14, 1), MAX_DAYS_AHEAD);
  const to = new Date(from.getTime() + span * 86400000);

  const [rules, blocked, taken] = await Promise.all([
    getRules(environment),
    getBlocked(environment, from, to),
    getTaken(environment, from, to)
  ]);

  const slots = computeSlots({
    rules, blocked, busy, taken, from, to, now, minNoticeMinutes: MIN_NOTICE_MINUTES
  });
  return { environment, from: from.toISOString(), to: to.toISOString(), slots, rules_configured: rules.length };
}

/**
 * Take a slot off the market for HOLD_MINUTES while the customer pays.
 *
 * Returns {ok:true, hold} or {ok:false, reason:'taken'}. Never throws on a race.
 */
async function holdSlot({ environment = runtimeEnvironment(), slotKey, startsAt, endsAt, leadId = null }) {
  // Clear our own expired row first: the unique index covers every active hold
  // including a stale one from an abandoned checkout, so without this a slot
  // stays unbookable for the rest of the day.
  await releaseExpired(environment, slotKey);

  const row = {
    id: id('hold'),
    environment,
    lead_id: leadId,
    slot_key: slotKey,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    status: 'active',
    expires_at: new Date(Date.now() + HOLD_MINUTES * 60000).toISOString(),
    created_at: now()
  };

  const { data, error } = await client().from('slot_holds').insert(row).select().single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: 'taken' };
    throw new Error(`Hold slot failed: ${error.message}`);
  }
  return { ok: true, hold: data };
}

async function releaseExpired(environment, slotKey = null) {
  let query = client().from('slot_holds')
    .update({ status: 'expired' })
    .eq('environment', environment).eq('status', 'active').lte('expires_at', now());
  if (slotKey) query = query.eq('slot_key', slotKey);
  const { error } = await query;
  if (error) throw new Error(`Expire holds failed: ${error.message}`);
}

async function releaseHold(holdId, status = 'released') {
  const { error } = await client().from('slot_holds').update({ status }).eq('id', holdId);
  if (error) throw new Error(`Release hold failed: ${error.message}`);
}

/** Audit trail. Every status change is recorded, including the ones we make. */
async function recordStatus(appointmentId, fromStatus, toStatus, reason, changedBy = 'system') {
  const { error } = await client().from('appointment_status_history').insert({
    id: id('apst'),
    appointment_id: appointmentId,
    // Both NOT NULL with '' defaults. The first record of an appointment has no
    // previous status, and most transitions carry no reason, so both were being
    // written as null - which meant every audit row was silently rejected.
    from_status: fromStatus || '',
    to_status: toStatus,
    reason: reason || '',
    changed_by: changedBy,
    created_at: now()
  });
  // A missing audit row must not fail the booking it describes.
  if (error) console.error('[booking] status history write failed', error.message);
}

/**
 * Create the appointment the customer is paying for.
 *
 * Starts at pending_payment and is only confirmed by the payment webhook, so a
 * customer who closes the tab at checkout never ends up with a call Divya
 * thinks is paid for.
 */
async function createAppointment({
  environment = runtimeEnvironment(), leadId, orderId = null, startsAt, endsAt,
  timezoneId = 'Asia/Kolkata', mode = 'video_call', question = ''
}) {
  const row = {
    id: id('appt'),
    environment,
    lead_id: leadId,
    order_id: orderId,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    timezone_id: timezoneId,
    mode,
    status: 'pending_payment',
    // '' not null: customer_question is NOT NULL in the schema (default ''),
    // so writing null when the optional question is left blank fails the whole
    // insert. This is what broke the first real booking.
    customer_question: question || '',
    created_at: now(),
    updated_at: now()
  };

  const { data, error } = await client().from('appointments').insert(row).select().single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: 'taken' };
    throw new Error(`Create appointment failed: ${error.message}`);
  }
  await recordStatus(data.id, null, 'pending_payment', 'created');
  return { ok: true, appointment: data };
}

async function setAppointmentStatus(appointmentId, toStatus, { reason, changedBy = 'system', patch = {} } = {}) {
  const existing = await client().from('appointments').select('status').eq('id', appointmentId).maybeSingle();
  if (existing.error) throw new Error(`Load appointment failed: ${existing.error.message}`);
  if (!existing.data) return null;

  const { data, error } = await client().from('appointments')
    .update({ ...patch, status: toStatus, updated_at: now() })
    .eq('id', appointmentId).select().single();
  if (error) throw new Error(`Update appointment failed: ${error.message}`);

  await recordStatus(appointmentId, existing.data.status, toStatus, reason, changedBy);
  return data;
}

async function getAppointment(appointmentId) {
  const { data, error } = await client().from('appointments').select('*').eq('id', appointmentId).maybeSingle();
  if (error) throw new Error(`Load appointment failed: ${error.message}`);
  return data;
}

module.exports = {
  listAvailability, holdSlot, releaseHold, releaseExpired,
  createAppointment, setAppointmentStatus, getAppointment, recordStatus,
  getRules, getBlocked, getTaken,
  runtimeEnvironment, HOLD_MINUTES, MIN_NOTICE_MINUTES, MAX_DAYS_AHEAD,
  LIVE_APPOINTMENT_STATUSES
};
