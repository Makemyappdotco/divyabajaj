const { buildSmokeFixture } = require('./premium-v2-render-smoke');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { renderSvgPreview } = require('../src/premiumV2/renderPipeline');

async function runPreviewSmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const checked = [];
  for (const pageNumber of [1, 2, 7, 10, 14]) {
    const page = svgPages.find(item => item.page_number === pageNumber);
    if (!page) throw new Error(`Missing smoke page ${pageNumber}`);
    const png = await renderSvgPreview(page.svg);
    if (!Buffer.isBuffer(png) || png.length < 1000) {
      throw new Error(`PNG preview smoke failed for page ${pageNumber}`);
    }
    checked.push({ page_number: pageNumber, bytes: png.length });
  }
  return { preview_pages: checked };
}

module.exports = { runPreviewSmoke };
