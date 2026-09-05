// Divya's schedule controls. Mounted at /api/admin/schedule behind adminAuth.
//
// Deliberately separate from adminRoutes.js, which is read-only by design:
// these are the only admin endpoints that write, and keeping them in their own
// file means "the analytics module cannot change anything" stays true.

const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const store = require('./services/booking/store');

const router = express.Router();
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function now() { return new Date().toISOString(); }

function scope(req) {
  const wanted = String(req.query.environment || req.body.environment || 'production').toLowerCase();
  return ['production', 'test'].includes(wanted) ? wanted : 'production';
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
 * Validates one weekday's hours. Rejected here rather than in the database so
 * Divya gets a sentence she can act on instead of a Postgres constraint name.
 */
function validateDay(day, index) {
  const weekday = Number(day.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw bad(`Row ${index + 1} has an invalid day.`);
  if (day.is_active === false) return null;

  if (!CLOCK.test(String(day.start_time || ''))) throw bad(`${WEEKDAYS[weekday]}: start time must look like 18:30.`);
  if (!CLOCK.test(String(day.end_time || ''))) throw bad(`${WEEKDAYS[weekday]}: end time must look like 20:30.`);

  const [sh, sm] = day.start_time.split(':').map(Number);
  const [eh, em] = day.end_time.split(':').map(Number);
  const open = sh * 60 + sm;
  const close = eh * 60 + em;
  if (close <= open) throw bad(`${WEEKDAYS[weekday]}: the end time has to be after the start time.`);

  const length = Number(day.slot_duration_minutes) || 60;
  if (length < 15 || length > 240) throw bad(`${WEEKDAYS[weekday]}: a call has to be between 15 and 240 minutes.`);
  if (close - open < length) {
    throw bad(`${WEEKDAYS[weekday]}: ${close - open} minutes is not long enough for a ${length} minute call.`);
  }

  const bufferAfter = Number(day.buffer_after_minutes) || 0;
  const bufferBefore = Number(day.buffer_before_minutes) || 0;
  if (bufferAfter < 0 || bufferAfter > 120 || bufferBefore < 0 || bufferBefore > 120) {
    throw bad(`${WEEKDAYS[weekday]}: breaks have to be between 0 and 120 minutes.`);
  }

  const cap = day.max_bookings === '' || day.max_bookings == null ? null : Number(day.max_bookings);
  if (cap !== null && (!Number.isInteger(cap) || cap < 1 || cap > 20)) {
    throw bad(`${WEEKDAYS[weekday]}: the daily limit has to be a whole number from 1 to 20.`);
  }

  return {
    weekday,
    start_time: day.start_time,
    end_time: day.end_time,
    timezone_id: day.timezone_id || 'Asia/Kolkata',
    slot_duration_minutes: length,
    buffer_before_minutes: bufferBefore,
    buffer_after_minutes: bufferAfter,
    max_bookings: cap,
    is_active: true
  };
}

// ------------------------------------------------------------------ read

router.get('/', handle('read', async (req, res) => {
  const environment = scope(req);
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

  // Every weekday is returned, active or not, so the panel can render a full
  // week without inventing rows client-side.
  const byWeekday = new Map(rules.data.map(r => [Number(r.weekday), r]));
  const week = WEEKDAYS.map((label, weekday) => {
    const rule = byWeekday.get(weekday);
    return {
      weekday, label,
      is_active: Boolean(rule && rule.is_active),
      start_time: (rule && String(rule.start_time || '').slice(0, 5)) || '18:00',
      end_time: (rule && String(rule.end_time || '').slice(0, 5)) || '20:00',
      slot_duration_minutes: (rule && rule.slot_duration_minutes) || 60,
      buffer_before_minutes: (rule && rule.buffer_before_minutes) || 0,
      buffer_after_minutes: (rule && rule.buffer_after_minutes) || 15,
      max_bookings: rule ? rule.max_bookings : null
    };
  });

  return res.json({
    environment,
    week,
    configured: rules.data.some(r => r.is_active),
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
  const environment = scope(req);
  const days = Array.isArray(req.body && req.body.week) ? req.body.week : null;
  if (!days) throw bad('Nothing to save.');

  const keep = days.map(validateDay).filter(Boolean);

  // Replace rather than merge: the panel always sends the whole week, so a day
  // Divya switched off must actually disappear rather than linger as a stale
  // active rule that keeps offering slots.
  const supabase = client();
  const wipe = await supabase.from('availability_rules').delete().eq('environment', environment);
  if (wipe.error) throw new Error(wipe.error.message);

  if (keep.length) {
    const rows = keep.map(day => Object.assign({
      id: id('avr'), environment, created_at: now(), updated_at: now()
    }, day));
    const insert = await supabase.from('availability_rules').insert(rows);
    if (insert.error) throw new Error(insert.error.message);
  }

  return res.json({ success: true, active_days: keep.length, environment });
}));

// ----------------------------------------------------------- blocked dates

router.post('/block', handle('block', async (req, res) => {
  const environment = scope(req);
  const from = new Date(req.body && req.body.starts_at);
  const to = new Date(req.body && req.body.ends_at);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) throw bad('Pick a start and end date.');
  if (to <= from) throw bad('The end has to be after the start.');

  const supabase = client();
  const insert = await supabase.from('blocked_dates').insert({
    id: id('blk'), environment,
    starts_at: from.toISOString(), ends_at: to.toISOString(),
    reason: String((req.body && req.body.reason) || '').trim().slice(0, 200) || null,
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

router.post('/appointment/:id/cancel', handle('cancel', async (req, res) => {
  const appointment = await store.getAppointment(String(req.params.id));
  if (!appointment) return res.status(404).json({ error: 'That booking no longer exists.' });

  const updated = await store.setAppointmentStatus(appointment.id, 'cancelled', {
    reason: String((req.body && req.body.reason) || '').trim().slice(0, 300) || 'cancelled by Divya',
    changedBy: 'admin'
  });
  // Cancelling drops the row out of active_appointment_slot_unique, so the time
  // becomes bookable again on the very next availability call.
  return res.json({ success: true, appointment: updated, slot_released: true });
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
    return res.json({ success: true, appointment: updated });
  } catch (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return res.status(409).json({ error: 'There is already a booking at that time.' });
    }
    throw error;
  }
}));

module.exports = router;
