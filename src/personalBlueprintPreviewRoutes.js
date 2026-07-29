const express = require('express');
const { renderPersonalBlueprintPreviewPage } = require('./personalBlueprintPreviewPage');
const { preparePersonalLifeBlueprintSource } = require('./services/personalLifeBlueprintSource');
const { generateStage } = require('./services/personalLifeBlueprintGenerator');
const {
  advancePersonalLifeBlueprint,
  getPersonalLifeBlueprintStatus,
  startPersonalLifeBlueprint
} = require('./services/personalLifeBlueprintWorkflow');

const router = express.Router();

function isProductionRuntime() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production';
}

function previewOnly(req, res, next) {
  if (isProductionRuntime()) return res.status(404).json({ success: false, error: 'Not found' });
  return next();
}

function diagnosticInput() {
  return {
    name: 'Blueprint Test Client',
    phone: '+919000000001',
    email: 'blueprint-test@example.com',
    gender: 'male',
    dob: '1994-08-23',
    tob: '07:35',
    birth_time_accuracy: 'family_confirmed',
    pob: 'Delhi, India',
    place: 'Delhi, India',
    latitude: 28.65381,
    longitude: 77.22897,
    timezone: 5.5,
    timezone_id: 'Asia/Kolkata',
    country_code: 'IN',
    current_residence: 'Delhi, India',
    question: 'Career and money direction',
    source: 'personal_blueprint_diagnostic'
  };
}

function normaliseInput(body = {}) {
  const pob = String(body.pob || body.place || '').trim();
  return {
    name: String(body.name || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim(),
    gender: String(body.gender || '').trim().toLowerCase(),
    dob: String(body.dob || '').trim(),
    tob: String(body.tob || '').trim(),
    birth_time_accuracy: String(body.birth_time_accuracy || '').trim(),
    pob,
    place: pob,
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    timezone: Number(body.timezone),
    timezone_id: String(body.timezone_id || '').trim(),
    country_code: String(body.country_code || '').trim().toUpperCase(),
    current_residence: String(body.current_residence || '').trim(),
    question: String(body.question || '').trim(),
    source: String(body.source || 'personal_life_blueprint_v2_preview').trim()
  };
}

function validateInput(input) {
  const errors = {};
  if (!/^[A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{1,79}$/.test(input.name)) errors.name = 'Enter a valid full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email)) errors.email = 'Enter a valid email address.';
  const phoneLength = input.phone.replace(/\D/g, '').length;
  if (phoneLength < 10 || phoneLength > 15) errors.phone = 'Enter a valid WhatsApp number.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob)) errors.dob = 'Date of birth must use YYYY-MM-DD.';
  if (!/^\d{2}:\d{2}$/.test(input.tob)) errors.tob = 'Time of birth must use HH:MM.';
  if (!['male', 'female'].includes(input.gender)) errors.gender = 'Select male or female.';
  if (!['exact_record', 'family_confirmed', 'approximate'].includes(input.birth_time_accuracy)) errors.birth_time_accuracy = 'Select birth-time accuracy.';
  if (!input.pob) errors.pob = 'Birth place is required.';
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) errors.latitude = 'Latitude is invalid.';
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) errors.longitude = 'Longitude is invalid.';
  if (!Number.isFinite(input.timezone) || input.timezone < -14 || input.timezone > 14) errors.timezone = 'Timezone is invalid.';
  if (input.question.length < 5) errors.question = 'Add the main concern in a few words.';
  return errors;
}

function sourceSummary(source) {
  const bundle = source.raw_bundle || {};
  const rowCount = result => result?.ok && Array.isArray(result.data) ? result.data.length : 0;
  return {
    verification: source.verification,
    deterministic_numerology: source.deterministic_numerology,
    dominant_planets: source.dominant_planets,
    double_confirmation: source.double_confirmation,
    source_counts: {
      kp_planets: rowCount(bundle.kp_planets),
      kp_house_cusps: rowCount(bundle.kp_house_cusps),
      kp_planet_significators: rowCount(bundle.kp_planet_significators),
      kp_house_significators: rowCount(bundle.kp_house_significators)
    }
  };
}

router.get('/reports/personal-life-blueprint-v2/preview', previewOnly, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.send(renderPersonalBlueprintPreviewPage());
});

