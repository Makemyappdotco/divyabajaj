const express = require('express');
const db = require('./database');
const numerology = require('./services/numerology');
const { generateReportPdf } = require('./services/pdf');

const router = express.Router();

function requiredFields(body) {
  return ['name', 'phone', 'dob', 'email'].filter(field => !String(body[field] || '').trim());
}

router.post('/leads', async (req, res) => {
  try {
    const { name, phone, dob, email, question, source, utm_source, utm_medium, utm_campaign } = req.body;
    const missing = requiredFields(req.body);
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });

    const existing = await db.getLeads({ search: phone });
    if (existing.length) return res.json({ success: true, lead: existing[0], existing: true });

    const lead = await db.createLead({ name, phone, dob, email, question, source, utm_source, utm_medium, utm_campaign });
    return res.status(201).json({ success: true, lead, existing: false });
  } catch (error) {
    console.error('[Create lead error]', error);
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

    const existing = await db.getLeads({ search: phone });
    const leadData = { name, phone, dob, email, question, source: source || 'free_numerology_report_form' };
    const lead = existing.length
      ? await db.updateLead(existing[0].id, leadData)
      : await db.createLead(leadData);

    const report = await db.createReport({
      lead_id: lead.id,
      type: 'free_numerology_awareness',
      status: 'generating',
      input_data: { name, phone, dob, email, question }
    });

    const userFocus = question || `Free numerology awareness report for ${name}, born on ${dob}.`;
    const result = await numerology.generateReport('free_numerology_awareness', name, dob, userFocus, null);

    const updatedReport = await db.updateReport(report.id, {
      status: 'completed',
      horosoft_data: result.numbers,
      astrology_data: null,
      ai_report: result.report_text,
      ai_insights: result.insights,
      generated_by: result.generated ? 'openai' : 'fallback',
      pdf_url: `/api/reports/${report.id}/pdf`
    });

    await db.updateLead(lead.id, { status: 'free_report_generated' });

    return res.json({
      success: true,
      lead_id: lead.id,
      report_id: report.id,
      generated_by: result.generated ? 'openai' : 'fallback',
      storage: db.usingSupabase() ? 'supabase' : 'local_fallback',
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
    const reports = await db.getReports({});
    const report = reports.find(item => item.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const lead = await db.getLead(report.lead_id) || {};
    const pdfBuffer = await generateReportPdf({
      lead,
      report,
      numbers: report.horosoft_data || {},
      astrologyData: null,
      reportText: report.ai_report || 'Report content is not available.'
    });

    const safeName = String(lead.name || 'Divya-Bajaj-Report').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-numerology-report.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF error]', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/leads', async (req, res) => {
  try {
    const leads = await db.getLeads(req.query);
    return res.json({ success: true, leads, total: leads.length, storage: db.usingSupabase() ? 'supabase' : 'local_fallback' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const reports = await db.getReports(req.query);
    return res.json({ success: true, reports, storage: db.usingSupabase() ? 'supabase' : 'local_fallback' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reports/:id', async (req, res) => {
  try {
    const reports = await db.getReports({});
    const report = reports.find(item => item.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    return res.json({ success: true, report });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    return res.json({ success: true, stats, storage: db.usingSupabase() ? 'supabase' : 'local_fallback' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/events', async (req, res) => {
  try {
    const events = await db.getEvents(Number(req.query.limit) || 100);
    return res.json({ success: true, events });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/export/leads', async (req, res) => {
  try {
    const leads = await db.getLeads();
    return res.json({ success: true, leads });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
