const { buildSmokeFixture } = require('./premium-v2-render-smoke');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { composePremiumPdf } = require('../src/premiumV2/pdfComposer');

async function runPdfSmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const pdf = await composePremiumPdf(svgPages);
  if (!Buffer.isBuffer(pdf)) throw new Error('Premium v2 PDF smoke returned a non-buffer result');
  if (pdf.length < 100000) throw new Error(`Premium v2 PDF smoke returned an unexpectedly small PDF: ${pdf.length} bytes`);
  if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('Premium v2 PDF smoke did not produce a valid PDF header');
  return { pages: svgPages.length, pdf_bytes: pdf.length, composer: 'high_resolution_qa_approved_pages' };
}

module.exports = { runPdfSmoke };
