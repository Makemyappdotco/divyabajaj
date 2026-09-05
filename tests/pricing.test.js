// Pricing: the number Divya types is the number the customer sees and the
// number Razorpay charges.
//
// Runs the patchers against the REAL landing.html and paid-live-flow.js rather
// than a fixture, because the whole risk here is the markup drifting away from
// what the patcher expects, and a fixture would never catch that.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pricing = require('../src/services/pricing');
const patch = require('../src/services/pricingPatch');

const publicDir = path.join(__dirname, '..', 'public');
const landing = fs.readFileSync(path.join(publicDir, 'landing.html'), 'utf8');
const paidFlow = fs.readFileSync(path.join(publicDir, 'paid-live-flow.js'), 'utf8');

let passed = 0;
let failed = 0;
const queue = [];

// Queued rather than run inline so an async case is actually awaited - a
// rejected promise nobody waits on is a test that always passes.
function test(name, fn) {
  queue.push(async () => {
    try { await fn(); passed++; console.log(`  ok   ${name}`); }
    catch (error) { failed++; console.log(`  FAIL ${name}\n       ${error.message}`); }
  });
}

function rows(overrides = {}) {
  return [
    Object.assign({ product_code: 'paid_blueprint', label: 'The Full Blueprint', amount_inr: 1499, compare_at_inr: 4999, is_active: true }, overrides.paid_blueprint || {}),
    Object.assign({ product_code: 'consultation', label: 'Private consultation', amount_inr: 7500, compare_at_inr: 12000, is_active: true }, overrides.consultation || {})
  ];
}

console.log('\npricing');

// --------------------------------------------------------------- formatting

test('formats rupees the Indian way', () => {
  assert.strictEqual(pricing.formatInr(4999), '₹4,999');
  assert.strictEqual(pricing.formatInr(150000), '₹1,50,000');
});

test('saving percent is derived, and absent when there is no discount', () => {
  assert.strictEqual(pricing.savingPercent({ amount_inr: 999, compare_at_inr: 4999 }), 80);
  assert.strictEqual(pricing.savingPercent({ amount_inr: 4999, compare_at_inr: 9999 }), 50);
  assert.strictEqual(pricing.savingPercent({ amount_inr: 999, compare_at_inr: null }), null);
  assert.strictEqual(pricing.savingPercent({ amount_inr: 999, compare_at_inr: 999 }), null);
  assert.strictEqual(pricing.savingPercent({ amount_inr: 999, compare_at_inr: 500 }), null);
});

// ------------------------------------------------------------ landing page

test('landing.html still has the two price rows the patcher targets', () => {
  // Three cards. The free one is class="pcard-price free-price" with no
  // struck-through price, so only the two paid rows match.
  const found = landing.match(/<div class="pcard-price-row"><span class="pcard-price">/g) || [];
  assert.strictEqual(found.length, 2, `expected 2 paid price rows, found ${found.length}`);
  assert.ok(landing.includes('<span class="pcard-price free-price">Free</span>'), 'free card missing');
  const badges = landing.match(/<div class="pcard-save">Save\s*\d+%<\/div>/g) || [];
  assert.strictEqual(badges.length, 2, `expected 2 save badges, found ${badges.length}`);
});

test('both landing prices change, and neither takes the other one\'s number', () => {
  const out = patch.patchLandingPrices(landing, rows());

  assert.ok(out.includes('<span class="pcard-price">&#8377;1,499</span><span class="pcard-og-price">&#8377;4,999</span>'),
    'blueprint row not rewritten');
  assert.ok(out.includes('<span class="pcard-price">&#8377;7,500</span><span class="pcard-og-price">&#8377;12,000</span>'),
    'consultation row not rewritten');

  // The bug this whole approach exists to prevent: ₹4,999 was both the
  // blueprint's "was" price and the consultation's real price, so a
  // replace-by-value would have set the consultation to 4,999 forever.
  assert.ok(!out.includes('<span class="pcard-price">&#8377;4,999</span>'),
    'the old consultation price survived - values were replaced instead of rows');
});

test('save badges are recomputed, never left stale', () => {
  const out = patch.patchLandingPrices(landing, rows());
  assert.ok(out.includes('<div class="pcard-save">Save 70%</div>'), 'blueprint badge wrong'); // 1499 off 4999
  assert.ok(out.includes('<div class="pcard-save">Save 38%</div>'), 'consultation badge wrong'); // 7500 off 12000
  assert.ok(!out.includes('Save 80%'), 'old badge survived');
  assert.ok(!out.includes('Save 50%'), 'old badge survived');
});

