// What each product costs.
//
// One source of truth, read from the database, so Divya can change a price in
// the admin panel and have the landing page, the booking modal and the actual
// Razorpay charge all follow. Before this, the price lived in four places -
// hardcoded twice on the landing page, once in a served script, and once in an
// environment variable - which is how a site ends up advertising one number and
// charging another.

const db = require('../database');

const PRODUCTS = {
  consultation: { label: 'Private consultation', fallback: 4999, fallbackCompareAt: 9999 },
  paid_blueprint: { label: 'The Full Blueprint', fallback: 999, fallbackCompareAt: 4999 }
};

// Prices are read on nearly every page render, so they are cached briefly.
// Short enough that Divya sees her own change almost immediately, long enough
// that a burst of traffic is not a burst of queries.
const TTL_MS = 30 * 1000;
let cache = { at: 0, environment: null, rows: null };

function runtimeEnvironment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production' ? 'production' : 'test';
  return process.env.NODE_ENV === 'production' ? 'production' : 'test';
}

function fallbackRows() {
  return Object.entries(PRODUCTS).map(([product_code, p]) => ({
    product_code, label: p.label, amount_inr: p.fallback, compare_at_inr: p.fallbackCompareAt, is_active: true
  }));
}

function clearCache() { cache = { at: 0, environment: null, rows: null }; }

/**
 * Every active price for this deployment.
 *
 * Never throws: a database blip must not take the landing page down or, worse,
 * leave a price blank next to a Buy button. It falls back to what the site has
 * always advertised and logs loudly.
 */
async function getPrices(environment = runtimeEnvironment()) {
  if (cache.rows && cache.environment === environment && Date.now() - cache.at < TTL_MS) return cache.rows;

  const supabase = db.getSupabaseClient();
  if (!supabase) return fallbackRows();

  try {
    const { data, error } = await supabase
      .from('product_prices')
      .select('product_code, label, amount_inr, compare_at_inr, is_active')
      .eq('environment', environment).eq('is_active', true);
    if (error) throw new Error(error.message);

    const rows = (data || []).map(r => ({
      product_code: r.product_code,
      label: r.label || (PRODUCTS[r.product_code] && PRODUCTS[r.product_code].label) || r.product_code,
      amount_inr: Number(r.amount_inr),
      compare_at_inr: r.compare_at_inr == null ? null : Number(r.compare_at_inr),
      is_active: r.is_active !== false
    })).filter(r => Number.isFinite(r.amount_inr));

    // A product missing from the table still needs a price rather than a blank.
    const known = new Set(rows.map(r => r.product_code));
    fallbackRows().forEach(r => { if (!known.has(r.product_code)) rows.push(r); });

    cache = { at: Date.now(), environment, rows };
    return rows;
  } catch (error) {
    console.error('[pricing] falling back to defaults:', error.message);
    return fallbackRows();
  }
}

/** One product's price in rupees. This is what the charge is built from. */
async function priceOf(productCode, environment = runtimeEnvironment()) {
  const rows = await getPrices(environment);
  const row = rows.find(r => r.product_code === productCode);
  if (row) return row;
  const fallback = PRODUCTS[productCode];
  if (!fallback) throw new Error(`Unknown product: ${productCode}`);
  return { product_code: productCode, label: fallback.label, amount_inr: fallback.fallback, compare_at_inr: fallback.fallbackCompareAt, is_active: true };
}

/** ₹4,999 - Indian digit grouping, as the site already writes it. */
function formatInr(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/**
 * The discount badge, derived rather than stored, so it can never disagree with
 * the two numbers beside it. Returns null when there is nothing to boast about.
 */
function savingPercent(row) {
  const price = Number(row.amount_inr);
  const was = Number(row.compare_at_inr);
  if (!Number.isFinite(was) || !Number.isFinite(price) || was <= price || was <= 0) return null;
  return Math.round(((was - price) / was) * 100);
}

module.exports = { getPrices, priceOf, formatInr, savingPercent, clearCache, runtimeEnvironment, PRODUCTS };
