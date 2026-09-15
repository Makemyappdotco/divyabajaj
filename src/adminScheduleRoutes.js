// Divya's schedule controls. Mounted at /api/admin/schedule behind adminAuth.
//
// Deliberately separate from adminRoutes.js, which is read-only by design:
// these are the only admin endpoints that write, and keeping them in their own
// file means "the analytics module cannot change anything" stays true.

const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const store = require('./services/booking/store');
const delivery = require('./services/delivery');

const router = express.Router();
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function now() { return new Date().toISOString(); }

/**
 * Which environment's hours this deployment reads.
 *
 * Deliberately NOT the panel's Live/Test analytics filter. Hours are
 * configuration of the site you are looking at, not a slice of data: the
 * booking page always reads store.runtimeEnvironment(), so if the panel let
 * you edit 'production' while the preview site served 'test', every save
 * would appear to do nothing. That is exactly what happened. There is now one
 * answer and the panel states it plainly.
 */
function scope() {
  return store.runtimeEnvironment();
}

function environmentLabel() {
  return store.runtimeEnvironment() === 'production'
    ? 'your live site'
    : 'this preview site (your live site has its own separate hours)';
}

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Schedule needs Supabase; this environment is on local fallback storage.');
  return supabase;
}

function handle(name, fn) {
  return async (req, res) => {
    try {
      if (!db.usingSupabase()) {
        return res.status(503).json({ error: 'Schedule needs Supabase; this environment is on local fallback storage.' });
      }
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res);
    } catch (error) {
      console.error(`[schedule:${name}]`, error);
      return res.status(error.status || 500).json({ error: error.message || `${name} failed` });
    }
  };
}

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

const CLOCK = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Validates one weekday's hours, now possibly more than one time block a day
 * (e.g. free 9-11am and separately free 5-8pm on the same Sunday). Rejected
 * here rather than in the database so Divya gets a sentence she can act on
 * instead of a Postgres constraint name.
 *
 * Each call length, gap and daily limit apply to the whole day, not per
 * block - Divya doesn't need a 45 minute morning and a 60 minute evening on
 * the same day, and the daily limit is inherently a whole-day concept (the
 * engine counts bookings across every block on a day toward the same cap).
 * Returns an array of one row per time block (empty if the day is off or has
 * no blocks yet), so PUT /hours can just flatMap this over the whole week.
 */
function validateDay(day, index) {
  const weekday = Number(day.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw bad(`Row ${index + 1} has an invalid day.`);
  if (day.is_active === false) return [];

  const intervals = Array.isArray(day.intervals) ? day.intervals : [];
  if (!intervals.length) return [];

  const length = Number(day.slot_duration_minutes) || 60;
  if (length < 15 || length > 240) throw bad(`${WEEKDAYS[weekday]}: a call has to be between 15 and 240 minutes.`);

  const bufferAfter = Number(day.buffer_after_minutes) || 0;
  const bufferBefore = Number(day.buffer_before_minutes) || 0;
  if (bufferAfter < 0 || bufferAfter > 120 || bufferBefore < 0 || bufferBefore > 120) {
    throw bad(`${WEEKDAYS[weekday]}: breaks have to be between 0 and 120 minutes.`);
  }

  const cap = day.max_bookings === '' || day.max_bookings == null ? null : Number(day.max_bookings);
  if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 20)) {
    throw bad(`${WEEKDAYS[weekday]}: the daily limit has to be a whole number from 1 to 20.`);
  }

  const parsed = intervals.map(interval => {
    if (!CLOCK.test(String(interval.start_time || ''))) throw bad(`${WEEKDAYS[weekday]}: start time must look like 18:30.`);
    if (!CLOCK.test(String(interval.end_time || ''))) throw bad(`${WEEKDAYS[weekday]}: end time must look like 20:30.`);
    const [sh, sm] = interval.start_time.split(':').map(Number);
    const [eh, em] = interval.end_time.split(':').map(Number);
    const open = sh * 60 + sm;
    const close = eh * 60 + em;
    if (close <= open) throw bad(`${WEEKDAYS[weekday]}: the end time has to be after the start time.`);
    if (close - open < length) {
      throw bad(`${WEEKDAYS[weekday]}: ${close - open} minutes is not long enough for a ${length} minute call.`);
    }
    return { open, close, start_time: interval.start_time, end_time: interval.end_time };
  });

  // Two blocks that overlap are almost always a mistake, not a real request
  // for double capacity - catch it here with a sentence instead of letting it
  // through to generate confusing duplicate-looking slots.
  const sorted = parsed.slice().sort((a, b) => a.open - b.open);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].open < sorted[i - 1].close) {
      throw bad(`${WEEKDAYS[weekday]}: ${sorted[i - 1].start_time}-${sorted[i - 1].end_time} and ${sorted[i].start_time}-${sorted[i].end_time} overlap.`);
    }
  }

  return parsed.map(interval => ({
    weekday,
    start_time: interval.start_time,
    end_time: interval.end_time,
    timezone_id: day.timezone_id || 'Asia/Kolkata',
    slot_duration_minutes: length,
    buffer_before_minutes: bufferBefore,
    buffer_after_minutes: bufferAfter,
    max_bookings: cap,
    is_active: true
  }));
}

