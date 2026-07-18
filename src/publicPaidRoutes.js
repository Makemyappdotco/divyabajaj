const express = require('express');
const db = require('./database');
const { generateReportPdf } = require('./services/pdf');
const { generatePaidReport } = require('./services/paidReport');
const { generatePaidReportV2 } = require('./services/paidReportV2');
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

function previewOnly(req, res, next) {
  if (process.env.VERCEL_ENV === 'production' && getMode() !== 'sandbox') {
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
    source: String(body.source || 'paid_blueprint_v2_preview').trim()
  };
}

function numbersFromV2(result = {}) {
  const western = result.numerology_data?.numerological_numbers?.data || {};
  const indian = result.numerology_data?.numero_table?.data || {};
  return {
    ruling_number: indian.radical_number || indian.radical_num || '',
    destiny_number: indian.destiny_number || western.lifepath_number || '',
    name_number: indian.name_number || western.expression_number || '',
    personal_year: '',
    lifepath_number: western.lifepath_number || '',
    personality_number: western.personality_number || '',
    soul_urge_number: western.soul_urge_number || ''
  };
}

async function saveGeneratedReportBestEffort({ payload, result, type = 'paid_blueprint_test' }) {
  try {
    const existing = await db.getLeads({ search: payload.phone });
    const leadData = {
      name: payload.name,
      phone: payload.phone,
      dob: payload.dob,
      email: payload.email,
      gender: payload.gender,
      tob: payload.tob,
      birth_time_accuracy: payload.birth_time_accuracy,
      pob: payload.pob,
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone,
      timezone_id: payload.timezone_id,
      country_code: payload.country_code,
      question: payload.question,
      source: payload.source || 'paid_blueprint_public_test_form',
      status: 'paid_test_report_generated',
      tier: type
    };

    const lead = existing.length
      ? await db.updateLead(existing[0].id, leadData)
      : await db.createLead(leadData);

    const report = await db.createReport({
      lead_id: lead.id,
      type,
      status: 'completed',
      input_data: {
        ...payload,
        payment_status: 'testing_without_payment_gateway'
      },
      horosoft_data: result.numbers || result.numerology_data || {},
      astrology_data: result.astrology_data,
      ai_report: result.report_text,
      ai_insights: {
        ...(result.insights || {}),
        report_json: result.report_json || null,
        numerology_data: result.numerology_data || null,
        source_pdfs: result.source_pdfs || null,
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

router.get('/astrology-v2/status', previewOnly, (req, res) => {
  res.json({
    success: true,
    mode: getMode(),
    access_token_configured: Boolean(process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN),
    pdf_sandbox_token_configured: Boolean(process.env.ASTROLOGYAPI_PDF_SANDBOX_TOKEN),
    openai_configured: Boolean(process.env.OPENAI_API_KEY),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local'
  });
});

router.get('/locations/search', previewOnly, async (req, res) => {
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

router.post('/locations/timezone', previewOnly, async (req, res) => {
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
      includePdfs: req.body.include_source_pdfs === true
    });

    const summary = {
      planets: bundle.planets?.ok,
      current_vdasha: bundle.current_vdasha?.ok,
      current_vdasha_all: bundle.current_vdasha_all?.ok,
      numerological_numbers: bundle.numerological_numbers?.ok,
      numero_table: bundle.numero_table?.ok,
      chart_d1: bundle.charts?.D1?.ok,
      chart_d9: bundle.charts?.D9?.ok,
      chart_d10: bundle.charts?.D10?.ok,
      chart_image_d1: bundle.chart_images?.D1?.ok,
      chart_image_d9: bundle.chart_images?.D9?.ok,
      chart_image_d10: bundle.chart_images?.D10?.ok,
      pro_horoscope_pdf: bundle.pdfs?.pro_horoscope?.ok,
      pro_numerology_pdf: bundle.pdfs?.pro_numerology?.ok
    };

    return res.json({
      success: true,
      mode: bundle.mode,
      generation_ms: Date.now() - startedAt,
      summary,
      bundle
    });
  } catch (error) {
    console.error('[AstrologyAPI V2 source test error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Source test failed' });
  }
});

router.post('/reports/paid-test-v2', previewOnly, async (req, res) => {
  const startedAt = Date.now();
  try {
    const payload = normaliseV2Payload(req.body);
    const missing = missingPaidV2Fields(payload);
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }

    const result = await generatePaidReportV2(payload, {
      includePdfs: req.body.include_source_pdfs === true
    });
    result.numbers = numbersFromV2(result);

    const saved = await saveGeneratedReportBestEffort({
      payload,
      result,
      type: 'paid_blueprint_v2_preview'
    });

    return res.json({
      success: true,
      test_mode: true,
      provider: 'AstrologyAPI',
      payment_required: false,
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
    console.error('[Paid blueprint V2 error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Paid report V2 generation failed' });
  }
});

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