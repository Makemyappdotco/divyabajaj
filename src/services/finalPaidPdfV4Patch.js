const publicPaidRoutes = require('../publicPaidRoutes');
const { generateFinalPaidPdfV4, safeFileName } = require('./pdfFinalV4');

let applied = false;

function parseReportJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string' && value.trim()) {
    try { return JSON.parse(value); } catch (error) { return null; }
  }
  return null;
}

module.exports = function applyFinalPaidPdfV4Patch() {
  if (applied) return;

  const layer = (publicPaidRoutes.stack || []).find(item =>
    item.route && item.route.path === '/reports/pdf-direct' && item.route.methods && item.route.methods.post
  );

  if (!layer || !layer.route || !Array.isArray(layer.route.stack) || !layer.route.stack[0]) {
    throw new Error('Could not locate the paid PDF download route for Final V4 patching');
  }

  const originalHandler = layer.route.stack[0].handle;

  layer.route.stack[0].handle = async function finalPaidPdfV4Handler(req, res, next) {
    const reportJson = parseReportJson(req.body && req.body.report_json);
    if (!reportJson) return originalHandler(req, res, next);

    try {
      const lead = (req.body && req.body.lead) || {};
      if (!String(lead.name || '').trim()) {
        return res.status(400).json({ success: false, error: 'Client name is required for PDF generation' });
      }

      const pdfBuffer = await generateFinalPaidPdfV4({ lead, reportJson });
      const filename = `${safeFileName(lead.name)}-Integrated-Life-Report.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Divya-PDF-Template', 'approved-v4-hq');
      return res.end(pdfBuffer);
    } catch (error) {
      console.error('[Final V4 paid PDF error]', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Could not generate the approved paid report PDF'
      });
    }
  };

  applied = true;
};
