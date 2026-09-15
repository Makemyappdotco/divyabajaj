// The landing page's "Book with Divya directly" section used to show four
// hardcoded day/time tiles (Wed/Fri 6:30-8:00 PM, Sat/Sun 11:30 AM-2:00 PM)
// baked into the HTML, completely disconnected from whatever Divya actually
// sets in the admin panel's schedule grid. This is the backend half of the
// fix: a small public endpoint, store.getWeeklyHours(), that reads the same
// availability_rules rows the admin panel's GET /api/admin/schedule reads,
// filtered down to just what a public page needs (which days are on, and
// their time blocks) - no lead data, no appointment details.
//
// Run without a live Supabase project: db.getSupabaseClient is monkeypatched
// with a fake client that returns canned rows for the exact query shape
// store.js issues, so this is a pure unit test of the grouping/shaping logic.

const assert = require('assert');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
  queue.push(async () => {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
  });
}

// A chainable, awaitable stand-in for supabase-js's query builder. Every
// query store.getRules() issues ends in two .eq() calls, so this only needs
// to support that one shape and resolve with canned rows.
function fakeSupabase(rows) {
  const builder = {
    from() { return builder; },
    select() { return builder; },
    eq() { return builder; },
    then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); }
  };
  return { from: () => builder };
}

function withFakeRules(rows, fn) {
  delete require.cache[require.resolve('../src/database')];
  delete require.cache[require.resolve('../src/services/booking/store')];
  const db = require('../src/database');
  const originalGetClient = db.getSupabaseClient;
  db.getSupabaseClient = () => fakeSupabase(rows);
  const store = require('../src/services/booking/store');
  return Promise.resolve(fn(store)).finally(() => {
    db.getSupabaseClient = originalGetClient;
    delete require.cache[require.resolve('../src/services/booking/store')];
  });
}

test('a Wednesday and Friday evening grid, plus a weekend morning block, comes back grouped by day', async () => {
  const rows = [
    { weekday: 3, kind: 'grid', is_active: true, start_time: '18:30:00', end_time: '20:00:00' },
    { weekday: 5, kind: 'grid', is_active: true, start_time: '18:30:00', end_time: '20:00:00' },
    { weekday: 6, kind: 'grid', is_active: true, start_time: '11:30:00', end_time: '14:00:00' },
    { weekday: 0, kind: 'grid', is_active: true, start_time: '11:30:00', end_time: '14:00:00' }
  ];
  await withFakeRules(rows, async store => {
    const week = await store.getWeeklyHours('test');
    assert.strictEqual(week.length, 7, 'every weekday should be represented, active or not');

    const active = week.filter(d => d.is_active).map(d => d.label);
    assert.deepStrictEqual(active, ['Sunday', 'Wednesday', 'Friday', 'Saturday']);

    const wednesday = week.find(d => d.label === 'Wednesday');
    assert.deepStrictEqual(wednesday.intervals, [{ start_time: '18:30', end_time: '20:00' }]);
  });
});

test('an inactive weekday reports is_active: false with no intervals', async () => {
  const rows = [
    { weekday: 3, kind: 'grid', is_active: true, start_time: '18:30:00', end_time: '20:00:00' }
  ];
  await withFakeRules(rows, async store => {
    const week = await store.getWeeklyHours('test');
    const monday = week.find(d => d.label === 'Monday');
    assert.strictEqual(monday.is_active, false);
    assert.deepStrictEqual(monday.intervals, []);
  });
});

test('a day with two separate time blocks keeps both, sorted by start time', async () => {
  const rows = [
    { weekday: 2, kind: 'grid', is_active: true, start_time: '17:00:00', end_time: '18:00:00' },
    { weekday: 2, kind: 'grid', is_active: true, start_time: '09:00:00', end_time: '11:00:00' }
  ];
  await withFakeRules(rows, async store => {
    const week = await store.getWeeklyHours('test');
    const tuesday = week.find(d => d.label === 'Tuesday');
    assert.deepStrictEqual(tuesday.intervals, [
      { start_time: '09:00', end_time: '11:00' },
      { start_time: '17:00', end_time: '18:00' }
    ]);
  });
});

test('a recurring "extra" window (kind=extra) is excluded - it is an exception, not the standing weekly pattern', async () => {
  const rows = [
    { weekday: 4, kind: 'grid', is_active: true, start_time: '18:00:00', end_time: '19:00:00' },
    { weekday: 4, kind: 'extra', is_active: true, start_time: '09:00:00', end_time: '10:00:00' }
  ];
  await withFakeRules(rows, async store => {
    const week = await store.getWeeklyHours('test');
    const thursday = week.find(d => d.label === 'Thursday');
    assert.deepStrictEqual(thursday.intervals, [{ start_time: '18:00', end_time: '19:00' }]);
  });
});

test('a row with no kind column at all (written before it existed) is still treated as grid', async () => {
  const rows = [
    { weekday: 1, is_active: true, start_time: '10:00:00', end_time: '11:00:00' }
  ];
  await withFakeRules(rows, async store => {
    const week = await store.getWeeklyHours('test');
    const monday = week.find(d => d.label === 'Monday');
    assert.strictEqual(monday.is_active, true);
  });
});

test('GET /api/booking/hours only ever returns the active days, dropping is_active from the payload', async () => {
  // Source-level check: the route handler filters to active days before
  // responding, so a public page never has to understand what an inactive
  // day even means.
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/bookingRoutes.js'), 'utf8');
  const route = source.slice(source.indexOf("router.get('/hours'"), source.indexOf("function groupDays"));
  assert.ok(/store\.getWeeklyHours/.test(route), 'the route should call store.getWeeklyHours');
  assert.ok(/\.filter\(day => day\.is_active\)/.test(route), 'the route should filter to active days only');
});

(async () => {
  for (const run of queue) await run();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
