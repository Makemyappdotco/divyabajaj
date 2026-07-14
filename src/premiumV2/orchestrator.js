const { buildFactLedger } = require('./factLedger');
const { generateStructuredPremiumContent } = require('./contentEngine');
const { validatePremiumContent } = require('./validator');
const { buildLayoutPlan } = require('./layoutPlanner');
const { renderAllPages } = require('./svgRenderer');
const { renderAllPreviews, composeVectorPdf, geometryQa, visualQa } = require('./renderPipeline');
const { correctPageContent } = require('./correctionLoop');

function pageNumberFromPath(path) {
  const match = String(path || '').match(/page_(\d+)/);
  return match ? Number(match[1]) : null;
}

function groupContentIssuesByPage(issues) {
  const grouped = new Map();
  issues.forEach(issue => {
    const pageNumber = pageNumberFromPath(issue.path);
    if (!pageNumber) return;
    if (!grouped.has(pageNumber)) grouped.set(pageNumber, []);
    grouped.get(pageNumber).push(issue);
  });
  return grouped;
}

function visualIssuesByPage(visualResult) {
  const grouped = new Map();
  (visualResult.pages || []).forEach(page => {
    if (page.status !== 'fail') return;
    const correctable = (page.issues || []).filter(issue => ['shorten_text', 'switch_variant', 'adjust_spacing'].includes(issue.recommended_action));
    if (correctable.length) grouped.set(page.page_number, correctable);
  });
  return grouped;
}

async function applyCorrections({ pages, groupedIssues, factLedger, masterInterpretation }) {
  const correctedPages = { ...pages };
  for (const [pageNumber, issues] of groupedIssues.entries()) {
    const key = `page_${pageNumber}`;
    correctedPages[key] = await correctPageContent({
      pageNumber,
      currentContent: correctedPages[key],
      issues,
      factLedger,
      masterInterpretation
    });
  }
  return correctedPages;
}

function summarizeQa({ contentQa, geometry, visual }) {
  const visualPages = visual?.pages || [];
  const visualScores = visualPages.filter(page => typeof page.layout_score === 'number');
  const average = key => visualScores.length
    ? Number((visualScores.reduce((sum, page) => sum + Number(page[key] || 0), 0) / visualScores.length).toFixed(2))
    : null;

  return {
    content_passed: contentQa.passed,
    geometry_passed: geometry.passed,
    visual_passed: visual.passed,
    layout_score: average('layout_score'),
    readability_score: average('readability_score'),
    alignment_score: average('alignment_score'),
    style_score: average('style_score'),
    overall_passed: contentQa.passed && geometry.passed && visual.passed
  };
}

async function generatePremiumV2Report(input, options = {}) {
  const startedAt = Date.now();
  const maxCorrectionCycles = Number.isInteger(options.maxCorrectionCycles) ? options.maxCorrectionCycles : 2;
  const visionQaEnabled = options.visionQaEnabled !== false;

  const factLedger = buildFactLedger(input);
  const structured = await generateStructuredPremiumContent(factLedger);
  let pages = structured.pages;
  const history = [];

  let contentQa = validatePremiumContent({ pages, factLedger });
  if (!contentQa.passed) {
    const grouped = groupContentIssuesByPage(contentQa.issues.filter(issue => ['critical', 'high'].includes(issue.severity)));
    if (grouped.size) {
      pages = await applyCorrections({ pages, groupedIssues: grouped, factLedger, masterInterpretation: structured.master_interpretation });
      contentQa = validatePremiumContent({ pages, factLedger });
    }
  }

  let layoutPlan = buildLayoutPlan(pages);
  let svgPages = renderAllPages({ pages, factLedger, layoutPlan });
  let geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    const error = new Error('Premium v2 geometry QA failed before visual QA');
    error.qa = { contentQa, geometry };
    throw error;
  }

  let previews = await renderAllPreviews(svgPages);
  let visual = await visualQa(previews, { enabled: visionQaEnabled });
  history.push({ cycle: 0, contentQa, geometry, visual, layoutPlan });

  for (let cycle = 1; cycle <= maxCorrectionCycles && !visual.passed; cycle += 1) {
    const grouped = visualIssuesByPage(visual);
    if (!grouped.size) break;

    pages = await applyCorrections({
      pages,
      groupedIssues: grouped,
      factLedger,
      masterInterpretation: structured.master_interpretation
    });

    contentQa = validatePremiumContent({ pages, factLedger });
    layoutPlan = buildLayoutPlan(pages);
    svgPages = renderAllPages({ pages, factLedger, layoutPlan });
    geometry = geometryQa(svgPages);
    if (!geometry.passed) break;

    const failedPageNumbers = new Set(Array.from(grouped.keys()));
    const nextPreviews = [];
    for (const page of svgPages) {
      const previous = previews.find(item => item.page_number === page.page_number);
      if (!failedPageNumbers.has(page.page_number) && previous) nextPreviews.push(previous);
      else nextPreviews.push({ page_number: page.page_number, png: await require('./renderPipeline').renderSvgPreview(page.svg) });
    }
    previews = nextPreviews;
    visual = await visualQa(previews, { enabled: visionQaEnabled });
    history.push({ cycle, contentQa, geometry, visual, layoutPlan });
  }

  const qaSummary = summarizeQa({ contentQa, geometry, visual });
  if (!qaSummary.overall_passed) {
    const error = new Error('Premium v2 report did not pass the automated release gate');
    error.qa = { summary: qaSummary, contentQa, geometry, visual, history };
    throw error;
  }

  const pdfBuffer = await composeVectorPdf(svgPages);

  return {
    version: 'premium-report-v2',
    model: structured.model,
    generation_ms: Date.now() - startedAt,
    fact_ledger: factLedger,
    master_interpretation: structured.master_interpretation,
    pages,
    layout_plan: layoutPlan,
    qa: {
      summary: qaSummary,
      content: contentQa,
      geometry,
      visual,
      correction_cycles: history.length - 1
    },
    previews,
    svg_pages: svgPages,
    pdf_buffer: pdfBuffer
  };
}

module.exports = { generatePremiumV2Report };