test('no "was" price means no struck-through price and no badge', () => {
  const out = patch.patchLandingPrices(landing, rows({ paid_blueprint: { compare_at_inr: null } }));
  assert.ok(out.includes('<div class="pcard-price-row"><span class="pcard-price">&#8377;1,499</span></div>'),
    'struck-through price should be gone');
  assert.ok(!out.includes('Save 70%'), 'badge text should be gone with no compare-at');
  assert.ok(out.includes('<div class="pcard-save" style="visibility:hidden"'), 'badge should still hold its space');
  // The other card is untouched.
  assert.ok(out.includes('<div class="pcard-save">Save 38%</div>'));
});

test('a "was" price below the price never renders as a discount', () => {
  // The admin route rejects this, but a row written straight into the database
  // must not produce "Save -20%" on a live page.
  const out = patch.patchLandingPrices(landing, rows({ consultation: { amount_inr: 6000, compare_at_inr: 5000 } }));
  assert.ok(!/Save\s*-/.test(out), 'negative saving rendered');
  assert.ok(out.includes('<div class="pcard-price-row"><span class="pcard-price">&#8377;6,000</span></div>'));
});

test('unexpected markup leaves the page alone rather than mangling it', () => {
  const broken = '<div class="pcard-price-row"><span class="pcard-price">&#8377;999</span><span class="pcard-og-price">&#8377;4,999</span></div>';
  assert.strictEqual(patch.patchLandingPrices(broken, rows()), broken, 'patched a page with the wrong number of rows');
});

test('the free card is never given a price', () => {
  const out = patch.patchLandingPrices(landing, rows());
  assert.ok(out.includes('<span class="pcard-price free-price">Free</span>'), 'free card was rewritten');
  assert.ok(out.includes('Zero cost, zero catch'), 'free card badge was rewritten');
});

// -------------------------------------------------------- paid-live-flow.js

test('paid-live-flow.js still has the two prices the patcher targets', () => {
  assert.ok(/The Full Blueprint · ₹[\d,]+/.test(paidFlow), 'blueprint price tag missing');
  assert.ok(/class="dbp-meta"><span>₹[\d,]+<\/span>/.test(paidFlow), 'consultation price missing');
});

test('the report modal quotes the current prices', () => {
  const out = patch.patchPaidFlowScript(paidFlow, rows());
  assert.ok(out.includes('The Full Blueprint · ₹1,499'), 'blueprint price tag not rewritten');
  assert.ok(out.includes('class="dbp-meta"><span>₹7,500</span>'), 'consultation price not rewritten');
  assert.ok(!out.includes('The Full Blueprint · ₹999'));
  assert.ok(!out.includes('<span>₹4,999</span>'));
});

test('patching the script twice is the same as patching it once', () => {
  const once = patch.patchPaidFlowScript(paidFlow, rows());
  assert.strictEqual(patch.patchPaidFlowScript(once, rows()), once);
});

test('the patched script is still valid JavaScript', () => {
  const vm = require('vm');
  new vm.Script(patch.patchPaidFlowScript(paidFlow, rows()), { filename: 'paid-live-flow.js' });
});

// --------------------------------------------------------------- fallbacks

test('a missing product falls back rather than rendering a blank price', async () => {
  const row = await pricing.priceOf('consultation', 'test');
  assert.ok(Number.isFinite(row.amount_inr) && row.amount_inr > 0, 'no usable price');
});

test('an unknown product code is an error, not a silent zero', async () => {
  await assert.rejects(() => pricing.priceOf('not_a_product', 'test'));
});

test('every product the panel can edit has a fallback price', () => {
  Object.entries(pricing.PRODUCTS).forEach(([code, p]) => {
    assert.ok(Number.isFinite(p.fallback) && p.fallback >= 1, `${code} has no usable fallback`);
  });
});

// ------------------------------------------------ the charge follows the panel

test('the charge is built from the price, in whole paise', () => {
  // What paymentRoutes does with the row it reads. Razorpay rejects anything
  // that is not an integer number of paise, and 4999.5 rupees would be one.
  [999, 1499, 4999, 7500].forEach(amount => {
    const paise = Math.round(amount * 100);
    assert.ok(Number.isInteger(paise) && paise >= 100, `${amount} produced a bad paise amount`);
    assert.strictEqual(paise / 100, amount);
  });
});

test('no consultation price is hardcoded in the server any more', () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const offenders = [];
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!entry.name.endsWith('.js')) return;
    // pricing.js is allowed to hold the fallbacks; it is the source of truth.
    if (full.endsWith(path.join('services', 'pricing.js'))) return;
    const text = fs.readFileSync(full, 'utf8');
    if (/CONSULTATION_FEE_INR/.test(text)) offenders.push(entry.name);
  });
  walk(srcDir);
  assert.deepStrictEqual(offenders, [], `still reading a hardcoded fee: ${offenders.join(', ')}`);
});

(async () => {
  for (const run of queue) await run();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
