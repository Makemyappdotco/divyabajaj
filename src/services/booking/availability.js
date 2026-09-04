// Availability engine.
//
// Answers one question: which slots can a customer actually book right now?
//
// computeSlots is deliberately pure - it takes rows and returns slots, touching
// no database and no clock of its own. Every rule about buffers, notice periods,
// daily caps and clashes is therefore testable without a network, which matters
// because the cost of a bug here is two people showing up to the same call.

const { zonedToUtc, utcToZoned, parseClock, datesBetween, overlaps } = require('./time');

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_SLOT_MINUTES = 60;

/**
 * Deterministic identity for a slot, used as the hold's unique key.
 *
 * The partial unique index on slot_holds(environment, slot_key) where status =
 * 'active' is what actually prevents two people holding the same slot, so this
 * must be stable: the same slot computed twice, on two servers, must produce
 * the same string. Start instant plus length does that.
 */
function slotKeyFor(startsAt, minutes) {
  return `${new Date(startsAt).toISOString().replace(/\.\d{3}Z$/, 'Z')}_${minutes}`;
}

function toTime(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Existing commitments, widened by their buffers.
 *
 * A 60 minute call with a 15 minute buffer after it occupies 75 minutes as far
 * as the next booking is concerned. Widening here means the overlap test stays
 * a plain interval comparison rather than carrying buffer arithmetic around.
 */
function withBuffers(entries) {
  return (entries || []).map(entry => {
    const before = Number(entry.buffer_before_minutes) || 0;
    const after = Number(entry.buffer_after_minutes) || 0;
    return {
      start: toTime(entry.starts_at || entry.start) - before * 60000,
      end: toTime(entry.ends_at || entry.end) + after * 60000
    };
  }).filter(entry => Number.isFinite(entry.start) && Number.isFinite(entry.end));
}

/**
 * @param {object} input
 * @param {Array}  input.rules   availability_rules rows (weekday, start_time, end_time, ...)
 * @param {Array}  input.blocked blocked_dates rows - holidays, leave, ad hoc blocks
 * @param {Array}  input.busy    freebusy ranges from Divya's own Google Calendar
 * @param {Array}  input.taken   active holds and live appointments
 * @param {Date}   input.from    window start
 * @param {Date}   input.to      window end
 * @param {Date}   input.now     "now", injected so tests are not clock-dependent
 * @param {number} input.minNoticeMinutes  how soon is too soon to book
 * @returns {Array} bookable slots, ascending
 */
function computeSlots({
  rules = [], blocked = [], busy = [], taken = [],
  from, to, now, minNoticeMinutes = 120
}) {
  const active = rules.filter(rule => rule.is_active !== false);
  if (!active.length) return [];

  const nowMs = toTime(now || Date.now());
  const earliest = nowMs + minNoticeMinutes * 60000;
  const windowStart = toTime(from);
  const windowEnd = toTime(to);

  // Blocks and the calendar carry no buffers - they are opaque "not available".
  const obstacles = [
    ...withBuffers(taken),
    ...(blocked || []).map(b => ({ start: toTime(b.starts_at), end: toTime(b.ends_at) })),
    ...(busy || []).map(b => ({ start: toTime(b.start || b.starts_at), end: toTime(b.end || b.ends_at) }))
  ].filter(o => Number.isFinite(o.start) && Number.isFinite(o.end) && o.end > o.start);

  const timezone = active[0].timezone_id || DEFAULT_TIMEZONE;
  const slots = [];

  for (const day of datesBetween(new Date(windowStart), new Date(windowEnd), timezone)) {
    // Cap counts what the customer sees as bookable, plus what is already taken
    // that day, so max_bookings means "calls in a day" and not "calls a stranger
    // can still add on top of the ones I have".
    let dayCount = 0;
    const dayRules = active.filter(rule => Number(rule.weekday) === day.weekday);

    for (const rule of dayRules) {
      const open = parseClock(rule.start_time);
      const close = parseClock(rule.end_time);
      const length = Number(rule.slot_duration_minutes) || DEFAULT_SLOT_MINUTES;
      // A malformed or inverted rule yields no slots rather than an exception:
      // one bad row in the admin panel must not take the booking page down.
      if (open === null || close === null || close <= open || length <= 0) continue;

      const cap = Number(rule.max_bookings);
      const ruleZone = rule.timezone_id || timezone;

      for (let minute = open; minute + length <= close; minute += length) {
        if (Number.isFinite(cap) && cap > 0 && dayCount >= cap) break;

        const start = zonedToUtc({
          year: day.year, month: day.month, day: day.day,
          hour: Math.floor(minute / 60), minute: minute % 60
        }, ruleZone).getTime();
        const end = start + length * 60000;

        if (start < windowStart || start > windowEnd) continue;
        if (start < earliest) continue;

        // The candidate is widened by its own buffers too: a new call needs its
        // run-up clear as much as it needs its run-out.
        const guardStart = start - (Number(rule.buffer_before_minutes) || 0) * 60000;
        const guardEnd = end + (Number(rule.buffer_after_minutes) || 0) * 60000;
        if (obstacles.some(o => overlaps(guardStart, guardEnd, o.start, o.end))) continue;

        const startsAt = new Date(start).toISOString();
        slots.push({
          slot_key: slotKeyFor(startsAt, length),
          starts_at: startsAt,
          ends_at: new Date(end).toISOString(),
          duration_minutes: length,
          timezone_id: ruleZone,
          date: day.date
        });
        dayCount += 1;
      }
    }
  }

  // Two rules can cover the same hour (an evening rule extending a day rule, or
  // a duplicate row someone added by mistake). The customer should see one slot.
  const seen = new Set();
  return slots
    .filter(slot => (seen.has(slot.slot_key) ? false : seen.add(slot.slot_key)))
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0));
}

/** Group flat slots into the day buckets the booking page renders. */
function groupByDate(slots) {
  const days = new Map();
  for (const slot of slots) {
    if (!days.has(slot.date)) days.set(slot.date, []);
    days.get(slot.date).push(slot);
  }
  return Array.from(days, ([date, items]) => ({ date, slots: items }));
}

module.exports = { computeSlots, groupByDate, slotKeyFor, DEFAULT_TIMEZONE, DEFAULT_SLOT_MINUTES };
