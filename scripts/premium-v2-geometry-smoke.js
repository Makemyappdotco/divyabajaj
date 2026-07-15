const { buildSmokeFixture } = require('./premium-v2-render-smoke');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { geometryQa } = require('../src/premiumV2/renderPipeline');

async function runGeometrySmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    const summary = geometry.issues.map(issue => `p${issue.page_number || '?'}:${issue.type}:${issue.element || ''}`).join(', ');
    throw new Error(`Premium v2 geometry smoke failed: ${summary}`);
  }
  return { pages: svgPages.length, geometry_passed: true };
}

module.exports = { runGeometrySmoke };
