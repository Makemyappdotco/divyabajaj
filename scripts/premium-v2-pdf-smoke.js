const { buildSmokeFixture } = require('./premium-v2-render-smoke');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { composeVectorPdf } = require('../src/premiumV2/renderPipeline');

async function runPdfSmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const pdf = await composeVectorPdf(svgPages);
  if (!Buffer.isBuffer(pdf)) throw new Error('Premium v2 PDF smoke returned a non-buffer result');
  if (pdf.length < 10000) throw new Error(`Premium v2 PDF smoke returned an unexpectedly small PDF: ${pdf.length} bytes`);
  if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('Premium v2 PDF smoke did not produce a valid PDF header');
  return { pages: svgPages.length, pdf_bytes: pdf.length };
}

module.exports = { runPdfSmoke };
