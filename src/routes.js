const express = require('express');
const db = require('./database');
const numerology = require('./services/numerology');
const { generateReportPdf } = require('./services/pdf');

const router = express.Router();

function requiredFields(body) {
  return ['name', 'phone', 'dob'].filter(field => !String(body[field] || '').trim());
}

router.post('/leads', (req, res) => {
  try {
    const { name, phone, dob, email, question, source, utm_source, utm_medium, utm_campaign } = req.body;
    if (!name || !phone || !dob) return res.status(400).json({ error: 'Name, phone, and date of birth are required' });
    const existing = db.getLeads({ search: phone });
    if (existing.length) return res.json({ success: true, lead: existing[0], existing: true });
    const lead = db.createLead({ name, phone, dob, email, question, source, utm_source, utm_medium, utm_campaign });
    return res.status(201).json({ success: true, lead, existing: false });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/calculate', (req, res) => {
  try {
    const { name, dob } = req.body;
    if (!name || !dob) return res.status(400).json({ error: 'Name and DOB are required' });
    return res.json({ success: true, numbers: numerology.calcAllNumbers(name, dob) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/reports/free', async (req, res) => {
  try {
    const { name, phone, dob, email, question, source } = req.body;
    const missing = requiredFields(req.body);
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });

    const existing = db.getLeads({ search: phone });
    const leadData = { name, phone, dob, email, question, source: source || 'free_numerology_report_form' };
    const lead = existing.length ? db.updateLead(existing[0].id, leadData) : db.createLead(leadData);

    const report = db.createReport({
      lead_id: lead.id,
      type: 'free_numerology_awareness',
      status: 'generating',
      input_data: { name, phone, dob, email, question }
    });

    const userFocus = question || `Free numerology awareness report for ${name}, born on ${dob}.`;
    const result = await numerology.generateReport('free_numerology_awareness', name, dob, userFocus, null);

    const updatedReport = db.updateReport(report.id, {
      status: 'completed',
      horosoft_data: result.numbers,
      astrology_data: null,
      ai_report: result.report_text,
      ai_insights: result.insights,
      generated_by: result.generated ? 'openai' : 'fallback',
      pdf_url: `/api/reports/${report.id}/pdf`
    });

    db.updateLead(lead.id, { status: 'free_report_generated' });

    return res.json({
      success: true,
      lead_id: lead.id,
      report_id: report.id,
      generated_by: result.generated ? 'openai' : 'fallback',
      numbers: result.numbers,
      report_text: result.report_text,
      pdf_url: `/api/reports/${report.id}/pdf`,
      report: updatedReport
    });
  } catch (error) {
    console.error('[Free numerology report error]', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reports/:id/pdf', async (req, res) => {
  try {
    const report = db.getReports({}).find(item => item.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const lead = db.getLead(report.lead_id) || {};
    const pdfBuffer = await generateReportPdf({ lead, report, numbers: report.horosoft_data || {}, astrologyData: null, reportText: report.ai_report || 'Report content is not available.' });
    const safeName = String(lead.name || 'Divya-Bajaj-Report').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-numerology-report.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF error]', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/leads', (req, res) => res.json({ success: true, leads: db.getLeads(req.query), total: db.getLeads(req.query).length }));
router.get('/reports', (req, res) => res.json({ success: true, reports: db.getReports(req.query) }));
router.get('/reports/:id', (req, res) => {
  const report = db.getReports({}).find(item => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  return res.json({ success: true, report });
});
router.get('/stats', (req, res) => res.json({ success: true, stats: db.getStats() }));
router.get('/events', (req, res) => res.json({ success: true, events: db.getEvents(Number(req.query.limit) || 100) }));
router.get('/export/leads', (req, res) => res.json({ success: true, leads: db.getLeads() }));

module.exports = router;
