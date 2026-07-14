const { buildFactLedger } = require('./factLedger');
const { generateStructuredPremiumContent } = require('./contentEngine');
const { validatePremiumContent } = require('./validator');
const { buildLayoutPlan } = require('./layoutPlanner');
const { renderAllPages } = require('./svgRenderer');
const { renderSvgPreview, geometryQa, geometryQaPage, visualQaPage, composeVectorPdf } = require('./renderPipeline');
const { correctPageContent } = require('./correctionLoop');
const store = require('./store');

const MAX_PAGE_RETRIES = 2;

function groupHighContentIssues(issues) {
  const grouped = new Map();
  (issues || []).forEach(issue => {
    if (!['critical', 'high'].includes(issue.severity)) return;
    const match = String(issue.path || '').match(/page_(\d+)/);
    if (!match) return;
    const pageNumber = Number(match[1]);
    if (!grouped.has(pageNumber)) grouped.set(pageNumber, []);
    grouped.get(pageNumber).push(issue);
  });
  return grouped;
}

async function correctHighContentIssues({ pages, contentQa, factLedger, masterInterpretation }) {
  const grouped = groupHighContentIssues(contentQa.issues);
  const next = { ...pages };
  for (const [pageNumber, issues] of grouped.entries()) {
    const key = `page_${pageNumber}`;
    next[key] = await correctPageContent({
      pageNumber,
      currentContent: next[key],
      issues,
      factLedger,
      masterInterpretation
    });
  }
  return next;
}

function correctableVisualIssues(qa) {
  return (qa?.issues || []).filter(issue =>
    ['shorten_text', 'switch_variant', 'adjust_spacing'].includes(issue.recommended_action)
  );
}

async function failRun(run, error, extra = {}) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown premium report error');
  return store.updateRun(run.id, {
    status: 'failed',
    stage: 'failed',
    error_message: message,
    ...extra
  });
}

async function processFacts(run) {
  const factLedger = buildFactLedger(run.input_json || {});
  return store.updateRun(run.id, {
    status: 'processing',
    stage: 'content',
    fact_ledger: factLedger,
    error_message: null
  });
}

async function processContent(run) {
  const generated = await generateStructuredPremiumContent(run.fact_ledger);
  let pages = generated.pages;
  let contentQa = validatePremiumContent({ pages, factLedger: run.fact_ledger });

  if (!contentQa.passed) {
    pages = await correctHighContentIssues({
      pages,
      contentQa,
      factLedger: run.fact_ledger,
      masterInterpretation: generated.master_interpretation
    });
    contentQa = validatePremiumContent({ pages, factLedger: run.fact_ledger });
  }

  if (!contentQa.passed) {
    const error = new Error('Structured report content did not pass the release content gate');
    error.contentQa = contentQa;
    throw error;
  }

  const layoutPlan = buildLayoutPlan(pages);
  return store.updateRun(run.id, {
    status: 'processing',
    stage: 'render',
    master_interpretation: generated.master_interpretation,
    page_content: pages,
    layout_plan: layoutPlan,
    content_qa: contentQa,
    error_message: null
  });
}

async function processRender(run) {
  const svgPages = renderAllPages({
    pages: run.page_content,
    factLedger: run.fact_ledger,
    layoutPlan: run.layout_plan
  });
  const geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    const error = new Error('Locked 14-page renderer failed geometry QA');
    error.geometry = geometry;
    throw error;
  }

  for (const page of svgPages) {
    const key = `page_${page.page_number}`;
    const pageGeometry = geometry.pages.find(item => item.page_number === page.page_number);
    await store.upsertPage(run.id, page.page_number, {
      status: 'rendered',
      retry_count: 0,
      content_json: run.page_content[key],
      layout_json: run.layout_plan[key],
      svg_text: page.svg,
      geometry_qa: pageGeometry,
      visual_qa: null,
      preview_path: null
    });
  }

  return store.updateRun(run.id, {
    status: 'processing',
    stage: 'visual_qa',
    current_page: 1,
    retry_count: 0,
    geometry_qa: geometry,
    visual_qa_summary: {
      passed_pages: 0,
      failed_pages: 0,
      total_pages: 14
    }
  });
}

