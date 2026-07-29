const {
  PROMPT_VERSION,
  REPORT_CONTRACT_VERSION,
  buildStagePrompt,
  responseFormatForStage
} = require('./personalLifeBlueprintPrompt');
const { createStructuredResponse } = require('./openAiResponses');
const { preparePersonalLifeBlueprintSource } = require('./personalLifeBlueprintSource');

const QUALITY_PATCH_VERSION = 'personal-life-blueprint-quality-pass-2';

const QUALITY_RULES = `REPORT QUALITY PASS
These rules refine the master prompt and override any conflicting presentation habit.

1. This is a KP report. Treat KP planets, KP house cusps and KP significators as the authoritative house system. Never call a regular Vedic-house placement versus KP-house placement a chart discrepancy. Different house systems may place a planet differently.
2. Use display_position for customer-facing degrees. Never print absolute zodiac longitude such as 147:04:51. Write a sign-relative position such as Leo 27°04′51″.
3. Do not repeat the same global transit-data limitation inside every life area. State it in chart verification and the final confidence/limitations section. Within a life area, use Not claimed for exact timing without repeating the full DATA REQUIRED sentence.
4. Keep technical_basis concise and traceable, with no more than four items per life area. Do not repeat the complete Dasha stack or full numerology list in every section.
5. Avoid padding and repeated explanations. Each paragraph must add a new conclusion, example, caution or action.
6. Health must explicitly state whether one verified planet is loaded across all 6, 8 and 12. If no single planet covers all three, say that this specific severe-loading pattern is not present. Do not turn that into a health guarantee.
7. Use clean human-readable dates. Do not copy provider spacing or raw machine timestamps into narrative prose.
8. Keep the report premium and readable. The complete report should generally land between 10,000 and 13,000 words unless a genuine data issue requires more explanation.
9. No em dashes. No fear language. No gemstones. No unsupported exact dates.
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
    LOCKED_EARLIER_STAGE_OUTPUTS: earlierStages,
    STAGE_RULE: `Generate only ${stage}. Do not rewrite or contradict locked earlier stage outputs.`
  };
}

async function generateStage(stage, sourceContext, earlierStages = {}, {
  background = false,
  maxOutputTokens = 14000,
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