const express = require('express');
const db = require('./database');
const { generateReportPdf } = require('./services/pdf');
const { generatePaidReport } = require('./services/paidReport');

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

async function saveGeneratedReportBestEffort({ payload, result }) {
  try {
    const existing = await db.getLeads({ search: payload.phone });
    const leadData = {
      name: payload.name,
      phone: payload.phone,
      dob: payload.dob,
      email: payload.email,
      tob: payload.tob,
      pob: payload.pob,
      question: payload.question,
      source: payload.source || 'paid_blueprint_public_test_form',
      status: 'paid_test_report_generated',
      tier: 'paid_blueprint_test'
    };

    const lead = existing.length
      ? await db.updateLead(existing[0].id, leadData)
      : await db.createLead(leadData);

    const report = await db.createReport({
      lead_id: lead.id,
      type: 'paid_blueprint_test',
      status: 'completed',
      input_data: {
        ...payload,
        payment_status: 'testing_without_payment_gateway'
      },
      horosoft_data: result.numbers,
      astrology_data: result.astrology_data,
      ai_report: result.report_text,
      ai_insights: {
        ...(result.insights || {}),
        generation_ms: result.generation_ms,
        delivery_ready: {
          email: payload.email,
          whatsapp: payload.phone
        }
      },
      generated_by: result.model,
      pdf_url: '/api/reports/pdf-direct'
    });

    return { lead_id: lead.id, report_id: report.id };
  } catch (error) {
    console.warn('[Paid report persistence skipped]', error.message);
    return { lead_id: '', report_id: '' };
  }
}

router.post('/reports/paid-test', async (req, res) => {
  const startedAt = Date.now();

  try {
    const payload = {
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
      dob: String(req.body.dob || '').trim(),
      email: String(req.body.email || '').trim(),
      tob: String(req.body.tob || '').trim(),
      pob: String(req.body.pob || '').trim(),
      question: String(req.body.question || '').trim(),
      source: String(req.body.source || 'paid_blueprint_public_test_form').trim()
    };

    const missing = missingPaidFields(payload);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    const result = await generatePaidReport(payload);
    const saved = await saveGeneratedReportBestEffort({ payload, result });

    return res.json({
      success: true,
      test_mode: true,
      payment_required: false,
      lead_id: saved.lead_id,
      report_id: saved.report_id,
      generated_by: result.model,
      generation_ms: result.generation_ms || (Date.now() - startedAt),
      storage: db.usingSupabase() ? 'supabase' : 'local_fallback',
      numbers: result.numbers,
      astrology_data: result.astrology_data,
      report_text: result.report_text,
      pdf_url: '/api/reports/pdf-direct',
      delivery_ready: {
        email: payload.email,
        whatsapp: payload.phone
      }
    });
  } catch (error) {
    console.error('[Fast paid blueprint report error]', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Paid report generation failed'
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
      success: false,
      error: error.message || 'Could not generate the premium PDF'
    });
  }
});

module.exports = router;
