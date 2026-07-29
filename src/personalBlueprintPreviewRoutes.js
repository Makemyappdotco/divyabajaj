const express = require('express');
const { preparePersonalLifeBlueprintSource } = require('./services/personalLifeBlueprintSource');
const { generateStage } = require('./services/personalLifeBlueprintGenerator');

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
    question: 'Career and money direction'
  };
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

module.exports = router;
