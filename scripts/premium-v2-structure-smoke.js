const { buildSmokeFixture } = require('./premium-v2-render-smoke');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');

async function runStructureSmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  if (!Array.isArray(svgPages) || svgPages.length !== 14) {
    throw new Error(`Expected 14 SVG pages, received ${svgPages?.length}`);
  }
  for (const page of svgPages) {
    if (!page.svg || !page.svg.startsWith('<svg') || !page.svg.endsWith('</svg>')) {
      throw new Error(`Invalid SVG output for page ${page.page_number}`);
    }
  }
  return { pages: svgPages.length };
}

module.exports = { runStructureSmoke };
