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
 *   The paidReportV2 prompt does not generate this yet, so callers only pass
 *   it once that gap is closed; until then the page is skipped entirely
 *   rather than inventing content for it.
 */
async function buildReportHtml({ lead, report, onePage }) {
  const hasOnePage = !!(onePage && (onePage.strongest_signal || (onePage.pulse || []).length));
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
      hasOnePage ? onePageSummaryHtml(lead, onePage, images) : '',
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
    const buffer = await printPage.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
    });
    return buffer;
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
