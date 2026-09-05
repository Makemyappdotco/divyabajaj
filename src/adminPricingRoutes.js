// Divya's pricing controls. Mounted at /api/admin/pricing behind adminAuth.
//
// Like the schedule, prices are configuration of the deployment you are looking
// at, not a slice of analytics data, so they are NOT wired to the panel's
// Live/Test filter. Changing a price on a preview must never alter what the
// live site charges.

const express = require('express');
const crypto = require('crypto');
const db = require('./database');
const pricing = require('./services/pricing');

const router = express.Router();

function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function now() { return new Date().toISOString(); }
function scope() { return pricing.runtimeEnvironment(); }

function environmentLabel() {
  return scope() === 'production'
    ? 'your live site'
    : 'this preview site (your live site has its own separate prices)';
}

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Pricing needs Supabase; this environment is on local fallback storage.');
  return supabase;
}

function handle(name, fn) {
  return async (req, res) => {
    try {
      if (!db.usingSupabase()) {
        return res.status(503).json({ error: 'Pricing needs Supabase; this environment is on local fallback storage.' });
      }
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res);
    } catch (error) {
      console.error(`[pricing:${name}]`, error);
      return res.status(error.status || 500).json({ error: error.message || `${name} failed` });
    }
  };
}

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

router.get('/', handle('read', async (req, res) => {
  const environment = scope();
  const rows = await pricing.getPrices(environment);
  return res.json({
    environment,
    environment_label: environmentLabel(),
    products: rows.map(r => Object.assign({}, r, {
      formatted: pricing.formatInr(r.amount_inr),
      compare_at_formatted: r.compare_at_inr == null ? null : pricing.formatInr(r.compare_at_inr),
      saving_percent: pricing.savingPercent(r)
    }))
  });
}));

router.put('/', handle('write', async (req, res) => {
  const environment = scope();
  const items = Array.isArray(req.body && req.body.products) ? req.body.products : null;
  if (!items || !items.length) throw bad('Nothing to save.');

  const rows = items.map(item => {
    const code = String(item.product_code || '').trim();
    const known = pricing.PRODUCTS[code];
    if (!known) throw bad(`Unknown product: ${code}`);

    const amount = Number(item.amount_inr);
    // Razorpay's floor is 100 paise. A zero-rupee "paid" product would create an
    // order that can never be paid, so it is rejected here with a sentence
    // rather than failing later at checkout.
    if (!Number.isFinite(amount) || amount < 1) throw bad(`${known.label}: the price has to be at least ₹1.`);
    if (amount > 500000) throw bad(`${known.label}: ₹${amount} looks like a slip. The most allowed is ₹5,00,000.`);
    if (Math.round(amount) !== amount) throw bad(`${known.label}: use whole rupees, no paise.`);

    const compareRaw = item.compare_at_inr;
    const compare = compareRaw === '' || compareRaw == null ? null : Number(compareRaw);
    if (compare !== null) {
      if (!Number.isFinite(compare) || compare < 0) throw bad(`${known.label}: the "was" price is not a number.`);
      // A struck-through price at or below the real one advertises a discount
      // that does not exist, which is worse than showing none at all.
      if (compare <= amount) throw bad(`${known.label}: the "was" price has to be higher than the price, or left empty.`);
    }

    return {
      environment, product_code: code,
      label: String(item.label || known.label).slice(0, 80),
      amount_inr: amount,
      compare_at_inr: compare,
      is_active: true,
      updated_at: now()
    };
  });

  const supabase = client();
  for (const row of rows) {
    const existing = await supabase.from('product_prices').select('id')
      .eq('environment', environment).eq('product_code', row.product_code).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    const result = existing.data
      ? await supabase.from('product_prices').update(row).eq('id', existing.data.id)
      : await supabase.from('product_prices').insert(Object.assign({ id: id('prc'), created_at: now() }, row));
    if (result.error) throw new Error(result.error.message);
  }

  // The read path caches for 30 seconds; drop it so Divya sees her own change
  // immediately rather than wondering whether the save worked.
  pricing.clearCache();

  const fresh = await pricing.getPrices(environment);
  return res.json({
    success: true,
    environment,
    products: fresh.map(r => Object.assign({}, r, {
      formatted: pricing.formatInr(r.amount_inr),
      saving_percent: pricing.savingPercent(r)
    }))
  });
}));

module.exports = router;