async function processVisualQa(run) {
  const pageNumber = Number(run.current_page || 1);
  if (pageNumber > 14) {
    return store.updateRun(run.id, { stage: 'finalise', current_page: 14 });
  }

  const pageRow = await store.getPage(run.id, pageNumber);
  if (!pageRow || !pageRow.svg_text) throw new Error(`Rendered page ${pageNumber} is missing`);

  const preview = await renderSvgPreview(pageRow.svg_text);
  const previewPath = await store.uploadPreview(run.id, pageNumber, preview);
  const qa = await visualQaPage({ pageNumber, pngBuffer: preview });

  if (qa.status === 'pass' && qa.layout_score >= 8.5 && qa.readability_score >= 8.5 && qa.alignment_score >= 8.5 && qa.style_score >= 8.2) {
    await store.upsertPage(run.id, pageNumber, {
      status: 'qa_passed',
      retry_count: pageRow.retry_count || 0,
      content_json: pageRow.content_json,
      layout_json: pageRow.layout_json,
      svg_text: pageRow.svg_text,
      geometry_qa: pageRow.geometry_qa,
      visual_qa: qa,
      preview_path: previewPath
    });

    const summary = run.visual_qa_summary || { passed_pages: 0, failed_pages: 0, total_pages: 14 };
    const nextPage = pageNumber + 1;
    return store.updateRun(run.id, {
      stage: nextPage > 14 ? 'finalise' : 'visual_qa',
      current_page: Math.min(nextPage, 14),
      visual_qa_summary: {
        ...summary,
        passed_pages: Number(summary.passed_pages || 0) + 1
      }
    });
  }

  const issues = correctableVisualIssues(qa);
  const retryCount = Number(pageRow.retry_count || 0);
  if (!issues.length || retryCount >= MAX_PAGE_RETRIES) {
    await store.upsertPage(run.id, pageNumber, {
      status: 'qa_failed',
      retry_count: retryCount,
      content_json: pageRow.content_json,
      layout_json: pageRow.layout_json,
      svg_text: pageRow.svg_text,
      geometry_qa: pageRow.geometry_qa,
      visual_qa: qa,
      preview_path: previewPath
    });
    throw new Error(`Page ${pageNumber} failed visual QA after ${retryCount} correction attempt(s)`);
  }

  const key = `page_${pageNumber}`;
  const correctedContent = await correctPageContent({
    pageNumber,
    currentContent: run.page_content[key],
    issues,
    factLedger: run.fact_ledger,
    masterInterpretation: run.master_interpretation
  });

  const nextPageContent = { ...run.page_content, [key]: correctedContent };
  const nextLayoutPlan = buildLayoutPlan(nextPageContent);
  const rerendered = renderAllPages({
    pages: nextPageContent,
    factLedger: run.fact_ledger,
    layoutPlan: nextLayoutPlan
  }).find(item => item.page_number === pageNumber);

  const pageGeometry = geometryQaPage(rerendered);
  if (!pageGeometry.passed) throw new Error(`Page ${pageNumber} correction caused geometry QA failure`);

  await store.upsertPage(run.id, pageNumber, {
    status: 'corrected_pending_qa',
    retry_count: retryCount + 1,
    content_json: correctedContent,
    layout_json: nextLayoutPlan[key],
    svg_text: rerendered.svg,
    geometry_qa: pageGeometry,
    visual_qa: qa,
    preview_path: previewPath
  });

  return store.updateRun(run.id, {
    page_content: nextPageContent,
    layout_plan: nextLayoutPlan,
    stage: 'visual_qa',
    current_page: pageNumber,
    retry_count: Number(run.retry_count || 0) + 1
  });
}

async function processFinalise(run) {
  const pages = await store.getPages(run.id);
  if (pages.length !== 14 || pages.some(page => page.status !== 'qa_passed')) {
    throw new Error('Cannot finalise report until all 14 pages pass visual QA');
  }

  const svgPages = pages.map(page => ({
    page_number: page.page_number,
    svg: page.svg_text
  }));
  const pdfBuffer = await composeVectorPdf(svgPages);
  const finalPath = await store.uploadFinalPdf(run, pdfBuffer);

  return store.updateRun(run.id, {
    status: 'ready',
    stage: 'ready',
    current_page: 14,
    final_pdf_path: finalPath,
    completed_at: new Date().toISOString(),
    error_message: null
  });
}

async function runWorkerStage(runId) {
  let run = await store.getRun(runId);
  if (!run) throw new Error('Premium report run not found');
  if (['ready', 'failed', 'cancelled'].includes(run.status)) return run;

  try {
    if (run.stage === 'facts') return await processFacts(run);
    if (run.stage === 'content') return await processContent(run);
    if (run.stage === 'render') return await processRender(run);
    if (run.stage === 'visual_qa') return await processVisualQa(run);
    if (run.stage === 'finalise') return await processFinalise(run);
    throw new Error(`Unknown premium report stage: ${run.stage}`);
  } catch (error) {
    console.error(`[Premium v2 worker ${run.id} at ${run.stage}]`, error);
    const extra = {};
    if (error.contentQa) extra.content_qa = error.contentQa;
    if (error.geometry) extra.geometry_qa = error.geometry;
    await failRun(run, error, extra);
    throw error;
  }
}

module.exports = { runWorkerStage };
