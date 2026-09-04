// Exercises the real availability engine. Every case here is one Divya or a
// customer could actually hit; the clock is injected so the suite is stable.

const { computeSlots, groupByDate, slotKeyFor } = require('../src/services/booking/availability');

const TZ = 'Asia/Kolkata';
let pass = 0, fail = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
}

// Thursday 10 Sept 2026. Weekday numbers are 0=Sun.
const NOW = new Date('2026-09-10T04:00:00Z');       // 09:30 IST Thursday
const FROM = new Date('2026-09-10T00:00:00Z');
const TO = new Date('2026-09-12T23:59:00Z');

const rule = (over = {}) => ({
  id: 'r', environment: 'test', weekday: 4, start_time: '18:00', end_time: '21:00',
  timezone_id: TZ, slot_duration_minutes: 60, buffer_before_minutes: 0,
  buffer_after_minutes: 0, max_bookings: null, is_active: true, ...over
});

const ist = s => new Date(s).toLocaleString('en-GB', { timeZone: TZ, hour12: false, dateStyle: 'short', timeStyle: 'short' });
const times = slots => slots.map(s => ist(s.starts_at));

console.log('--- basic generation ---');
{
  const slots = computeSlots({ rules: [rule()], from: FROM, to: TO, now: NOW });
  check('Thursday 18:00-21:00 in 60min steps gives 3 slots', times(slots), ['10/09/2026, 18:00', '10/09/2026, 19:00', '10/09/2026, 20:00']);
  check('slot carries its IST date', slots[0].date, '2026-09-10');
  // 18:00 IST is 12:30Z, so the hour ends at 13:30Z - not 13:00Z, which is what
  // I first wrote here by treating IST as a whole-hour offset. It is +05:30.
  check('end is one hour after start', slots[0].ends_at, '2026-09-10T13:30:00.000Z');
}
{
  // 18:00-21:00 with 90min slots fits 2, and must NOT emit a half slot at 21:00.
  const slots = computeSlots({ rules: [rule({ slot_duration_minutes: 90 })], from: FROM, to: TO, now: NOW });
  check('90 minute slots do not run past closing', times(slots), ['10/09/2026, 18:00', '10/09/2026, 19:30']);
}
{
  const slots = computeSlots({ rules: [rule({ is_active: false })], from: FROM, to: TO, now: NOW });
  check('an inactive rule produces nothing', slots.length, 0);
}
{
  const slots = computeSlots({ rules: [rule({ weekday: 6 })], from: FROM, to: TO, now: NOW });
  check('Saturday rule gives Saturday slots only', times(slots), ['12/09/2026, 18:00', '12/09/2026, 19:00', '12/09/2026, 20:00']);
}

console.log('\n--- minimum notice ---');
{
  // 09:30 IST now; a rule opening at 10:00 today is only 30 minutes away.
  const morning = rule({ start_time: '10:00', end_time: '13:00' });
  const soon = computeSlots({ rules: [morning], from: FROM, to: TO, now: NOW, minNoticeMinutes: 120 });
  check('2h notice hides the 10:00 and 11:00 slots', times(soon), ['10/09/2026, 12:00']);
  const none = computeSlots({ rules: [morning], from: FROM, to: TO, now: NOW, minNoticeMinutes: 0 });
  check('zero notice shows all three', times(none).length, 3);
}

