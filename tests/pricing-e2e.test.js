// End-to-end: Divya changes a price in the panel, and every surface follows -
// the landing card, the report modal, the booking form, and the Razorpay order.

const { BASE } = require('./base');
let passed = 0, failed = 0;

async function j(path, options) {
  const r = await fetch(BASE + path, options);
  const text = await r.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch (e) { body = { raw: text }; }
  return { status: r.status, body, text };
}
async function raw(path) { const r = await fetch(BASE + path); return { status: r.status, text: await r.text() }; }

function check(name, condition, detail) {
  if (condition) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '\n       ' + detail : '')); }
}

const put = products => j('/api/admin/pricing', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ products })
});

(async () => {
  await fetch(BASE + '/__reset', { method: 'POST' });
  console.log('\npricing end-to-end');

  // ---------------------------------------------------- before the change
  const before = await raw('/landing-test');
  check('landing starts at the advertised prices',
    before.text.includes('&#8377;999') && before.text.includes('Save 80%'),
    'seed prices not on the page');

  // ------------------------------------------------------- Divya's change
  const saved = await put([
    { product_code: 'paid_blueprint', amount_inr: 1499, compare_at_inr: 3999 },
    { product_code: 'consultation', amount_inr: 6500, compare_at_inr: null }
  ]);
  check('panel saves the new prices', saved.status === 200, JSON.stringify(saved.body));

  // ------------------------------------------------------ every surface
  const read = await j('/api/admin/pricing');
  check('panel reads back what it saved',
    read.body.products.some(p => p.product_code === 'paid_blueprint' && p.amount_inr === 1499) &&
    read.body.products.some(p => p.product_code === 'consultation' && p.amount_inr === 6500),
    JSON.stringify(read.body.products));

  const landing = await raw('/landing-test');
  check('landing card shows the blueprint at its new price',
    landing.text.includes('<span class="pcard-price">&#8377;1,499</span><span class="pcard-og-price">&#8377;3,999</span>'));
  check('landing badge is recomputed, not stale',
    landing.text.includes('Save 63%') && !landing.text.includes('Save 80%'));
  check('consultation card drops the struck-through price when there is none',
    landing.text.includes('<div class="pcard-price-row"><span class="pcard-price">&#8377;6,500</span></div>') &&
    !landing.text.includes('Save 50%'));
  check('no old price is left anywhere on the landing page',
    !landing.text.includes('&#8377;999<') && !landing.text.includes('&#8377;9,999'));

  const flow = await raw('/paid-live-flow.js');
  check('report modal quotes the new blueprint price', flow.text.includes('The Full Blueprint · ₹1,499'));
  check('report modal upsell quotes the new consultation price', flow.text.includes('class="dbp-meta"><span>₹6,500</span>'));

  const avail = await j('/api/booking/availability?days=30');
  check('booking form is quoted the new consultation price',
    avail.body.fee_inr === 6500, 'fee_inr=' + avail.body.fee_inr);

  // ------------------------------------------------- what actually charges
  const slot = (avail.body.days || []).flatMap(d => d.slots || []).find(Boolean);
  check('a slot is available to test the charge with', Boolean(slot));

  if (slot) {
    const hold = await j('/api/booking/hold', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_key: slot.slot_key, starts_at: slot.starts_at, ends_at: slot.ends_at })
    });
    check('slot held', hold.status === 200, JSON.stringify(hold.body));

    const booked = await j('/api/booking/book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hold_id: hold.body.hold_id, slot_key: slot.slot_key, name: 'Price Test', phone: '9812345678',
        email: 'price@example.com', dob: '1990-04-11', pob: 'Pune, India', question: 'checking the price'
      })
    });
    check('booking made', booked.status === 200, JSON.stringify(booked.body));

    const order = await j('/api/booking/payment/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: booked.body.appointment_id })
    });
    // 650000 paise. This is the assertion the whole feature exists for.
    check('Razorpay is asked for the NEW price, in paise',
      order.body.amount === 650000, 'amount=' + order.body.amount);

    // Divya changes the price again while this customer sits on the checkout.
    await put([{ product_code: 'consultation', amount_inr: 9000, compare_at_inr: null }]);
    const reopened = await j('/api/booking/payment/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: booked.body.appointment_id })
    });
    check('a customer mid-checkout still pays the price they were shown',
      reopened.body.amount === 650000, 'amount=' + reopened.body.amount);
  }

  // ------------------------------------------------------------ rejections
  const tooLow = await put([{ product_code: 'consultation', amount_inr: 0 }]);
  check('a zero price is refused', tooLow.status === 400, JSON.stringify(tooLow.body));

  const paise = await put([{ product_code: 'consultation', amount_inr: 499.5 }]);
  check('paise are refused', paise.status === 400, JSON.stringify(paise.body));

  const fakeDiscount = await put([{ product_code: 'consultation', amount_inr: 5000, compare_at_inr: 4000 }]);
  check('a "was" price below the price is refused', fakeDiscount.status === 400, JSON.stringify(fakeDiscount.body));

  const equalDiscount = await put([{ product_code: 'consultation', amount_inr: 5000, compare_at_inr: 5000 }]);
  check('a "was" price equal to the price is refused', equalDiscount.status === 400, JSON.stringify(equalDiscount.body));

  const silly = await put([{ product_code: 'consultation', amount_inr: 900000 }]);
  check('an absurd price is refused', silly.status === 400, JSON.stringify(silly.body));

  const unknown = await put([{ product_code: 'free_report', amount_inr: 100 }]);
  check('an unknown product is refused', unknown.status === 400, JSON.stringify(unknown.body));

  const afterRejects = await j('/api/admin/pricing');
  const consult = afterRejects.body.products.find(p => p.product_code === 'consultation');
  check('nothing was half-saved by the rejected attempts',
    consult && consult.amount_inr === 9000, JSON.stringify(consult));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
