// Chooses which renderer produces a customer's PDF.
//
// Two renderers exist. The legacy PDFKit one (./pdf) draws every report type
// and is what the free numerology report uses. The HTML one
// (./htmlReport/render) prints the approved Integrated Life Report design, and
// needs the structured report_json that paidReportV2 produces - it cannot work
// from the flattened report_text.
//
// So the choice is made on the data, not on the caller: a report is rendered
// with the new design only when it actually carries an Integrated Life Report
// payload. That keeps the free report, and every report generated before this
// existed, on exactly the path they were already on.

const { generateReportPdf } = require('./pdf');
const { renderReportPdfBuffer } = require('./htmlReport/render');

// The free report also stores a report_json, but a different shape
// ({report_type, numbers, report_text, insights}). These three keys are the
// ones the Integrated Life Report template actually reads, so requiring them
// both identifies the right payload and guarantees the template can render it.
function isIntegratedLifeReport(reportJson) {
  return !!(
    reportJson &&
    typeof reportJson === 'object' &&
    !Array.isArray(reportJson) &&
    reportJson.primer &&
    reportJson.glance &&
    reportJson.life_areas
  );
}

/**
 * @returns {Promise<{buffer: Buffer, renderer: 'html'|'legacy'}>}
 */
async function generateDeliverablePdf({
  lead = {},
  report = {},
  reportJson = null,
  numbers = {},
  astrologyData = null,
  reportText = ''
}) {
  // Escape hatch: setting PAID_PDF_RENDERER=legacy puts every report back on
  // the old renderer without a code change, if the new one ever misbehaves.
  const legacyForced = String(process.env.PAID_PDF_RENDERER || '').toLowerCase() === 'legacy';

  if (!legacyForced && isIntegratedLifeReport(reportJson)) {
    try {
      const buffer = await renderReportPdfBuffer({ lead, report: reportJson });
      return { buffer, renderer: 'html' };
    } catch (error) {
      // Chromium is heavy and this runs on serverless, so a cold start can
      // fail or time out. A customer waiting on a download must still get one,
      // so fall through to the renderer that was serving them yesterday rather
      // than surfacing an error.
      console.error('[pdf] Integrated Life Report renderer failed, serving the legacy PDF instead:', error);
    }
  }

  const buffer = await generateReportPdf({ lead, report, numbers, astrologyData, reportText });
  return { buffer, renderer: 'legacy' };
}

module.exports = { generateDeliverablePdf, isIntegratedLifeReport };