console.log('\n--- clashes ---');
{
  const taken = [{ starts_at: '2026-09-10T13:00:00Z', ends_at: '2026-09-10T14:00:00Z' }]; // 18:30 IST
  const slots = computeSlots({ rules: [rule()], taken, from: FROM, to: TO, now: NOW });
  check('an existing booking removes the slots it overlaps', times(slots), ['10/09/2026, 20:00']);
}
{
  // Touching endpoints are not a clash: 18:00-19:00 booked leaves 19:00 free.
  const taken = [{ starts_at: '2026-09-10T12:30:00Z', ends_at: '2026-09-10T13:30:00Z' }]; // exactly 18:00-19:00 IST
  const slots = computeSlots({ rules: [rule()], taken, from: FROM, to: TO, now: NOW });
  check('a booking ending at 19:00 leaves 19:00 bookable', times(slots), ['10/09/2026, 19:00', '10/09/2026, 20:00']);
}
{
  const taken = [{ starts_at: '2026-09-10T12:30:00Z', ends_at: '2026-09-10T13:30:00Z', buffer_after_minutes: 30 }];
  const slots = computeSlots({ rules: [rule()], taken, from: FROM, to: TO, now: NOW });
  // Buffer pushes the obstacle to 14:00Z, which eats into the 19:00 slot
  // (13:30-14:30Z) but leaves 20:00 (14:30-15:30Z) untouched.
  check('a 30min buffer after a booking also clears the next slot', times(slots), ['10/09/2026, 20:00']);
}
{
  const busy = [{ start: '2026-09-10T12:00:00Z', end: '2026-09-10T14:00:00Z' }];
  const slots = computeSlots({ rules: [rule()], busy, from: FROM, to: TO, now: NOW });
  check("Divya's own calendar event blocks those hours", times(slots), ['10/09/2026, 20:00']);
}
{
  const blocked = [{ starts_at: '2026-09-10T00:00:00Z', ends_at: '2026-09-11T00:00:00Z' }];
  const slots = computeSlots({ rules: [rule()], blocked, from: FROM, to: TO, now: NOW });
  check('a blocked day removes the whole day', slots.length, 0);
}
{
  // The candidate's own before-buffer must be clear too.
  const taken = [{ starts_at: '2026-09-10T12:15:00Z', ends_at: '2026-09-10T12:30:00Z' }]; // 17:45-18:00 IST
  const plain = computeSlots({ rules: [rule()], taken, from: FROM, to: TO, now: NOW });
  check('a booking ending exactly at 18:00 does not block 18:00', times(plain).length, 3);
  const guarded = computeSlots({ rules: [rule({ buffer_before_minutes: 30 })], taken, from: FROM, to: TO, now: NOW });
  check('but it does when the new slot needs 30min run-up', times(guarded).length, 2);
}

console.log('\n--- daily cap ---');
{
  const slots = computeSlots({ rules: [rule({ max_bookings: 2 })], from: FROM, to: TO, now: NOW });
  check('max_bookings 2 caps the day at 2', times(slots), ['10/09/2026, 18:00', '10/09/2026, 19:00']);
}

console.log('\n--- overlapping rules ---');
{
  const rules = [rule(), rule({ id: 'r2', start_time: '20:00', end_time: '22:00' })];
  const slots = computeSlots({ rules, from: FROM, to: TO, now: NOW });
  check('two rules covering 20:00 emit it once', times(slots), ['10/09/2026, 18:00', '10/09/2026, 19:00', '10/09/2026, 20:00', '10/09/2026, 21:00']);
  check('slots come back in time order', slots.map(s => s.starts_at), [...slots.map(s => s.starts_at)].sort());
}

console.log('\n--- bad data must not throw ---');
{
  const bad = [
    rule({ start_time: 'evening' }), rule({ end_time: null }),
    rule({ start_time: '21:00', end_time: '18:00' }), rule({ slot_duration_minutes: 0 }),
    rule({ id: 'ok' })
  ];
  let slots;
  try { slots = computeSlots({ rules: bad, from: FROM, to: TO, now: NOW }); }
  catch (e) { slots = 'THREW: ' + e.message; }
  check('four broken rows are skipped, the good one still works', Array.isArray(slots) ? slots.length : slots, 3);
}

console.log('\n--- slot keys ---');
{
  check('key is stable for the same slot', slotKeyFor('2026-09-10T12:30:00.000Z', 60), slotKeyFor('2026-09-10T12:30:00Z', 60));
  check('key distinguishes duration', slotKeyFor('2026-09-10T12:30:00Z', 60) === slotKeyFor('2026-09-10T12:30:00Z', 90), false);
  const slots = computeSlots({ rules: [rule()], from: FROM, to: TO, now: NOW });
  check('generated keys are unique', new Set(slots.map(s => s.slot_key)).size, slots.length);
}

console.log('\n--- grouping ---');
{
  const rules = [rule(), rule({ id: 'sat', weekday: 6 })];
  const grouped = groupByDate(computeSlots({ rules, from: FROM, to: TO, now: NOW }));
  check('grouped by IST date', grouped.map(g => `${g.date}:${g.slots.length}`), ['2026-09-10:3', '2026-09-12:3']);
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : fail + ' CHECK(S) FAILED'} (${pass} passed)`);
process.exitCode = fail === 0 ? 0 : 1;
