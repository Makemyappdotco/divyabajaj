const express = require('express');
const db = require('./database');
const { generateReportPdf } = require('./services/pdf');
const { generatePaidReport } = require('./services/paidReport');
const { generatePaidReportV2 } = require('./services/paidReportV2');
const { renderReportPdfBuffer } = require('./services/htmlReport/render');
const {
  generateSourceBundle,
  getMode,
  getTimezoneForBirth,
  searchLocations
} = require('./services/astrologyApiV2');

const router = express.Router();

function missingPaidFields(body) {
  return ['name', 'phone', 'dob', 'email', 'tob', 'pob'].filter(
    field => !String(body[field] || '').trim()
  );
}

function missingPaidV2Fields(body) {
  const stringFields = ['name', 'phone', 'dob', 'email', 'tob', 'pob', 'gender', 'birth_time_accuracy'];
  const missing = stringFields.filter(field => !String(body[field] || '').trim());
  ['latitude', 'longitude', 'timezone'].forEach(field => {
    if (!Number.isFinite(Number(body[field]))) missing.push(field);
  });
  return missing;
}

function safeFileName(value) {
  return String(value || 'Divya-Bajaj')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'Divya-Bajaj';
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isProductionRuntime() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production';
}

function previewOnly(req, res, next) {
  if (isProductionRuntime()) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  return next();
}

function normaliseV2Payload(body = {}) {
  return {
    name: String(body.name || '').trim(),
    phone: String(body.phone || '').trim(),
    dob: String(body.dob || '').trim(),
    email: String(body.email || '').trim(),
    gender: String(body.gender || '').trim().toLowerCase(),
    tob: String(body.tob || '').trim(),
    birth_time_accuracy: String(body.birth_time_accuracy || '').trim(),
    pob: String(body.pob || body.place || '').trim(),
    place: String(body.pob || body.place || '').trim(),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    timezone: Number(body.timezone),
    timezone_id: String(body.timezone_id || '').trim(),
    country_code: String(body.country_code || '').trim(),
    question: String(body.question || '').trim(),
    include_source_pdfs: body.include_source_pdfs === true,
    source: String(body.source || 'paid_blueprint_live').trim()
  };
}

function numbersFromV2(result = {}) {
  const western = result.numerology_data?.numerological_numbers?.data || {};
  const indian = result.numerology_data?.numero_table?.data || {};
  const deterministic = result.numerology_data?.deterministic || {};
  return {
    ruling_number: deterministic.birth_number || deterministic.psychic_number || indian.radical_number || indian.radical_num || '',
    destiny_number: deterministic.destiny_number || indian.destiny_number || western.lifepath_number || '',
    name_number: deterministic.name_number || indian.name_number || western.expression_number || '',
    personal_year: deterministic.personal_year || '',
    lifepath_number: western.lifepath_number || '',
    personality_number: western.personality_number || '',
    soul_urge_number: western.soul_urge_number || ''
  };
}

async function findExactLead(payload) {
  const phoneKey = normalizePhone(payload.phone);
  const emailKey = normalizeEmail(payload.email);
  const candidates = await db.getLeads({ search: phoneKey });
  return candidates.find(row =>
    normalizePhone(row.normalized_phone || row.phone) === phoneKey &&
    normalizeEmail(row.normalized_email || row.email) === emailKey
  ) || null;
}

async function saveGeneratedReport({ payload, result, type = 'paid_blueprint_test' }) {
  try {
    const existing = await findExactLead(payload);
    const leadData = {
      name: payload.name,
      phone: payload.phone,
      dob: payload.dob,
      email: payload.email,
      gender: payload.gender || '',
      tob: payload.tob,
      birth_time_accuracy: payload.birth_time_accuracy || '',
      pob: payload.pob,
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone,
      timezone_id: payload.timezone_id || '',
      country_code: payload.country_code || '',
      question: payload.question,
      source: payload.source || 'paid_blueprint_live',
      status: 'paid_test_report_generated',
      tier: type
    };

    const lead = existing
      ? await db.updateLead(existing.id, leadData)
      : await db.createLead(leadData);

    if (!lead?.id) throw new Error('Lead record was not created');

    const completedAt = new Date().toISOString();
    const isIntegrated = type === 'paid_blueprint_v2_preview';
    const report = await db.createReport({
      lead_id: lead.id,
      type,
      status: 'completed',
      completed_at: completedAt,
      report_contract_version: isIntegrated ? 'integrated-life-report-v1' : 'paid-legacy-preview',
      calculation_contract_version: isIntegrated ? 'astrologyapi-kp-chaldean-v1' : 'numerology-legacy',
      prompt_version: isIntegrated ? 'integrated-life-report-prompt-v1' : 'paid-legacy-prompt-v1',
      knowledge_version: 'client-template-2026-08-21',
      pdf_template_version: 'legacy-paid-v1',
      input_data: {
        ...payload,
        payment_status: 'testing_without_payment_gateway'
      },
      horosoft_data: result.numbers || result.numerology_data || {},
      astrology_data: result.astrology_data,
      ai_report: result.report_text,
      report_json: result.report_json || null,
      ai_insights: {
        ...(result.insights || {}),
        numerology_data: result.numerology_data || null,
        source_pdfs: result.source_pdfs || null,
        generation_ms: result.generation_ms,
        report_contract_version: result.report_contract_version || '',
        delivery_ready: {
          email: payload.email,
          whatsapp: payload.phone
        }
      },
      generated_by: result.model,
      pdf_url: '/api/reports/pdf-direct'
    });

    if (!report?.id) throw new Error('Report record was not created');
    return { lead_id: lead.id, report_id: report.id };
  } catch (error) {
    console.error('[Paid report persistence failed]', error);
    throw new Error(`Report generation completed, but saving failed: ${error.message}`);
  }
}