/**
 * Validates one "extra window": either another recurring window on a weekday
 * (repeats every week, same as a grid row) or a one-off window tied to a
 * single calendar date (never repeats). Kept separate from validateDay
 * because extra windows are added and removed one at a time rather than
 * saved as a whole week, and a one-off has a date instead of a weekday.
 */
function validateExtraWindow(body) {
  const specificDate = body.specific_date ? String(body.specific_date).trim() : null;
  const hasWeekday = body.weekday !== undefined && body.weekday !== null && body.weekday !== '';
  if (!specificDate && !hasWeekday) throw bad('Pick either a day of the week or a specific date.');
  if (specificDate && !/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) throw bad('That date does not look right.');

  let weekday;
  if (specificDate) {
    // Stored purely so the admin list can show a day name without recomputing
    // it; slot matching for a one-off ignores this and matches on the date.
    const parsed = new Date(`${specificDate}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime())) throw bad('That date does not look right.');
    weekday = parsed.getUTCDay();
  } else {
    weekday = Number(body.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw bad('Pick a valid day of the week.');
  }

  if (!CLOCK.test(String(body.start_time || ''))) throw bad('Start time must look like 18:30.');
  if (!CLOCK.test(String(body.end_time || ''))) throw bad('End time must look like 20:30.');

  const [sh, sm] = body.start_time.split(':').map(Number);
  const [eh, em] = body.end_time.split(':').map(Number);
  const open = sh * 60 + sm;
  const close = eh * 60 + em;
  if (close <= open) throw bad('The end time has to be after the start time.');

  const length = Number(body.slot_duration_minutes) || 60;
  if (length < 15 || length > 240) throw bad('A call has to be between 15 and 240 minutes.');
  if (close - open < length) {
    throw bad(`${close - open} minutes is not long enough for a ${length} minute call.`);
  }

  const bufferAfter = Number(body.buffer_after_minutes) || 0;
  const bufferBefore = Number(body.buffer_before_minutes) || 0;
  if (bufferAfter < 0 || bufferAfter > 120 || bufferBefore < 0 || bufferBefore > 120) {
    throw bad('Breaks have to be between 0 and 120 minutes.');
  }

  const cap = body.max_bookings === '' || body.max_bookings == null ? null : Number(body.max_bookings);
  if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 20)) {
    throw bad('The daily limit has to be a whole number from 1 to 20.');
  }

  return {
    weekday,
    specific_date: specificDate,
    kind: 'extra',
    start_time: body.start_time,
    end_time: body.end_time,
    timezone_id: body.timezone_id || 'Asia/Kolkata',
    slot_duration_minutes: length,
    buffer_before_minutes: bufferBefore,
    buffer_after_minutes: bufferAfter,
    max_bookings: cap,
    is_active: true
  };
}

// ------------------------------------------------------------------ read

router.get('/', handle('read', async (req, res) => {
  const environment = scope();
  const supabase = client();

  const [rules, blocked, upcoming] = await Promise.all([
    supabase.from('availability_rules').select('*').eq('environment', environment).order('weekday'),
    supabase.from('blocked_dates').select('*').eq('environment', environment)
      .gte('ends_at', now()).order('starts_at'),
    supabase.from('appointments')
      .select('id, starts_at, ends_at, status, mode, lead_id, customer_question, meeting_url')
      .eq('environment', environment).in('status', store.LIVE_APPOINTMENT_STATUSES)
      .gte('starts_at', now()).order('starts_at')
  ]);

  for (const result of [rules, blocked, upcoming]) {
    if (result.error) throw new Error(result.error.message);
  }

  // Names for the upcoming list, in one query rather than per row.
  const leadIds = Array.from(new Set(upcoming.data.map(a => a.lead_id).filter(Boolean)));
  let names = {};
  if (leadIds.length) {
    const leads = await supabase.from('leads').select('id, name, email, phone').in('id', leadIds);
    if (leads.error) throw new Error(leads.error.message);
    names = Object.fromEntries(leads.data.map(l => [l.id, l]));
  }

  // Rows written by the simple weekly grid ('grid', the default for anything
  // saved before this column existed) are what fills the week view below.
  // Rows added one at a time through /extra-window ('extra') never appear
  // there and are never touched by a grid save - see PUT /hours.
  const gridRules = rules.data.filter(r => (r.kind || 'grid') === 'grid');
  const extraRules = rules.data.filter(r => r.kind === 'extra');

  // Every weekday is returned, active or not, so the panel can render a full
  // week without inventing rows client-side. A day can now have more than one
  // grid row (more than one time block), so they're grouped here rather than
  // picked one-per-day; call length, gap and daily limit are shared across a
  // day's blocks (validateDay enforces that on save), so any row supplies them.
  const byWeekday = new Map();
  gridRules.forEach(r => {
    const wd = Number(r.weekday);
    if (!byWeekday.has(wd)) byWeekday.set(wd, []);
    byWeekday.get(wd).push(r);
  });
  const week = WEEKDAYS.map((label, weekday) => {
    const rows = (byWeekday.get(weekday) || [])
      .filter(r => r.is_active)
      .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
    const first = rows[0];
    return {
      weekday, label,
      is_active: rows.length > 0,
      slot_duration_minutes: (first && first.slot_duration_minutes) || 60,
      buffer_before_minutes: (first && first.buffer_before_minutes) || 0,
      buffer_after_minutes: (first && first.buffer_after_minutes) || 15,
      max_bookings: first ? first.max_bookings : null,
      intervals: rows.length
        ? rows.map(r => ({ start_time: String(r.start_time || '').slice(0, 5), end_time: String(r.end_time || '').slice(0, 5) }))
        : [{ start_time: '18:00', end_time: '20:00' }]
    };
  });

  // Extra windows, newest first, in the shape the admin panel's list needs -
  // a one-off carries a date and no weekday label; a recurring extra window
  // carries a weekday label and no date.
  const extra_windows = extraRules
    .slice()
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .map(r => ({
      id: r.id,
      repeats: !r.specific_date,
      weekday: r.specific_date ? null : Number(r.weekday),
      weekday_label: r.specific_date ? null : WEEKDAYS[Number(r.weekday)],
      specific_date: r.specific_date || null,
      start_time: String(r.start_time || '').slice(0, 5),
      end_time: String(r.end_time || '').slice(0, 5),
      slot_duration_minutes: r.slot_duration_minutes,
      buffer_before_minutes: r.buffer_before_minutes,
      buffer_after_minutes: r.buffer_after_minutes,
      max_bookings: r.max_bookings
    }));

  return res.json({
    environment,
    environment_label: environmentLabel(),
    week,
    extra_windows,
    configured: gridRules.some(r => r.is_active) || extraRules.length > 0,
    blocked: blocked.data,
    upcoming: upcoming.data.map(a => Object.assign({}, a, { lead: names[a.lead_id] || null })),
    hold_minutes: store.HOLD_MINUTES,
    min_notice_minutes: store.MIN_NOTICE_MINUTES,
    calendar_connected: false,
    calendar_note: 'Google Calendar is not connected yet.'
  });
}));

// ------------------------------------------------------- write weekly hours

router.put('/hours', handle('hours', async (req, res) => {
  const environment = scope();
  const days = Array.isArray(req.body && req.body.week) ? req.body.week : null;
  if (!days) throw bad('Nothing to save.');

  // One row per time block now, not one row per weekday - a day with two
  // blocks contributes two rows here.
  const keep = days.flatMap((day, index) => validateDay(day, index));
  const activeDays = new Set(keep.map(row => row.weekday)).size;

  // Replace rather than merge: the panel always sends the whole week, so a day
  // Divya switched off must actually disappear rather than linger as a stale
  // active rule that keeps offering slots. Scoped to kind = 'grid' so this can
  // never touch an extra window added separately through /extra-window.
  const supabase = client();
  const wipe = await supabase.from('availability_rules').delete()
    .eq('environment', environment).eq('kind', 'grid');
  if (wipe.error) throw new Error(wipe.error.message);

  if (keep.length) {
    const rows = keep.map(day => Object.assign({
      id: id('avr'), environment, kind: 'grid', created_at: now(), updated_at: now()
    }, day));
    const insert = await supabase.from('availability_rules').insert(rows);
    if (insert.error) throw new Error(insert.error.message);
  }

  return res.json({ success: true, active_days: activeDays, environment });
}));

// -------------------------------------------------------------- extra windows

/**
 * Adds one extra bookable window on top of the weekly grid - either another
 * recurring window on a weekday, or a one-off window tied to a single date.
 * Never touches the grid rows, and is never touched by a grid save.
 */
router.post('/extra-window', handle('extra-window:create', async (req, res) => {
  const environment = scope();
  const row = validateExtraWindow(req.body || {});

  const supabase = client();
  const insert = await supabase.from('availability_rules').insert(Object.assign({
    id: id('avr'), environment, created_at: now(), updated_at: now()
  }, row)).select().single();
  if (insert.error) throw new Error(insert.error.message);

  return res.json({ success: true, window: insert.data });
}));

/**
 * Removes one extra window. Scoped to kind = 'extra' so this endpoint can
 * never be pointed at a grid row by id and delete part of the weekly hours.
 */
router.delete('/extra-window/:id', handle('extra-window:delete', async (req, res) => {
  const environment = scope();
  const remove = await client().from('availability_rules').delete()
    .eq('environment', environment).eq('kind', 'extra').eq('id', String(req.params.id));
  if (remove.error) throw new Error(remove.error.message);
  return res.json({ success: true });
}));

// ----------------------------------------------------------- blocked dates

router.post('/block', handle('block', async (req, res) => {
  const environment = scope();
  const from = new Date(req.body && req.body.starts_at);
  const to = new Date(req.body && req.body.ends_at);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) throw bad('Pick a start and end date.');
  if (to <= from) throw bad('The end has to be after the start.');

  const supabase = client();
  const insert = await supabase.from('blocked_dates').insert({
    id: id('blk'), environment,
    starts_at: from.toISOString(), ends_at: to.toISOString(),
    // NOT NULL with a '' default, so an omitted reason must be '' not null.
    reason: String((req.body && req.body.reason) || '').trim().slice(0, 200),
    source: 'admin', created_at: now()
  }).select().single();
  if (insert.error) throw new Error(insert.error.message);

  // Says plainly what this just did to anyone mid-booking.
  const clash = await supabase.from('appointments')
    .select('id, starts_at')
    .eq('environment', environment).in('status', store.LIVE_APPOINTMENT_STATUSES)
    .lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString());
  if (clash.error) throw new Error(clash.error.message);

  return res.json({
    success: true,
    blocked: insert.data,
    existing_bookings_in_range: clash.data.length,
    warning: clash.data.length
      ? `${clash.data.length} booking${clash.data.length > 1 ? 's are' : ' is'} already in that range. Blocking the dates does not cancel them - cancel each one if you need to.`
      : null
  });
}));

router.delete('/block/:id', handle('unblock', async (req, res) => {
  const remove = await client().from('blocked_dates').delete().eq('id', String(req.params.id));
  if (remove.error) throw new Error(remove.error.message);
  return res.json({ success: true });
}));

// ------------------------------------------------------- manage a booking

/**
 * Best-effort customer notification for a cancel/reschedule that has already
 * committed to the database. Mirrors the comment on the payment confirmation
 * send in paymentRoutes.js: the booking change itself must never fail, or
 * appear to have failed, because a WhatsApp/email attempt hit trouble - so
 * this is always fire-and-swallow, logged and returned for the panel to show
 * as a note, never thrown back into handle()'s 500 path.
 */
async function notifyBookingChange(appointment, deliverFn) {
  try {
    const lead = appointment.lead_id ? await db.getLead(appointment.lead_id) : null;
    return await deliverFn({
      environment: appointment.environment,
      appointmentId: appointment.id,
      name: (lead && lead.name) || '',
      email: (lead && lead.email) || '',
      phone: (lead && lead.phone) || '',
      startsAt: appointment.starts_at
    });
  } catch (error) {
    console.error('[schedule:notify]', error);
    return { attempted: false, delivered: false, reason: error.message };
  }
}

router.post('/appointment/:id/cancel', handle('cancel', async (req, res) => {
  const appointment = await store.getAppointment(String(req.params.id));
  if (!appointment) return res.status(404).json({ error: 'That booking no longer exists.' });

  const updated = await store.setAppointmentStatus(appointment.id, 'cancelled', {
    reason: String((req.body && req.body.reason) || '').trim().slice(0, 300) || 'cancelled by Divya',
    changedBy: 'admin'
  });
  const notified = await notifyBookingChange(updated, delivery.deliverConsultationCancelled);
  // Cancelling drops the row out of active_appointment_slot_unique, so the time
  // becomes bookable again on the very next availability call.
  return res.json({ success: true, appointment: updated, slot_released: true, notified });
}));

router.post('/appointment/:id/reschedule', handle('reschedule', async (req, res) => {
  const appointment = await store.getAppointment(String(req.params.id));
  if (!appointment) return res.status(404).json({ error: 'That booking no longer exists.' });

  const startsAt = new Date(req.body && req.body.starts_at);
  if (!Number.isFinite(startsAt.getTime())) throw bad('Pick a new time.');
  const length = new Date(appointment.ends_at) - new Date(appointment.starts_at);
  const endsAt = new Date(startsAt.getTime() + length);

  // The same row moves. There is no second appointment and no 'rescheduled'
  // status, so the unique index still guards it and it can never sit in two
  // places at once; the move is recorded in appointment_status_history.
  try {
    const updated = await store.setAppointmentStatus(appointment.id, appointment.status, {
      reason: `moved from ${appointment.starts_at} to ${startsAt.toISOString()}`,
      changedBy: 'admin',
      patch: { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() }
    });
    const notified = await notifyBookingChange(updated, delivery.deliverConsultationMoved);
    return res.json({ success: true, appointment: updated, notified });
  } catch (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return res.status(409).json({ error: 'There is already a booking at that time.' });
    }
    throw error;
  }
}));

module.exports = router;
