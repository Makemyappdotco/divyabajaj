const express = require('express');
const db = require('./database');
const { renderReportHtml } = require('./services/reportHtmlRenderer');
const { htmlToPdf } = require('./services/chromiumPdf');
const { issueReportAccess, verifyReportAccess } = require('./services/reportAccess');

const router = express.Router();

function safeFileName(value) {
  return String(value || 'Divya-Bajaj').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Divya-Bajaj';
}

function parseJson(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string' && value.trim()) {
    try { return JSON.parse(value); } catch (error) { return null; }
  }
  return null;
}

async function loadReport(reportId, leadId) {
  const reports = await db.getReports({ lead_id: leadId });
  const report = reports.find(item => item.id === reportId) || null;
  if (!report) return null;
  const lead = await db.getLead(leadId);
  if (!lead) return null;
  const reportJson = parseJson(report.report_json);
  if (!reportJson) throw new Error('This report does not contain structured report data');
  return {
    report,
    reportJson,
    lead: { ...lead, ...(report.input_data || {}), id: lead.id }
  };
}

async function paymentAllowed(bundle) {
  if (process.env.REPORT_ACCESS_REQUIRE_CAPTURED_PAYMENT !== 'true') return true;
  const payments = await db.getPayments({ lead_id: bundle.lead.id, status: 'captured' });
  return payments.some(payment => !payment.report_id || payment.report_id === bundle.report.id);
}

function accessParams(req) {
  return {
    reportId: String(req.params.reportId || req.body?.report_id || '').trim(),
    leadId: String(req.query.lead || req.body?.lead_id || '').trim(),
    token: String(req.query.token || req.body?.token || '').trim()
  };
}

router.post('/report-access', async (req, res) => {
  try {
    const { reportId, leadId } = accessParams(req);
    if (!reportId || !leadId) return res.status(400).json({ success: false, error: 'Report and lead IDs are required' });
    const bundle = await loadReport(reportId, leadId);
    if (!bundle) return res.status(404).json({ success: false, error: 'Report not found' });
    if (!(await paymentAllowed(bundle))) return res.status(403).json({ success: false, error: 'Payment verification is required before this report can be opened' });

    const token = issueReportAccess(reportId, leadId);
    const query = `lead=${encodeURIComponent(leadId)}&token=${encodeURIComponent(token)}`;
    return res.json({
      success: true,
      report_id: reportId,
      view_url: `/report/${encodeURIComponent(reportId)}?${query}`,
      pdf_url: `/report/${encodeURIComponent(reportId)}/pdf?${query}`
    });
  } catch (error) {
    console.error('[Report access link error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not prepare report access' });
  }
});

router.get('/report/:reportId', async (req, res) => {
  try {
    const { reportId, leadId, token } = accessParams(req);
    if (!reportId || !leadId || !verifyReportAccess(token, reportId, leadId)) return res.status(403).send('This private report link is invalid or has expired.');
    const bundle = await loadReport(reportId, leadId);
    if (!bundle) return res.status(404).send('Report not found.');
    if (!(await paymentAllowed(bundle))) return res.status(403).send('Payment verification is required before this report can be opened.');

    const pdfUrl = `/report/${encodeURIComponent(reportId)}/pdf?lead=${encodeURIComponent(leadId)}&token=${encodeURIComponent(token)}`;
    const html = renderReportHtml({ lead: bundle.lead, reportJson: bundle.reportJson, access: { pdfUrl }, printMode: false });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return res.send(html);
  } catch (error) {
    console.error('[HTML report view error]', error);
    return res.status(500).send('Could not render this report.');
  }
});

router.get('/report/:reportId/pdf', async (req, res) => {
  try {
    const { reportId, leadId, token } = accessParams(req);
    if (!reportId || !leadId || !verifyReportAccess(token, reportId, leadId)) return res.status(403).json({ success: false, error: 'Invalid or expired private report link' });
    const bundle = await loadReport(reportId, leadId);
    if (!bundle) return res.status(404).json({ success: false, error: 'Report not found' });
    if (!(await paymentAllowed(bundle))) return res.status(403).json({ success: false, error: 'Payment verification is required before this report can be downloaded' });

    const html = renderReportHtml({ lead: bundle.lead, reportJson: bundle.reportJson, access: {}, printMode: true });
    const pdf = await htmlToPdf(html);
    const filename = `${safeFileName(bundle.lead.name)}-Integrated-Life-Report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Divya-PDF-Renderer', 'html-chromium-v1');
    return res.end(pdf);
  } catch (error) {
    console.error('[HTML Chromium PDF error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not generate the report PDF' });
  }
});

module.exports = router;
