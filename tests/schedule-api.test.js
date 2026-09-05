// Run against the local harness in /tmp/bookpreview (node server.js). Each suite
// resets the harness first, so they are order independent.
const B='http://127.0.0.1:4402/api/admin/schedule?environment=test';
const S='http://127.0.0.1:4402/api/admin/schedule';
const req=(p,m,b)=>fetch(S+p+'?environment=test',{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined})
  .then(async r=>({status:r.status, body:await r.json()}));
const avail=()=>fetch('http://127.0.0.1:4402/api/booking/availability?days=21').then(r=>r.json());
let pass=0,fail=0;
const check=(l,ok,d='')=>{ok?pass++:fail++;console.log(`${ok?'PASS':'FAIL'}  ${l}${ok?'':'  <- '+d}`)};
const week=(over={})=>[0,1,2,3,4,5,6].map(w=>Object.assign(
  {weekday:w,is_active:false,start_time:'18:00',end_time:'20:00',slot_duration_minutes:60,buffer_after_minutes:15,buffer_before_minutes:0,max_bookings:null}, over[w]||{}));

(async()=>{
  await fetch('http://127.0.0.1:4402/__reset',{method:'POST'});
  console.log('--- validation rejects nonsense with a readable sentence ---');
  let r = await req('/hours','PUT',{week:week({1:{is_active:true,start_time:'20:00',end_time:'18:00'}})});
  check('end before start rejected', r.status===400 && /after the start/.test(r.body.error), JSON.stringify(r.body));
  r = await req('/hours','PUT',{week:week({2:{is_active:true,start_time:'18:00',end_time:'18:30',slot_duration_minutes:60}})});
  check('window shorter than one call rejected', r.status===400 && /not long enough/.test(r.body.error), JSON.stringify(r.body));
  r = await req('/hours','PUT',{week:week({3:{is_active:true,start_time:'evening',end_time:'20:00'}})});
  check('garbage time rejected', r.status===400 && /18:30/.test(r.body.error), JSON.stringify(r.body));
  r = await req('/hours','PUT',{week:week({4:{is_active:true,max_bookings:99}})});
  check('silly daily cap rejected', r.status===400 && /1 to 20/.test(r.body.error), JSON.stringify(r.body));
  const before = await avail();
  check('a rejected save changes nothing', before.days.length > 0, 'availability went empty');

  console.log('\n--- saving real hours ---');
  r = await req('/hours','PUT',{week:week({1:{is_active:true,start_time:'10:00',end_time:'13:00',slot_duration_minutes:45,buffer_after_minutes:15}})});
  check('valid week saves', r.status===200 && r.body.active_days===1, JSON.stringify(r.body));
  const after = await avail();
  const days = after.days.map(d=>new Date(d.slots[0].starts_at).toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata',weekday:'short'}));
  check('only Monday is offered now', days.every(d=>d==='Mon') && days.length>0, JSON.stringify(days.slice(0,4)));
  const first = after.days[0].slots;
  check('45 minute slots, 4 in a 3 hour morning', first.length===4 && first[0].duration_minutes===45, JSON.stringify(first.map(s=>s.duration_minutes)));

  console.log('\n--- switching every day off ---');
  r = await req('/hours','PUT',{week:week()});
  check('all days off saves', r.status===200 && r.body.active_days===0, JSON.stringify(r.body));
  const none = await avail();
  check('booking page reports not configured', none.configured===false && none.days.length===0, JSON.stringify({c:none.configured,d:none.days.length}));

  console.log('\n--- time off ---');
  await req('/hours','PUT',{week:week({1:{is_active:true,start_time:'10:00',end_time:'13:00'},3:{is_active:true,start_time:'18:30',end_time:'20:30'}})});
  const withBoth = await avail();
  const mondays = withBoth.days.filter(d=>new Date(d.slots[0].starts_at).toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata',weekday:'short'})==='Mon');
  check('Mondays present before blocking', mondays.length>0);
  const target = mondays[0].date;
  r = await req('/block','POST',{starts_at:target+'T00:00:00+05:30', ends_at:target+'T23:59:59+05:30', reason:'travel'});
  check('block accepted', r.status===200 && r.body.success, JSON.stringify(r.body));
  const blocked = await avail();
  check('that Monday is gone', !blocked.days.some(d=>d.date===target), target);
  check('other days survive', blocked.days.length>0);

  const read = await fetch(B).then(r=>r.json());
  check('block shows in the panel', read.blocked.length===1 && read.blocked[0].reason==='travel', JSON.stringify(read.blocked));
  r = await req('/block/'+read.blocked[0].id,'DELETE');
  check('unblock works', r.status===200);
  const restored = await avail();
  check('the Monday comes back', restored.days.some(d=>d.date===target));

  console.log('\n--- blocking a day that already has a booking warns instead of silently hiding it ---');
  const slot = restored.days[0].slots[0];
  const h = await fetch('http://127.0.0.1:4402/api/booking/hold',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slot_key:slot.slot_key,starts_at:slot.starts_at,ends_at:slot.ends_at})}).then(r=>r.json());
  await fetch('http://127.0.0.1:4402/api/booking/book',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({hold_id:h.hold_id,slot_key:slot.slot_key,name:'Booked Person',phone:'9876543210',email:'b@x.com',dob:'1990-01-01',pob:'Delhi'})}).then(r=>r.json());
  r = await req('/block','POST',{starts_at:restored.days[0].date+'T00:00:00+05:30', ends_at:restored.days[0].date+'T23:59:59+05:30'});
  check('warns about the existing booking', r.body.existing_bookings_in_range===1 && /does not cancel/.test(r.body.warning||''), JSON.stringify(r.body));

  console.log('\n--- cancelling releases the slot ---');
  const sched = await fetch(B).then(r=>r.json());
  check('the booking shows in upcoming with the customer name', sched.upcoming.length===1 && sched.upcoming[0].lead.name==='Booked Person', JSON.stringify(sched.upcoming.map(u=>u.lead)));
  r = await req('/appointment/'+sched.upcoming[0].id+'/cancel','POST',{reason:'test'});
  check('cancel succeeds', r.status===200 && r.body.appointment.status==='cancelled', JSON.stringify(r.body).slice(0,120));
  const afterCancel = await fetch(B).then(r=>r.json());
  check('it leaves the upcoming list', afterCancel.upcoming.length===0);

  console.log(`\n${fail===0?'ALL CHECKS PASSED':fail+' FAILED'} (${pass} passed)`);
  process.exitCode = fail===0?0:1;
})();
