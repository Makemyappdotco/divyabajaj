const express = require('express');
const db = require('./database');
const { generateReportPdf } = require('./services/pdf');
const { generatePaidReport } = require('./services/paidReport');
const { CONTRACT_VERSION, startPaidReportV2, pollPaidReportV2 } = require('./services/paidReportV2');
const { archiveReportSnapshot } = require('./services/reportArchive');
const {
  generateSourceBundle,
  getMode,
  getTimezoneForBirth
} = require('./services/astrologyApiV2');
const { searchLocations } = require('./services/locationSearch');

const router = express.Router();

function missingPaidFields(body) {
  return ['name', 'phone', 'dob', 'email', 'tob', 'pob'].filter(field => !String(body[field] || '').trim());
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
  return String(value || 'Divya-Bajaj').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Divya-Bajaj';
}

function previewOnly(req, res, next) {
  if (process.env.VERCEL_ENV === 'production' && getMode() !== 'sandbox') {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  return next();
}

function strictPersistentStorage() {
  return String(process.env.REQUIRE_PERSISTENT_STORAGE || '').toLowerCase() === 'true';
}

function assertStorageReady() {
  const health = db.storageHealth();
  if (strictPersistentStorage() && !health.persistent) {
    throw new Error('Persistent report storage is required but Supabase is not configured in this environment.');
  }
  return health;
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
    source: String(body.source || 'paid_blueprint_live').trim()
  };
}

function numbersFromV2(result = {}) {
  const deterministic = result.numerology_data?.deterministic || result.deterministic_numerology || {};
  if (deterministic.psychic_number) {
    return {
      ruling_number: deterministic.psychic_number,
      destiny_number: deterministic.destiny_number || '',
      name_number: deterministic.name_number || '',
      personal_year: deterministic.personal_year || ''
    };
  }
  const western = result.numerology_data?.numerological_numbers?.data || {};
  const indian = result.numerology_data?.numero_table?.data || {};
  return {
    ruling_number: indian.radical_number || indian.radical_num || '',
    destiny_number: indian.destiny_number || western.lifepath_number || '',
    name_number: western.expression_number || indian.name_number || '',
    personal_year: ''
  };
}

async function ensureLead(payload, type) {
  const existing = await db.getLeads({ search: payload.phone });
  const leadData = {
    name: payload.name,
    phone: payload.phone,
    dob: payload.dob,
    email: payload.email,
    tob: payload.tob,
    pob: payload.pob,
    question: payload.question,
    source: payload.source || 'paid_blueprint_live',
    status: 'paid_test_report_generated',
    tier: type,
    gender: payload.gender || '',
    birth_time_accuracy: payload.birth_time_accuracy || '',
    latitude: Number.isFinite(Number(payload.latitude)) ? Number(payload.latitude) : null,
    longitude: Number.isFinite(Number(payload.longitude)) ? Number(payload.longitude) : null,
    timezone: Number.isFinite(Number(payload.timezone)) ? Number(payload.timezone) : null,
    timezone_id: payload.timezone_id || '',
    country_code: payload.country_code || '',
    last_activity_at: new Date().toISOString()
  };

  if (existing.length) return db.updateLead(existing[0].id, leadData);
  const created = await db.createLead(leadData);
  return db.updateLead(created.id, {
    gender: leadData.gender,
    birth_time_accuracy: leadData.birth_time_accuracy,
    latitude: leadData.latitude,
    longitude: leadData.longitude,
    timezone: leadData.timezone,
    timezone_id: leadData.timezone_id,
    country_code: leadData.country_code,
    last_activity_at: leadData.last_activity_at
  });
}

async function archiveIfPossible({ report, lead }) {
  try {
    return await archiveReportSnapshot({ report, lead });
  } catch (error) {
    await db.logEvent('reports.archive_failed', 'reports', report.id, { message: error.message });
    if (strictPersistentStorage()) throw error;
    console.warn('[Report archive skipped]', error.message);
    return { archived: false, reason: error.message };
  }
}