router.get('/astrology-v2/personal-blueprint-source-test', previewOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const source = await preparePersonalLifeBlueprintSource(diagnosticInput(), {
      includePdfs: false,
      reportDate: new Date()
    });
    return res.status(source.verification.ready_for_personal_life_blueprint ? 200 : 422).json({
      success: source.verification.ready_for_personal_life_blueprint,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
      ...sourceSummary(source)
    });
  } catch (error) {
    console.error('[Personal Blueprint source test error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Source verification failed' });
  }
});

router.get('/reports/personal-life-blueprint-v2/stage1-test', previewOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const source = await preparePersonalLifeBlueprintSource(diagnosticInput(), {
      includePdfs: false,
      reportDate: new Date()
    });
    if (!source.verification.ready_for_personal_life_blueprint) {
      return res.status(422).json({
        success: false,
        error: 'Source verification must pass before Stage 1 generation.',
        ...sourceSummary(source)
      });
    }

    const stage = await generateStage('verification_big_picture', source.context, {}, {
      maxOutputTokens: 10000,
      reasoningEffort: 'none'
    });

    return res.json({
      success: true,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
      prompt_version: stage.prompt_version,
      report_contract_version: stage.report_contract_version,
      model: stage.model,
      response_id: stage.response_id,
      usage: stage.usage,
      source: sourceSummary(source),
      output: stage.output
    });
  } catch (error) {
    console.error('[Personal Blueprint Stage 1 test error]', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Stage 1 generation failed',
      openai_request_id: error.openai_request_id || '',
      client_request_id: error.client_request_id || '',
      output_preview: error.output_preview || ''
    });
  }
});

router.get('/reports/personal-life-blueprint-v2/diagnostic-start', previewOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const started = await startPersonalLifeBlueprint(diagnosticInput(), { reportDate: new Date() });
    return res.status(202).json({
      success: true,
      test_mode: true,
      ...started,
      status_url: `/api/reports/personal-life-blueprint-v2/${started.report_id}/status`,
      advance_url: `/api/reports/personal-life-blueprint-v2/${started.report_id}/advance`
    });
  } catch (error) {
    console.error('[Personal Blueprint diagnostic start error]', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Diagnostic Personal Life Blueprint could not be started',
      verification: error.verification || null,
      openai_request_id: error.openai_request_id || '',
      client_request_id: error.client_request_id || ''
    });
  }
});

router.post('/reports/personal-life-blueprint-v2/start', previewOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const input = normaliseInput(req.body);
    const errors = validateInput(input);
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, error: 'Please correct the submitted information.', fields: errors });
    }
    const started = await startPersonalLifeBlueprint(input, { reportDate: new Date() });
    return res.status(202).json({
      success: true,
      test_mode: true,
      ...started,
      status_url: `/api/reports/personal-life-blueprint-v2/${started.report_id}/status`,
      advance_url: `/api/reports/personal-life-blueprint-v2/${started.report_id}/advance`
    });
  } catch (error) {
    console.error('[Personal Blueprint start error]', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Personal Life Blueprint could not be started',
      verification: error.verification || null,
      openai_request_id: error.openai_request_id || '',
      client_request_id: error.client_request_id || ''
    });
  }
});

router.get('/reports/personal-life-blueprint-v2/:reportId/status', previewOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const status = await getPersonalLifeBlueprintStatus(String(req.params.reportId || ''));
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.message || 'Could not read report status' });
  }
});

router.get('/reports/personal-life-blueprint-v2/:reportId/document.txt', previewOnly, async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  try {
    const status = await getPersonalLifeBlueprintStatus(String(req.params.reportId || ''));
    if (status.status !== 'completed' || !status.document?.plain_text) {
      return res.status(409).json({ success: false, error: 'The report document is not complete yet.' });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Personal-Life-Blueprint-${status.report_id}.txt"`);
    return res.send(status.document.plain_text);
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.message || 'Could not download report document' });
  }
});

async function advanceHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const result = await advancePersonalLifeBlueprint(String(req.params.reportId || ''));
    return res.json({ success: result.status !== 'failed', ...result });
  } catch (error) {
    console.error('[Personal Blueprint advance error]', error);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Could not advance report generation',
      openai_request_id: error.openai_request_id || '',
      client_request_id: error.client_request_id || ''
    });
  }
}

router.post('/reports/personal-life-blueprint-v2/:reportId/advance', previewOnly, advanceHandler);
router.get('/reports/personal-life-blueprint-v2/:reportId/advance', previewOnly, advanceHandler);

module.exports = router;
