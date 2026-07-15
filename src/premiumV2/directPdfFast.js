const { buildFactLedger } = require('./factLedger');
const { buildDirectPages } = require('./directPdf');
const { validatePremiumContent } = require('./validator');
const { renderAllPages } = require('./svgRenderer');
const { geometryQa } = require('./renderPipeline');
const { composePremiumPdf } = require('./pdfComposer');

function clipWords(value, maxWords) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(value || '').trim();
  return `${words.slice(0, maxWords).join(' ').replace(/[,:;]$/, '')}.`;
}

function fitDirectPages(input) {
  const pages = JSON.parse(JSON.stringify(input || {}));

  if (pages.page_5?.money_system) {
    pages.page_5.money_system = pages.page_5.money_system.map(item => clipWords(item, 6));
  }

  if (pages.page_6) {
    pages.page_6.improvements = (pages.page_6.improvements || []).map(item => clipWords(item, 8));
    pages.page_6.strongest_fit = clipWords(pages.page_6.strongest_fit, 24);
  }

  if (pages.page_7) {
    pages.page_7.decision_filter = clipWords(pages.page_7.decision_filter, 28);
  }

  if (pages.page_8) {
    pages.page_8.rule_72_hour = clipWords(pages.page_8.rule_72_hour, 30);
  }

  if (pages.page_10?.planes) {
    pages.page_10.planes = pages.page_10.planes.map(item => ({ ...item, body: clipWords(item.body, 18) }));
  }

  if (pages.page_11) {
    pages.page_11.cards = (pages.page_11.cards || []).map(item => ({ ...item, body: clipWords(item.body, 36) }));
    pages.page_11.gemstone_note = clipWords(pages.page_11.gemstone_note, 35);
  }

  if (pages.page_12) {
    pages.page_12.closing = clipWords(pages.page_12.closing, 18);
  }

  if (pages.page_13) {
    pages.page_13.questions = (pages.page_13.questions || []).map(item => clipWords(item, 18));
    pages.page_13.closing = clipWords(pages.page_13.closing, 30);
  }

  return pages;
}

async function createDirectPremiumPdf({ lead, reportText }) {
  if (!String(reportText || '').trim()) throw new Error('Generated report text is required');

  const factLedger = buildFactLedger({
    name: lead?.name,
    email: lead?.email,
    phone: lead?.phone,
    dob: lead?.dob,
    tob: lead?.tob,
    pob: lead?.pob,
    question: lead?.question
  });

  const rawPages = buildDirectPages({ lead, reportText, factLedger });
  const pages = fitDirectPages(rawPages);
  const contentQa = validatePremiumContent({ pages, factLedger });

  if (!contentQa.passed) {
    const blocking = contentQa.issues
      .filter(issue => ['critical', 'high'].includes(issue.severity))
      .slice(0, 10)
      .map(issue => `${issue.path || issue.type}: ${issue.message}`)
      .join(' | ');
    throw new Error(`Premium report content could not pass validation: ${blocking}`);
  }

  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    const blocking = geometry.issues
      .slice(0, 10)
      .map(issue => `Page ${issue.page_number || '?'} ${issue.type || ''}: ${issue.message}`)
      .join(' | ');
    throw new Error(`Premium report layout failed geometry QA: ${blocking}`);
  }

  const pdfBuffer = await composePremiumPdf(svgPages);
  return { pdfBuffer, pages, factLedger, contentQa, geometry, model: 'deterministic-direct-v2-fast' };
}

module.exports = { createDirectPremiumPdf, fitDirectPages };