async function saveGeneratedReport({ payload, result, type = 'paid_blueprint_test' }) {
  const storage = assertStorageReady();
  try {
    if (result.job_id) {
      const existingReports = await db.getReports({ type });
      const existingReport = existingReports.find(item => item.ai_insights?.job_id === result.job_id);
      if (existingReport) {
        const existingLead = await db.getLead(existingReport.lead_id);
        const archive = existingLead ? await archiveIfPossible({ report: existingReport, lead: existingLead }) : null;
        return { lead_id: existingReport.lead_id, report_id: existingReport.id, archive };
      }
    }

    const lead = await ensureLead(payload, type);
    const report = await db.createReport({
      lead_id: lead.id,
      type,
      status: 'completed',
      input_data: {
        ...payload,
        payment_status: 'testing_without_payment_gateway',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production'
      },
      horosoft_data: result.numbers || result.numerology_data || {},
      astrology_data: result.astrology_data || null,
      ai_report: result.report_text,
      ai_insights: {
        ...(result.insights || {}),
        job_id: result.job_id || '',
        report_contract_version: result.report_contract_version || '',
        calculation_contract_version: result.calculation_contract_version || '',
        prompt_version: result.prompt_version || '',
        knowledge_version: result.knowledge_version || '',
        qa: result.qa || null,
        report_json: result.report_json || null,
        numerology_data: result.numerology_data || null,
        generation_ms: result.generation_ms,
        delivery_ready: { email: payload.email, whatsapp: payload.phone },
        persistence: { mode: storage.mode, persistent: storage.persistent }
      },
      generated_by: result.model,
      pdf_url: '/api/reports/pdf-direct'
    });

    const archive = await archiveIfPossible({ report, lead });
    await db.updateLead(lead.id, { last_activity_at: new Date().toISOString() });
    return { lead_id: lead.id, report_id: report.id, archive };
  } catch (error) {
    if (strictPersistentStorage()) throw error;
    console.warn('[Paid report persistence skipped]', error.message);
    return { lead_id: '', report_id: '', archive: { archived: false, reason: error.message } };
  }
}

router.get('/astrology-v2/status', previewOnly, (req, res) => {
  res.json({
    success: true,
    mode: getMode(),
    access_token_configured: Boolean(process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN),
    pdf_sandbox_token_configured: Boolean(process.env.ASTROLOGYAPI_PDF_SANDBOX_TOKEN),
    openai_configured: Boolean(process.env.OPENAI_API_KEY),
    report_contract_version: CONTRACT_VERSION,
    persistent_storage: db.storageHealth(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local'
  });
});

router.get('/locations/search', previewOnly, async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ success: true, locations: [] });
    const locations = await searchLocations(query, 12);
    return res.json({ success: true, locations });
  } catch (error) {
    console.error('[Location search error]', error);
    return res.status(502).json({ success: false, error: error.message || 'Could not search locations' });
  }
});

router.post('/locations/timezone', previewOnly, async (req, res) => {
  try {
    const timezone = await getTimezoneForBirth({ latitude: req.body.latitude, longitude: req.body.longitude, dob: req.body.dob });
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
    if (missing.length) return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    const bundle = await generateSourceBundle(payload, { includePdfs: req.body.include_source_pdfs === true });
    return res.json({ success: true, mode: bundle.mode, generation_ms: Date.now() - startedAt, bundle });
  } catch (error) {
    console.error('[AstrologyAPI V2 source test error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Source test failed' });
  }
});

router.post('/reports/paid-test-v2/start', previewOnly, async (req, res) => {
  const startedAt = Date.now();
  try {
    assertStorageReady();
    const payload = normaliseV2Payload(req.body);
    const missing = missingPaidV2Fields(payload);
    if (missing.length) return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    const job = await startPaidReportV2(payload);
    return res.status(202).json({
      success: true,
      async: true,
      test_mode: true,
      provider: 'AstrologyAPI + OpenAI background',
      payment_required: false,
      startup_ms: Date.now() - startedAt,
      storage: db.storageHealth(),
      ...job
    });
  } catch (error) {
    console.error('[Paid blueprint start error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not start Integrated Life Report generation' });
  }
});

