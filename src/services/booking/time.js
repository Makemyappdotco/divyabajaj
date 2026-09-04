// Timezone helpers for the booking engine.
//
// Everything is stored in UTC and shown in the rule's own timezone (Asia/Kolkata
// by default). India has no daylight saving, so a fixed +05:30 would work today -
// but hardcoding that means the engine silently breaks the day Divya takes
// bookings from a second timezone, and a booking system that is quietly wrong
// about time is worse than one that refuses to run. These use Intl instead, so
// they are correct in any zone including across DST boundaries, with no
// dependency to install.

/**
 * How far the given zone is from UTC at that instant, in milliseconds.
 * Positive east of Greenwich (Asia/Kolkata is +19800000).
 */
function offsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(instant).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});

  // hour comes back as "24" for midnight in some ICU versions; %24 normalises it.
  const asIfUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
  );
  return asIfUtc - instant.getTime();
}

/**
 * A wall-clock time in a zone -> the UTC instant it refers to.
 *
 * The offset depends on the instant, and the instant is what we are solving for,
 * so this guesses once and then refines. One refinement is enough for every real
 * zone: the guess is never more than a DST shift away, and re-reading the offset
 * at the corrected instant lands on the right side of the boundary.
 */
function zonedToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(firstPass), timeZone));
}

/** The calendar parts of a UTC instant as they read on a clock in that zone. */
function utcToZoned(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(instant).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});

  const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
    date: `${parts.year}-${parts.month}-${parts.day}`
  };
}

/** "HH:MM" or "HH:MM:SS" -> minutes past midnight. Returns null if unparseable. */
function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Calendar dates from `from` to `to` inclusive, as they fall in the zone. */
function datesBetween(from, to, timeZone) {
  const dates = [];
  const start = utcToZoned(from, timeZone);
  // Step a day at a time from local noon, which is far enough from both
  // midnight and any DST shift that adding 24h never skips or repeats a date.
  let cursor = Date.UTC(start.year, start.month - 1, start.day, 12);
  const limit = utcToZoned(to, timeZone);
  const last = Date.UTC(limit.year, limit.month - 1, limit.day, 12);

  while (cursor <= last) {
    const at = new Date(cursor);
    const zoned = utcToZoned(zonedToUtc({
      year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate(), hour: 12
    }, timeZone), timeZone);
    dates.push({ year: zoned.year, month: zoned.month, day: zoned.day, weekday: zoned.weekday, date: zoned.date });
    cursor += 86400000;
  }
  return dates;
}

/** Do [aStart, aEnd) and [bStart, bEnd) overlap? Touching endpoints do not. */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

module.exports = { offsetMs, zonedToUtc, utcToZoned, parseClock, datesBetween, overlaps };
