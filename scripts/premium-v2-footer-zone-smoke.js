const { buildSmokeFixture } = require('./premium-v2-render-smoke');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { geometryQa } = require('../src/premiumV2/renderPipeline');

async function runFooterZoneSmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const geometry = geometryQa(svgPages);
  const blocking = geometry.issues.filter(issue => issue.type === 'footer_collision_risk');
  if (blocking.length) {
    throw new Error(`Premium v2 footer-zone smoke failed: ${blocking.map(issue => `p${issue.page_number}:${issue.element}`).join(', ')}`);
  }
  return { pages: svgPages.length, footer_zone_passed: true };
}

module.exports = { runFooterZoneSmoke };
