const {
  PROMPT_VERSION,
  REPORT_CONTRACT_VERSION,
  buildStagePrompt,
  responseFormatForStage
} = require('./personalLifeBlueprintPrompt');
const { createStructuredResponse } = require('./openAiResponses');
const { preparePersonalLifeBlueprintSource } = require('./personalLifeBlueprintSource');

const QUALITY_PATCH_VERSION = 'client-master-fidelity-1';

const QUALITY_RULES = `REPORT QUALITY PASS
These rules protect source fidelity and readability. They must never change the client's required report structure.

1. This is a KP report. Treat KP planets, KP house cusps and KP significators as the authoritative house system. Never call a regular Vedic-house placement versus KP-house placement a chart discrepancy.
2. Use display_position for customer-facing degrees. Never print absolute zodiac longitude such as 147:04:51. Write a sign-relative position such as Leo 27°04′51″.
3. Do not repeat the same global transit-data limitation inside every paragraph. State the source limitation in chart verification and again where precision is explicitly being audited. Inside a life area, use Not claimed for unsupported exact timing.
4. Never replace or merge the seven required life areas. They are Personal Nature, Past Life Karma, Finances, Marriage, Health, Children and Property.
5. Never replace the exact internal life-area sequence with dashboards, summaries or 90-day-plan chapters. Visual design comes later; generation must preserve substance first.
6. Do not create extra sales chapters or repeated consultation CTAs. The closing limitations should create the natural next engagement through honesty.
7. Avoid repetition and padding. Every paragraph must add a new conclusion, explanation, concrete example, caution or action.
8. Keep dates human-readable and preserve source precision. Do not turn a multi-month or unavailable transit window into a precise date.
9. No em dashes, fear language, gemstone recommendations or unsupported exact predictions.
10. Earlier stage facts, deterministic scores and confidence labels are locked and must not be rewritten.`;

const STAGES = Object.freeze([
  'verification_big_picture',
  'life_areas_one_to_three',
  'life_areas_four_to_seven',
  'remedies_audit_closing'
]);

function getModel() {
  return process.env.OPENAI_PAID_MODEL || 'gpt-5.5';
}

function effectivePromptVersion() {
  return `${PROMPT_VERSION}+${QUALITY_PATCH_VERSION}`;
}

function generationMetadata({ stage, sourceContext, earlierStages }) {
  return {
    prompt_version: effectivePromptVersion(),
    report_contract_version: REPORT_CONTRACT_VERSION,
    quality_patch_version: QUALITY_PATCH_VERSION,
    stage,
    source_generated_at: sourceContext?.source_generated_at || '',
    report_date: sourceContext?.input?.report_date || '',
    earlier_stage_count: String(Object.keys(earlierStages || {}).length)
  };
}

function contextForStage(stage, sourceContext, earlierStages = {}) {
  return {
    VERIFIED_SOURCE_DATA: sourceContext,
    BACKEND_CALCULATIONS: {
      deterministic_numerology: sourceContext?.deterministic_numerology || null,
      dominant_planet_scoring: sourceContext?.dominant_planet_scoring || null,
      double_confirmation: sourceContext?.double_confirmation || null
    },
    LOCKED_EARLIER_STAGE_OUTPUTS: earlierStages,
    STAGE_RULE: `Generate only ${stage}. Do not rewrite or contradict locked earlier stage outputs.`
  };
}

async function generateStage(stage, sourceContext, earlierStages = {}, {
  background = false,
  maxOutputTokens = 16000,
  reasoningEffort = 'none'
} = {}) {
  if (!STAGES.includes(stage)) throw new Error(`Unknown Personal Life Blueprint stage: ${stage}`);

  const promptContext = contextForStage(stage, sourceContext, earlierStages);
  const prompt = `${QUALITY_RULES}\n\n${buildStagePrompt(stage, promptContext)}`;
  const responseFormat = responseFormatForStage(stage);
  const response = await createStructuredResponse({
    model: getModel(),
    prompt,
    responseFormat,
    maxOutputTokens,
    reasoningEffort,
    metadata: generationMetadata({ stage, sourceContext, earlierStages }),
    store: background,
    background
  });

  return {
    stage,
    prompt_version: effectivePromptVersion(),
    base_prompt_version: PROMPT_VERSION,
    quality_patch_version: QUALITY_PATCH_VERSION,
    report_contract_version: REPORT_CONTRACT_VERSION,
    model: getModel(),
    generated_at: new Date().toISOString(),
    ...response
  };
}

function assertReadyForFinalBlueprint(source) {
  if (!source?.verification?.ready_for_personal_life_blueprint) {
    const issues = source?.verification?.blocking_issues || ['Unknown source verification failure'];
    throw new Error(`Personal Life Blueprint source is not verified: ${issues.join(' | ')}`);
  }
}

async function generatePersonalLifeBlueprint(input, {
  includePdfs = false,
  reportDate = new Date(),
  requireVerifiedSource = true,
  onStageComplete = null
} = {}) {
  const startedAt = Date.now();
  const source = await preparePersonalLifeBlueprintSource(input, { includePdfs, reportDate });
  if (requireVerifiedSource) assertReadyForFinalBlueprint(source);

  const stageOutputs = {};
  const stageAudit = [];

  for (const stage of STAGES) {
    const stageStartedAt = Date.now();
    const result = await generateStage(stage, source.context, stageOutputs);
    if (!result.output) throw new Error(`Personal Life Blueprint stage ${stage} returned no output`);

    stageOutputs[stage] = result.output;
    stageAudit.push({
      stage,
      response_id: result.response_id,
      model: result.model,
      status: result.status,
      usage: result.usage,
      openai_request_id: result.openai_request_id,
      client_request_id: result.client_request_id,
      duration_ms: Date.now() - stageStartedAt
    });

    if (typeof onStageComplete === 'function') {
      await onStageComplete({
        stage,
        output: result.output,
        audit: stageAudit[stageAudit.length - 1]
      });
    }
  }

  return {
    generated: true,
    prompt_version: effectivePromptVersion(),
    base_prompt_version: PROMPT_VERSION,
    quality_patch_version: QUALITY_PATCH_VERSION,
    report_contract_version: REPORT_CONTRACT_VERSION,
    calculation_contract_version: 'astrologyapi-kp-plus-deterministic-numerology-v1',
    model: getModel(),
    generated_at: new Date().toISOString(),
    generation_ms: Date.now() - startedAt,
    input_snapshot: source.context.input,
    source_context: source.context,
    source_verification: source.verification,
    deterministic_numerology: source.deterministic_numerology,
    dominant_planets: source.dominant_planets,
    double_confirmation: source.double_confirmation,
    stages: stageOutputs,
    stage_audit: stageAudit,
    source_pdfs: source.source_pdfs,
    raw_source_bundle: source.raw_bundle
  };
}

module.exports = {
  QUALITY_PATCH_VERSION,
  QUALITY_RULES,
  STAGES,
  assertReadyForFinalBlueprint,
  contextForStage,
  effectivePromptVersion,
  generatePersonalLifeBlueprint,
  generateStage,
  getModel
};