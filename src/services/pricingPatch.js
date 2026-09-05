// Puts Divya's prices onto the pages that ship with them baked in.
//
// The landing page is 5.6MB of hand-written HTML and paid-live-flow.js builds
// its modal from a template literal, so neither can read a price at runtime.
// Rather than edit those files (and re-edit them every time a price changes),
// the prices are substituted on the way out, the same way the WhatsApp number
// already is.
//
// The substitution is deliberately NOT a find-and-replace on the numbers
// themselves. Right now the blueprint's struck-through price and the
// consultation's real price are the same string - "₹4,999" - so replacing by
// value would set the consultation's price to the blueprint's "was" price the
// first time Divya touched either one. Everything here anchors on structure
// instead: the price ROW, in document order.

const pricing = require('./pricing');

// Card order on the landing page: free, blueprint, consultation. Only the two
// paid ones carry a price row with a struck-through price beside it.
const CARD_ORDER = ['paid_blueprint', 'consultation'];

// <div class="pcard-price-row"><span class="pcard-price">X</span><span class="pcard-og-price">Y</span></div>
const PRICE_ROW = /<div class="pcard-price-row"><span class="pcard-price">(?:(?!<\/div>).)*?<span class="pcard-og-price">(?:(?!<\/div>).)*?<\/span><\/div>/g;
const SAVE_BADGE = /<div class="pcard-save">Save\s*\d+%<\/div>/g;

function rowsByCode(rows) {
  const map = new Map();
  (rows || []).forEach(r => map.set(r.product_code, r));
  return map;
}

/** Entity-encoded rupee sign, because that is how landing.html writes it. */
function money(amount) {
  return '&#8377;' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function priceRowHtml(row) {
  const parts = [`<span class="pcard-price">${money(row.amount_inr)}</span>`];
  if (row.compare_at_inr != null && Number(row.compare_at_inr) > Number(row.amount_inr)) {
    parts.push(`<span class="pcard-og-price">${money(row.compare_at_inr)}</span>`);
  }
  return `<div class="pcard-price-row">${parts.join('')}</div>`;
}

function saveBadgeHtml(row) {
  const percent = pricing.savingPercent(row);
  if (percent != null) return `<div class="pcard-save">Save ${percent}%</div>`;
  // No discount, no badge - but the badge still holds its space. The three
  // cards sit side by side and everything below the badge is aligned across
  // them; deleting the element outright pulls one card's body a row higher
  // than its neighbours, which is a layout Divya would have caused just by
  // clearing a "was" price.
  return '<div class="pcard-save" style="visibility:hidden" aria-hidden="true">&nbsp;</div>';
}

/**
 * Landing page prices.
 *
 * Returns the html unchanged if the markup is not the shape we expect - a
 * mispatched page that still shows the old price is recoverable; a page with a
 * mangled pricing card is not.
 */
function patchLandingPrices(html, rows) {
  const byCode = rowsByCode(rows);
  const priceRows = html.match(PRICE_ROW) || [];
  const badges = html.match(SAVE_BADGE) || [];

  if (priceRows.length !== CARD_ORDER.length) {
    console.error(`[pricing] landing.html has ${priceRows.length} price rows, expected ${CARD_ORDER.length}; leaving prices as written`);
    return html;
  }

  let rowIndex = 0;
  let patched = html.replace(PRICE_ROW, match => {
    const row = byCode.get(CARD_ORDER[rowIndex++]);
    return row ? priceRowHtml(row) : match;
  });

  if (badges.length === CARD_ORDER.length) {
    let badgeIndex = 0;
    patched = patched.replace(SAVE_BADGE, match => {
      const row = byCode.get(CARD_ORDER[badgeIndex++]);
      return row ? saveBadgeHtml(row) : match;
    });
  } else {
    console.error(`[pricing] landing.html has ${badges.length} save badges, expected ${CARD_ORDER.length}; leaving badges as written`);
  }

  return patched;
}

/**
 * The two prices baked into the paid report modal: the blueprint's price tag in
 * the sidebar and the consultation's price in the upsell after the download.
 */
function patchPaidFlowScript(source, rows) {
  const byCode = rowsByCode(rows);
  const blueprint = byCode.get('paid_blueprint');
  const consultation = byCode.get('consultation');
  let out = source;

  if (blueprint) {
    out = out.replace(
      /(The Full Blueprint · )₹[\d,]+/g,
      (m, prefix) => prefix + pricing.formatInr(blueprint.amount_inr)
    );
  }
  if (consultation) {
    out = out.replace(
      /(class="dbp-meta"><span>)₹[\d,]+(<\/span>)/g,
      (m, before, after) => before + pricing.formatInr(consultation.amount_inr) + after
    );
  }
  return out;
}

module.exports = { patchLandingPrices, patchPaidFlowScript, CARD_ORDER };
