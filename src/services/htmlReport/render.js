// Renders the Integrated Life Report as HTML (the permanent visual source of
// truth) and prints that exact HTML to a PDF with headless Chromium. The
// design lives entirely in css.js / pages.js / the extracted image assets -
// this file only wires report_json into that fixed template and drives the
// browser. It never asks anything generative to redesign the page; the same
// template renders identically for every customer, every time.

const path = require('path');
// puppeteer-core (25.x) and @sparticuz/chromium are both pure ESM packages.
// require()'ing either one throws ERR_REQUIRE_ESM and crashes the *entire
// app* on cold start, since this used to be a top-level require executed for
// every route, not just the PDF one - confirmed via Vercel runtime logs.
// Both are now loaded lazily via dynamic import() inside getBrowser(), which
// works under both CJS and ESM regardless of Node version, and only runs
// when a PDF is actually being generated.

const { loadFontFaceCss, loadImages } = require('./assets');
const buildCss = require('./css');
const { buildFlowSections, tocEntries } = require('./content');
const { flattenUnits, measureAllHeightsPx, packPages } = require('./paginate');
const { coverPageHtml, tocPageHtml, onePageSummaryHtml, flowPageHtml } = require('./pages');

// Section key -> which physical page number in the TOC it should show,
// resolved after pagination. Kept as a plain lookup rather than re-deriving
// from content.js so the TOC numbering logic stays in one place (content.js).
function sectionKeyForTocNumber(number, hasOnePage) {
  const order = [
    'how_to_read', 'glance', 'personal_nature', 'past_life_karma', 'finances',
    'marriage', 'health', 'children', 'property', 'remedies', 'timing_map',
    'closing_summary', 'scope_limitations'
  ];
  const idx = hasOnePage ? Number(number) - 2 : Number(number) - 1;
  return order[idx];
}

let _browserPromise = null;
async function getBrowser() {
  if (_browserPromise) return _browserPromise;
  _browserPromise = (async () => {
    const [puppeteerModule, chromiumModule] = await Promise.all([
      import('puppeteer-core'),
      import('@sparticuz/chromium')
    ]);
    const puppeteer = puppeteerModule.default || puppeteerModule;
    const chromium = chromiumModule.default || chromiumModule;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
    });
  })().catch(err => {
    _browserPromise = null;
    throw err;
  });
  return _browserPromise;
}

/**
 * @param {object} args
 * @param {{name:string, dob:string, tob:string, pob:string}} args.lead
 * @param {object} args.report - the report_json.report object from paidReportV2
 * @param {object} [args.onePage] - optional "Your Report In One Page" content.
 *   paidReportV2 now generates this as report_json.one_page, so it is read from
 *   the report itself unless a caller passes it explicitly. Reports generated
 *   before that (or any report missing it) simply skip the page rather than
 *   having content invented for them.
 */
async function buildReportHtml({ lead, report, onePage }) {
  const summary = onePage || report?.one_page || null;
  const hasOnePage = !!(summary && (summary.strongest_signal || (summary.pulse || []).length));
  const fontFaceCss = loadFontFaceCss();
  const images = loadImages();
  const css = buildCss(fontFaceCss, images);

  const browser = await getBrowser();
  const measurePage = await browser.newPage();
  try {
    const sections = buildFlowSections(report, hasOnePage);
    const units = flattenUnits(sections);
    const heightsPx = await measureAllHeightsPx(measurePage, css, units);
    const { pages, sectionPageIndex } = packPages(units, heightsPx);

    const fixedPageCount = hasOnePage ? 3 : 2; // cover + toc [+ one-page]
    const entries = tocEntries(hasOnePage).map(([num, label]) => {
      if (hasOnePage && num === '01') return [num, label, 3];
      const key = sectionKeyForTocNumber(num, hasOnePage);
      const pageNo = key in sectionPageIndex ? fixedPageCount + 1 + sectionPageIndex[key] : '-';
      return [num, label, pageNo];
    });

    const bodyHtml = [
      coverPageHtml(lead, images),
      tocPageHtml(entries, images),
      hasOnePage ? onePageSummaryHtml(lead, summary, images) : '',
      ...pages.map(p => flowPageHtml(p.sectionLabel, p.html, images))
    ].join('\n');

    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>The Integrated Life Report</title><style>${css}</style></head><body>${bodyHtml}</body></html>`;
    return { html: fullHtml, pageCount: fixedPageCount + pages.length, sectionPageIndex };
  } finally {
    await measurePage.close();
  }
}

async function renderReportPdfBuffer(args) {
  const { html } = await buildReportHtml(args);
  const browser = await getBrowser();
  const printPage = await browser.newPage();
  try {
    await printPage.setContent(html, { waitUntil: 'networkidle0' });
    await printPage.evaluate(() => document.fonts.ready);
    const rendered = await printPage.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
    });

    // Puppeteer 23+ returns a Uint8Array here, not a Buffer. Express's
    // res.send() treats a non-Buffer object as JSON, so the download became
    // {"0":37,"1":80,"2":68,"3":70,...} - the PDF's own bytes, spelled out as
    // JSON. It still arrived named .pdf, still had a PDF content type, and no
    // reader on earth could open it. It also made a 3MB report a 41MB file.
    //
    // Buffer.from copies nothing meaningful here (it wraps the same memory for
    // a Uint8Array view) and makes every caller safe regardless of which
    // renderer or Puppeteer version produced it.
    return Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered);
  } finally {
    await printPage.close();
  }
}

async function closeBrowser() {
  if (!_browserPromise) return;
  const browser = await _browserPromise.catch(() => null);
  _browserPromise = null;
  if (browser) await browser.close();
}

module.exports = { buildReportHtml, renderReportPdfBuffer, closeBrowser };
