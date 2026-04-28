const express = require('express');
const db = require('./database');
const numerology = require('./services/numerology');

const router = express.Router();

router.post('/leads', (req, res) => {
  try {
    const { name, phone, dob, tob, pob, email, question, source, utm_source, utm_medium, utm_campaign } = req.body;

    if (!name || !phone || !dob) {
      return res.status(400).json({ error: 'Name, phone, and date of birth are required' });
    }

    const existing = db.getLeads({ search: phone });
    if (existing.length > 0) {
      return res.json({ success: true, lead: existing[0], existing: true });
    }

    const lead = db.createLead({
      name,
      phone,
      dob,
      tob,
      pob,
      email,
      question,
      source,
      utm_source,
      utm_medium,
      utm_campaign
    });

    res.status(201).json({ success: true, lead, existing: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/calculate', (req, res) => {
  try {
    const { name, dob } = req.body;
    if (!name || !dob) {
      return res.status(400).json({ error: 'Name and DOB are required' });
    }

    const numbers = numerology.calcAllNumbers(name, dob);
    res.json({ success: true, numbers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reports/free', async (req, res) => {
  try {
    const { name, phone, dob, tob, pob, email, question, source } = req.body;

    if (!name || !phone || !dob) {
      return res.status(400).json({ error: 'Name, phone, and DOB are required' });
    }

    let lead;
    const existing = db.getLeads({ search: phone });

    if (existing.length > 0) {
      lead = existing[0];
    } else {
      lead = db.createLead({
        name,
        phone,
        dob,
        tob,
        pob,
        email,
        question,
        source: source || 'free_report_demo'
      });
    }

    const report = db.createReport({
      lead_id: lead.id,
      type: 'free_awareness',
      status: 'generating',
      input_data: { name, phone, dob, tob, pob, email, question }
    });

    const result = await numerology.generateReport('free_awareness', name, dob, question || 'General life clarity');

    const updatedReport = db.updateReport(report.id, {
      status: 'completed',
      horosoft_data: result.numbers,
      ai_report: result.report_text,
      ai_insights: result.insights,
      generated_by: result.generated ? 'openai' : 'fallback'
    });

    db.updateLead(lead.id, { status: 'free_report_generated' });

    res.json({
      success: true,
      lead_id: lead.id,
      report_id: report.id,
      generated_by: result.generated ? 'openai' : 'fallback',
      numbers: result.numbers,
      report_text: result.report_text,
      report: updatedReport
    });
  } catch (error) {
    console.error('[Free report error]', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/leads', (req, res) => {
  const { status, tier, from, to, search, page = 1, limit = 50 } = req.query;
  let leads = db.getLeads({ status, tier, from, to, search });
  const total = leads.length;
  const offset = (Number(page) - 1) * Number(limit);
  leads = leads.slice(offset, offset + Number(limit));

  res.json({
    success: true,
    leads,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit))
  });
});

router.get('/leads/:id', (req, res) => {
  const lead = db.getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const reports = db.getReports({ lead_id: lead.id });
  res.json({ success: true, lead, reports });
});

router.get('/reports', (req, res) => {
  const { lead_id, type, status } = req.query;
  res.json({ success: true, reports: db.getReports({ lead_id, type, status }) });
});

router.get('/reports/:id', (req, res) => {
  const report = db.getReports({}).find(item => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ success: true, report });
});

router.get('/stats', (req, res) => {
  res.json({ success: true, stats: db.getStats() });
});

router.get('/events', (req, res) => {
  res.json({ success: true, events: db.getEvents(Number(req.query.limit) || 100) });
});

router.get('/export/leads', (req, res) => {
  const leads = db.getLeads();
  if (!leads.length) return res.send('');

  const headers = Object.keys(leads[0]);
  const csv = [
    headers.join(','),
    ...leads.map(row => headers.map(header => {
      let value = row[header];
      if (typeof value === 'object') value = JSON.stringify(value);
      value = String(value || '');
      if (value.includes(',')) value = `"${value.replace(/"/g, '""')}"`;
      return value;
    }).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send(csv);
});

module.exports = router;