router.post('/reports/paid-test-v2/status', previewOnly, async (req, res) => {
  try {
    const result = await pollPaidReportV2({ job_token: req.body.job_token, response_ids: req.body.response_ids });
    if (!result.completed) return res.status(202).json({ success: true, ...result });

    result.numbers = result.numbers || numbersFromV2(result);
    const saved = await saveGeneratedReport({ payload: result.input, result, type: 'paid_blueprint_v2_preview' });

    return res.json({
      success: true,
      completed: true,
      status: 'completed',
      test_mode: true,
      payment_required: false,
      lead_id: saved.lead_id,
      report_id: saved.report_id,
      archive: saved.archive,
      generated_by: result.model,
      generation_ms: result.generation_ms,
      storage: db.storageHealth(),
      numbers: result.numbers,
      astrology_data: result.astrology_data,
      numerology_data: result.numerology_data,
      report_json: result.report_json,
      report_text: result.report_text,
      qa: result.qa,
      pdf_url: saved.archive?.document?.id ? `/api/admin/documents/${saved.archive.document.id}/download` : '/api/reports/pdf-direct',
      delivery_ready: { email: result.input.email, whatsapp: result.input.phone }
    });
  } catch (error) {
    console.error('[Paid blueprint status error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not finish Integrated Life Report generation' });
  }
});

// Compatibility endpoint: never run a long blocking OpenAI request again.
router.post('/reports/paid-test-v2', previewOnly, async (req, res) => {
  try {
    assertStorageReady();
    const payload = normaliseV2Payload(req.body);
    const missing = missingPaidV2Fields(payload);
    if (missing.length) return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    const job = await startPaidReportV2(payload);
    return res.status(202).json({ success: true, async: true, storage: db.storageHealth(), ...job });
  } catch (error) {
    console.error('[Paid blueprint compatibility start error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not start Integrated Life Report generation' });
  }
});

router.post('/reports/paid-test', async (req, res) => {
  const startedAt = Date.now();
  try {
    assertStorageReady();
    const payload = {
      name: String(req.body.name || '').trim(), phone: String(req.body.phone || '').trim(),
      dob: String(req.body.dob || '').trim(), email: String(req.body.email || '').trim(),
      tob: String(req.body.tob || '').trim(), pob: String(req.body.pob || '').trim(),
      question: String(req.body.question || '').trim(), source: String(req.body.source || 'paid_blueprint_public_test_form').trim()
    };
    const missing = missingPaidFields(payload);
    if (missing.length) return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    const result = await generatePaidReport(payload);
    const saved = await saveGeneratedReport({ payload, result });
    return res.json({
      success: true, test_mode: true, payment_required: false,
      lead_id: saved.lead_id, report_id: saved.report_id, archive: saved.archive,
      generated_by: result.model, generation_ms: result.generation_ms || (Date.now() - startedAt),
      storage: db.storageHealth(), numbers: result.numbers, astrology_data: result.astrology_data,
      report_text: result.report_text,
      pdf_url: saved.archive?.document?.id ? `/api/admin/documents/${saved.archive.document.id}/download` : '/api/reports/pdf-direct'
    });
  } catch (error) {
    console.error('[Fast paid blueprint report error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Paid report generation failed' });
  }
});

router.post('/reports/pdf-direct', async (req, res) => {
  try {
    const { lead = {}, numbers = {}, astrology_data: astrologyData = null, report_text: reportText = '', report_type: reportType = 'paid_blueprint_direct' } = req.body || {};
    if (!String(lead.name || '').trim()) return res.status(400).json({ error: 'Client name is required for PDF generation' });
    if (!String(reportText || '').trim()) return res.status(400).json({ error: 'Generated report text is required for PDF generation' });
    const pdfBuffer = await generateReportPdf({ lead, report: { type: reportType }, numbers, astrologyData, reportText });
    const filename = `${safeFileName(lead.name)}-Full-Blueprint.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.end(pdfBuffer);
  } catch (error) {
    console.error('[Direct premium PDF error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not generate the premium PDF' });
  }
});

module.exports = router;
