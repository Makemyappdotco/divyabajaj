const { buildSmokeFixture } = require('./premium-v2-render-smoke');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { geometryQa } = require('../src/premiumV2/renderPipeline');

async function runHardGeometrySmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const geometry = geometryQa(svgPages);
  const hardTypes = new Set(['out_of_bounds', 'text_out_of_bounds', 'page_size', 'page_count', 'footer']);
  const blocking = geometry.issues.filter(issue => hardTypes.has(issue.type));
  if (blocking.length) {
    throw new Error(`Premium v2 hard geometry failed: ${blocking.map(issue => `p${issue.page_number || '?'}:${issue.type}:${issue.element || ''}`).join(', ')}`);
  }
  return { pages: svgPages.length, hard_geometry_passed: true };
}

module.exports = { runHardGeometrySmoke };