router.get('/astrology-v2/status', previewOnly, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json({
    success: true,
    mode: getMode(),
    access_token_configured: Boolean(process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN),
    pdf_sandbox_token_configured: Boolean(process.env.ASTROLOGYAPI_PDF_SANDBOX_TOKEN),
    openai_configured: Boolean(process.env.OPENAI_API_KEY),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local'
  });
});

/*
  These three endpoints are required by the existing live Integrated Life Report form.
  Diagnostics remain preview-only. The generation response remains explicitly test_mode
  and payment_required:false until a real payment gate is connected and verified.
*/
router.get('/locations/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ success: true, locations: [] });
    const locations = await searchLocations(query, 7);
    return res.json({ success: true, locations });
  } catch (error) {
    console.error('[Location search error]', error);
    return res.status(502).json({ success: false, error: error.message || 'Could not search locations' });
  }
});

router.post('/locations/timezone', async (req, res) => {
  try {
    const timezone = await getTimezoneForBirth({
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      dob: req.body.dob
    });
    return res.json({ success: true, timezone });
  } catch (error) {
    console.error('[Timezone lookup error]', error);
    return res.status(502).json({ success: false, error: error.message || 'Could not determine timezone' });
  }
});

router.post('/astrology-v2/source-test', previewOnly, async (req, res) => {
  const startedAt = Date.now();
  try {
    const payload = normaliseV2Payload(req.body);
    const missing = missingPaidV2Fields(payload);
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }

    const bundle = await generateSourceBundle(payload, {
      includePdfs: payload.include_source_pdfs
    });

    return res.json({
      success: true,
      mode: bundle.mode,
      generation_ms: Date.now() - startedAt,
      bundle
    });
  } catch (error) {
    console.error('[AstrologyAPI V2 source test error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Source test failed' });
  }
});

router.post('/reports/paid-test-v2', async (req, res) => {
  const startedAt = Date.now();
  try {
    const payload = normaliseV2Payload(req.body);
    const missing = missingPaidV2Fields(payload);
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }

    const result = await generatePaidReportV2(payload, {
      includePdfs: payload.include_source_pdfs
    });
    result.numbers = numbersFromV2(result);

    const saved = await saveGeneratedReport({
      payload,
      result,
      type: 'paid_blueprint_v2_preview'
    });

    return res.json({
      success: true,
      test_mode: true,
      provider: 'AstrologyAPI',
      payment_required: false,
      report_contract_version: result.report_contract_version,
      lead_id: saved.lead_id,
      report_id: saved.report_id,
      generated_by: result.model,
      generation_ms: result.generation_ms || (Date.now() - startedAt),
      storage: db.usingSupabase() ? 'supabase' : 'local_fallback',
      numbers: result.numbers,
      astrology_data: result.astrology_data,
      numerology_data: result.numerology_data,
      source_pdfs: result.source_pdfs,
      report_json: result.report_json,
      report_text: result.report_text,
      pdf_url: '/api/reports/pdf-direct',
      delivery_ready: {
        email: payload.email,
        whatsapp: payload.phone
      }
    });
  } catch (error) {
    console.error('[Integrated Life Report error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Integrated Life Report generation failed' });
  }
});

router.post('/reports/paid-test', previewOnly, async (req, res) => {
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
    const saved = await saveGeneratedReport({ payload, result });

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

    const filename = `${safeFileName(lead.name)}-Integrated-Life-Report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.end(pdfBuffer);
  } catch (error) {
    console.error('[Direct premium PDF error]', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Could not generate the premium PDF'
    });
  }
});

/*
  New, isolated preview route. This does NOT touch /reports/pdf-direct or the
  live paid-report download path - it renders the same report_json content
  through the HTML/CSS template (the approved design, pulled from the real
  approved PDF's own artwork) via headless Chromium instead of PDFKit.

  Body: { lead: { name, dob, tob, pob }, report: <report_json from
  /reports/paid-test-v2 or /reports/paid-test>, onePage?: <optional> }

  Pass the same report_json back in as many times as needed while checking
  the design - this route never calls OpenAI or AstrologyAPI, so iterating on
  the PDF costs nothing and never changes the wording.
*/
router.post('/reports/pdf-html-preview', previewOnly, async (req, res) => {
  try {
    const { lead = {}, report = {}, onePage = null } = req.body || {};

    if (!String(lead.name || '').trim()) {
      return res.status(400).json({ success: false, error: 'lead.name is required' });
    }
    if (!report || !report.primer || !report.glance || !report.life_areas) {
      return res.status(400).json({
        success: false,
        error: 'report must be a report_json object (primer, glance, life_areas, ...) from /reports/paid-test-v2'
      });
    }

    const pdfBuffer = await renderReportPdfBuffer({ lead, report, onePage });

    const filename = `${safeFileName(lead.name)}-Integrated-Life-Report-PREVIEW.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.end(pdfBuffer);
  } catch (error) {
    console.error('[HTML report preview PDF error]', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Could not generate the preview PDF'
    });
  }
});

module.exports = router;
