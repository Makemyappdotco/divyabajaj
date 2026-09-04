const B = 'http://127.0.0.1:4400/api/booking';
const post = (p, body) => fetch(B + p, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
  .then(async r => ({ status: r.status, body: await r.json() }));
const get = p => fetch(B + p).then(r => r.json());
let pass = 0, fail = 0;
const check = (label, ok, detail='') => { ok ? pass++ : fail++; console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':'  <- '+detail}`); };

(async () => {
  const avail = await get('/availability?days=21');
  const day = avail.days[2];
  const slot = day.slots[0];

  console.log('--- the slot already booked in the click-through ---');
  const booked = avail.days.flatMap(d => d.slots).some(s => s.slot_key === '2026-09-06T07:00:00Z_60');
  check('a booked slot disappears from availability', !booked);
  const buffered = avail.days.flatMap(d => d.slots).some(s => s.slot_key === '2026-09-06T08:00:00Z_60');
  check('the 15 min buffer after it does NOT eat the next slot (60min gap)', buffered);

  console.log('\n--- two people, one slot ---');
  const [a, b] = await Promise.all([
    post('/hold', { slot_key: slot.slot_key, starts_at: slot.starts_at, ends_at: slot.ends_at }),
    post('/hold', { slot_key: slot.slot_key, starts_at: slot.starts_at, ends_at: slot.ends_at })
  ]);
  const wins = [a, b].filter(r => r.status === 200).length;
  const loses = [a, b].filter(r => r.status === 409).length;
  check('exactly one hold wins', wins === 1, `${wins} won`);
  check('the other gets a clean 409, not a crash', loses === 1 && /took that slot|no longer available/i.test((a.body.error||'') + (b.body.error||'')),
        JSON.stringify([a.body.error, b.body.error]));

  const winner = a.status === 200 ? a.body : b.body;

  console.log('\n--- held slot is off the market ---');
  const after = await get('/availability?days=21');
  check('a held slot is hidden from everyone else', !after.days.flatMap(d=>d.slots).some(s => s.slot_key === slot.slot_key));

  console.log('\n--- tampering ---');
  const tampered = await post('/book', {
    hold_id: winner.hold_id, slot_key: 'i-made-this-up',
    name:'Hacker', phone:'9999999999', email:'h@x.com', dob:'1990-01-01', pob:'X'
  });
  check('a slot_key that does not match the hold is rejected', tampered.status === 409, JSON.stringify(tampered.body));

  const fakeSlot = await post('/hold', {
    slot_key: '2026-09-09T20:00:00Z_60', starts_at: '2026-09-09T20:00:00Z', ends_at: '2026-09-09T21:00:00Z'
  });
  check('a 1:30am slot she never offered is rejected', fakeSlot.status === 409, JSON.stringify(fakeSlot.body));

  console.log('\n--- validation ---');
  const bad = await post('/book', { hold_id: winner.hold_id, slot_key: slot.slot_key, name:'A', phone:'123', email:'nope', dob:'', pob:'' });
  check('short name / bad phone / bad email rejected with a readable message', bad.status === 400 && bad.body.error.length > 10, JSON.stringify(bad.body));

  const noHold = await post('/book', { name:'Someone', phone:'9876543210', email:'a@b.com', dob:'1990-01-01', pob:'Delhi' });
  check('booking with no hold at all is rejected', noHold.status === 400, JSON.stringify(noHold.body));

  console.log('\n--- unknown / stale hold ---');
  const ghost = await post('/book', { hold_id:'hold_doesnotexist', slot_key: slot.slot_key, name:'Ghost', phone:'9876543210', email:'g@x.com', dob:'1990-01-01', pob:'Delhi' });
  check('an unknown hold id is rejected as expired', ghost.status === 409, JSON.stringify(ghost.body));

  console.log(`\n${fail===0?'ALL CHECKS PASSED':fail+' FAILED'} (${pass} passed)`);
  process.exitCode = fail === 0 ? 0 : 1;
})();
