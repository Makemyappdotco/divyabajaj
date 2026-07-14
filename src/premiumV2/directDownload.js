const { buildFactLedger } = require('./factLedger');
const { validatePremiumContent } = require('./validator');
const { renderAllPages } = require('./svgRenderer');
const { geometryQa } = require('./renderPipeline');
const { composePremiumPdf } = require('./pdfComposer');
const { normalizePremiumLayout } = require('./layoutNormalization');
const { buildDirectPages } = require('./directPdf');
const { fitDirectPages } = require('./directPdfFast');
const { normalizeReportForDirectPdf } = require('./reportNormalizer');

async function buildPremiumDownload({ lead, reportText }) {
  const factLedger = buildFactLedger({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    dob: lead.dob,
    tob: lead.tob,
    pob: lead.pob,
    question: lead.question
  });

  // The paid report can contain markdown headings such as "## 11.", "**11.**" or "11)".
  // Normalize those variations into the one numbered format the deterministic page mapper consumes.
  // Missing sections are recovered from the nearest relevant section so a formatting variation can never
  // create empty required fields in the 14-page product.
  const normalizedReportText = normalizeReportForDirectPdf(reportText);
  const rawPages = buildDirectPages({ lead, reportText: normalizedReportText, factLedger });
  const pages = fitDirectPages(rawPages);

  const contentQa = validatePremiumContent({ pages, factLedger });
  if (!contentQa.passed) {
    const message = contentQa.issues
      .filter(issue => issue.severity === 'critical' || issue.severity === 'high')
      .slice(0, 8)
      .map(issue => `${issue.path || issue.type}: ${issue.message}`)
      .join(' | ');
    throw new Error(`Premium report content validation failed: ${message}`);
  }

  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} }).map(page => ({
    ...page,
    svg: normalizePremiumLayout(page.svg)
  }));

  const geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    const message = geometry.issues
      .slice(0, 8)
      .map(issue => `Page ${issue.page_number || '?'} ${issue.type || ''}: ${issue.message}`)
      .join(' | ');
    throw new Error(`Premium report layout validation failed: ${message}`);
  }

  const pdfBuffer = await composePremiumPdf(svgPages);
  return { pdfBuffer, pages, factLedger, contentQa, geometry };
}

module.exports = { buildPremiumDownload };
