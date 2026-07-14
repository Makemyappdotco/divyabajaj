const { buildFactLedger } = require('./factLedger');
const { validatePremiumContent } = require('./validator');
const { renderAllPages } = require('./svgRenderer');
const { geometryQa } = require('./renderPipeline');
const { composePremiumPdf } = require('./pdfComposer');
const { normalizePremiumLayout } = require('./layoutNormalization');
const { buildDirectPages } = require('./directPdf');

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

  const pages = buildDirectPages({ lead, reportText, factLedger });
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
      .map(issue => `Page ${issue.page_number || '?'}: ${issue.message}`)
      .join(' | ');
    throw new Error(`Premium report layout validation failed: ${message}`);
  }

  const pdfBuffer = await composePremiumPdf(svgPages);
  return { pdfBuffer, pages, factLedger, contentQa, geometry };
}

module.exports = { buildPremiumDownload };
