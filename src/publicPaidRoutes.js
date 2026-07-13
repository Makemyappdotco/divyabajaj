const express = require('express');
const db = require('./database');
const { generateReportPdf } = require('./services/pdf');
const { startPaidBackground, getPaidBackground } = require('./services/paidBackground');

const router = express.Router();

function missingPaidFields(body) {
  return ['name', 'phone', 'dob', 'email', 'tob', 'pob'].filter(
    field => !String(body[field] || '').trim()
  );
}

function safeFileName(value) {
  return String(value || 'Divya-Bajaj')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'Divya-Bajaj';
}

function errorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || error.code || JSON.stringify(error);
}

async function findOrCreateLead({ name, phone, dob, email, tob, pob, question, source }) {
  const existing = await db.getLeads({ search: phone });
  const leadData = { name, phone, dob, email, tob, pob, question, source };
  return existing.length
    ? await db.updateLead(existing[0].id, leadData)
    : await db.createLead(leadData);
}

router.post('/reports/paid-test', async (req, res) => {
  let report = null;

  try {
    const { name, phone, dob, email, tob, pob, question, source } = req.body;
    const missing = missingPaidFields(req.body);

    if (missing.length) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

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

    await db.updateLead(lead.id, {
      status: 'paid_test_report_requested',
      tier: 'paid_blueprint_test'
    });

    const inputData = {
      name,
      phone,
      dob,
      email,
      tob,
      pob,
      question,
      payment_status: 'testing_without_payment_gateway'
    };

    report = await db.createReport({
      lead_id: lead.id,
      type: 'paid_blueprint_test',
      status: 'starting',
      input_data: inputData
    });

    const background = await startPaidBackground({
      name,
      dob,
      tob,
      pob,
      question
    });

    await db.updateReport(report.id, {
      status: background.status || 'queued',
      generated_by: background.model,
      horosoft_data: background.numbers,
      astrology_data: background.astrologyData,
      input_data: {
        ...inputData,
        openai_response_id: background.responseId
      }
    });

    return res.status(202).json({
      success: true,
      background: true,
      ready: false,
      status: background.status || 'queued',
      job_id: background.responseId,
      report_id: report.id,
      lead_id: lead.id,
      generated_by: background.model,
      storage: db.usingSupabase() ? 'supabase' : 'local_fallback',
      numbers: background.numbers,
      astrology_data: background.astrologyData
    });
  } catch (error) {
    console.error('[Start paid background report error]', error);

    if (report?.id) {
      try {
        await db.updateReport(report.id, {
          status: 'failed',
          ai_insights: { error: error.message }
        });
      } catch (updateError) {
        console.error('[Save paid start error failed]', updateError);
      }
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Could not start paid report generation'
    });
  }
});

router.get('/reports/paid-test/status/:responseId', async (req, res) => {
  try {
    const { responseId } = req.params;
    const reportId = String(req.query.report_id || '');
    const leadId = String(req.query.lead_id || '');
    const result = await getPaidBackground(responseId);

    if (result.status === 'queued' || result.status === 'in_progress') {
      if (reportId) {
        try {
          await db.updateReport(reportId, { status: result.status });
        } catch (error) {
          console.warn('[Paid polling status save skipped]', error.message);
        }
      }

      return res.json({
        success: true,
        ready: false,
        status: result.status,
        job_id: result.id,
        generated_by: result.model
      });
    }

    if (result.status !== 'completed') {
      const message = errorMessage(
        result.error || result.incompleteDetails,
        `Paid report ended with status: ${result.status || 'unknown'}`
      );

      if (reportId) {
        try {
          await db.updateReport(reportId, {
            status: result.status || 'failed',
            ai_insights: { error: message }
          });
        } catch (error) {
          console.warn('[Paid failure save skipped]', error.message);
        }
      }

      return res.status(500).json({
        success: false,
        ready: false,
        status: result.status,
        error: message
      });
    }

    if (!result.reportText) {
      return res.status(500).json({
        success: false,
        ready: false,
        status: 'completed',
        error: 'OpenAI completed the job but returned empty report text'
      });
    }

    if (reportId) {
      try {
        await db.updateReport(reportId, {
          status: 'completed',
          ai_report: result.reportText,
          generated_by: result.model,
          pdf_url: '/api/reports/pdf-direct'
        });
      } catch (error) {
        console.warn('[Paid completed report save skipped]', error.message);
      }
    }

    if (leadId) {
      try {
        await db.updateLead(leadId, {
          status: 'paid_test_report_generated',
          tier: 'paid_blueprint_test'
        });
      } catch (error) {
        console.warn('[Paid completed lead save skipped]', error.message);
      }
    }

    return res.json({
      success: true,
      ready: true,
      status: 'completed',
      job_id: result.id,
      generated_by: result.model,
      report_text: result.reportText
    });
  } catch (error) {
    console.error('[Poll paid background report error]', error);
    return res.status(500).json({
      success: false,
      ready: false,
      error: error.message || 'Could not check paid report status'
    });
  }
});

router.post('/reports/pdf-direct', async (req, res) => {
  try {
    const {
      lead = {},
      numbers = {},
      astrology_data: astrologyData = null,
      report_text: reportText = '',
      report_type: reportType = 'paid_blueprint_direct'
    } = req.body || {};

    if (!String(lead.name || '').trim()) {
      return res.status(400).json({ error: 'Client name is required for PDF generation' });
    }

    if (!String(reportText || '').trim()) {
      return res.status(400).json({ error: 'Generated report text is required for PDF generation' });
    }

    const pdfBuffer = await generateReportPdf({
      lead,
      report: { type: reportType },
      numbers,
      astrologyData,
      reportText
    });

    const filename = `${safeFileName(lead.name)}-Full-Blueprint.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.end(pdfBuffer);
  } catch (error) {
    console.error('[Direct premium PDF error]', error);
    return res.status(500).json({
      error: error.message || 'Could not generate the premium PDF'
    });
  }
});

module.exports = router;
