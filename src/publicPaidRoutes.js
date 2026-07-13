const express = require('express');
const db = require('./database');
const numerology = require('./services/numerology');

const router = express.Router();

function missingPaidFields(body) {
  return ['name', 'phone', 'dob', 'email', 'tob', 'pob'].filter(field => !String(body[field] || '').trim());
}

async function findOrCreateLead({ name, phone, dob, email, tob, pob, question, source }) {
  const existing = await db.getLeads({ search: phone });
  const leadData = { name, phone, dob, email, tob, pob, question, source };
  return existing.length ? await db.updateLead(existing[0].id, leadData) : await db.createLead(leadData);
}

router.post('/reports/paid-test', async (req, res) => {
  try {
    const { name, phone, dob, email, tob, pob, question, source } = req.body;
    const missing = missingPaidFields(req.body);
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });

    const lead = await findOrCreateLead({
      name,
      phone,
      dob,
      email,
      tob,
      pob,
      question,
      source: source || 'paid_blueprint_public_test_form'
    });

    await db.updateLead(lead.id, { status: 'paid_test_report_requested', tier: 'paid_blueprint_test' });

    const report = await db.createReport({
      lead_id: lead.id,
      type: 'paid_blueprint_test',
      status: 'generating',
      input_data: {
        name,
        phone,
        dob,
        email,
        tob,
        pob,
        question,
        payment_status: 'testing_without_payment_gateway'
      }
    });

    const focus = question || `Paid Full Blueprint report for ${name}, born on ${dob}, ${tob}, ${pob}.`;
    const result = await numerology.generateReport('paid_blueprint_test', name, dob, focus, { tob, pob, email, phone });

    const updatedReport = await db.updateReport(report.id, {
      status: 'completed',
      horosoft_data: result.numbers,
      astrology_data: result.astrology_data || null,
      ai_report: result.report_text,
      ai_insights: { ...(result.insights || {}), delivery_ready: { email, whatsapp: phone } },
      generated_by: result.model || 'gpt-5.5',
      pdf_url: `/api/reports/${report.id}/pdf`
    });

    await db.updateLead(lead.id, { status: 'paid_test_report_generated', tier: 'paid_blueprint_test' });

    return res.json({
      success: true,
      test_mode: true,
      payment_required: false,
      lead_id: lead.id,
      report_id: report.id,
      generated_by: result.model || 'gpt-5.5',
      storage: db.usingSupabase() ? 'supabase' : 'local_fallback',
      numbers: result.numbers,
      astrology_data: result.astrology_data,
      report_text: result.report_text,
      pdf_url: `/api/reports/${report.id}/pdf`,
      delivery_ready: { email, whatsapp: phone },
      report: updatedReport
    });
  } catch (error) {
    console.error('[Public paid blueprint report error]', error);
    return res.status(500).json({ error: error.message || 'Paid report generation failed' });
  }
});

module.exports = router;
