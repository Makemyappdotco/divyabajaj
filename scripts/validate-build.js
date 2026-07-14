const modules = [
  '../src/premiumV2/spec',
  '../src/premiumV2/factLedger',
  '../src/premiumV2/contentEngine',
  '../src/premiumV2/validator',
  '../src/premiumV2/layoutPlanner',
  '../src/premiumV2/svgRenderer',
  '../src/premiumV2/renderPipeline',
  '../src/premiumV2/correctionLoop',
  '../src/premiumV2/orchestrator',
  '../src/premiumV2/store',
  '../src/premiumV2/worker',
  '../src/premiumV2/routes',
  '../src/server'
];

for (const modulePath of modules) {
  require(modulePath);
  console.log(`[build-check] loaded ${modulePath}`);
}

console.log('[build-check] premium v2 module graph loaded successfully');
