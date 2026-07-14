const modules = [
  '../src/premiumV2/spec',
  '../src/premiumV2/factLedger',
  '../src/premiumV2/contentEngine',
  '../src/premiumV2/validator',
  '../src/premiumV2/layoutPlanner',
  '../src/premiumV2/svgRenderer',
  '../src/premiumV2/renderPipeline',
  '../src/premiumV2/pdfComposer',
  '../src/premiumV2/correctionLoop',
  '../src/premiumV2/orchestrator',
  '../src/premiumV2/store',
  '../src/premiumV2/worker',
  '../src/premiumV2/routes',
  '../src/server'
];

async function main() {
  for (const modulePath of modules) {
    require(modulePath);
    console.log(`[build-check] loaded ${modulePath}`);
  }

  console.log('[build-check] premium v2 module graph loaded successfully');

  const { runStructureSmoke } = require('./premium-v2-structure-smoke');
  const structure = await runStructureSmoke();
  console.log('[build-check] premium v2 structure smoke passed', structure);

  const { runHardGeometrySmoke } = require('./premium-v2-hard-geometry-smoke');
  const hardGeometry = await runHardGeometrySmoke();
  console.log('[build-check] premium v2 hard geometry smoke passed', hardGeometry);

  const { runFooterZoneSmoke } = require('./premium-v2-footer-zone-smoke');
  const footerZone = await runFooterZoneSmoke();
  console.log('[build-check] premium v2 footer-zone smoke passed', footerZone);

  const { runGeometrySmoke } = require('./premium-v2-geometry-smoke');
  const geometry = await runGeometrySmoke();
  console.log('[build-check] premium v2 full geometry smoke passed', geometry);

  const { runPreviewSmoke } = require('./premium-v2-preview-smoke');
  const previews = await runPreviewSmoke();
  console.log('[build-check] premium v2 PNG preview smoke passed', previews);

  const { runPdfSmoke } = require('./premium-v2-pdf-smoke');
  const pdf = await runPdfSmoke();
  console.log('[build-check] premium v2 final PDF smoke passed', pdf);
}

main().catch(error => {
  console.error('[build-check] failed', error);
  process.exit(1);
});
