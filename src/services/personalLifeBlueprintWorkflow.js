const db = require('../database');
const { PROMPT_VERSION, REPORT_CONTRACT_VERSION } = require('./personalLifeBlueprintPrompt');
const { STAGES, generateStage, getModel } = require('./personalLifeBlueprintGenerator');
const { preparePersonalLifeBlueprintSource } = require('./personalLifeBlueprintSource');
const { composePersonalLifeBlueprint } = require('./personalLifeBlueprintDocument');
const { getResponse } = require('./openAiResponses');

const REPORT_TYPE = 'personal_life_blueprint_v2_preview';
const CALCULATION_CONTRACT_VERSION = 'astrologyapi-kp-plus-deterministic-numerology-v1';
const PDF_TEMPLATE_VERSION = 'personal-life-blueprint-v2-draft-1';

function now() {
  return new Date().toISOString();
}

function runtimeEnvironment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production' ? 'production' : 'test';
  return process.env.NODE_ENV === 'production' ? 'production' : 'test';
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function findExactLead(input) {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const candidates = await db.getLeads({ search: phone });
  return candidates.find(row =>
    normalizePhone(row.normalized_phone || row.phone) === phone &&
    normalizeEmail(row.normalized_email || row.email) === email
  ) || null;
}

async function findReport(reportId) {
  const reports = await db.getReports({});
  return reports.find(report => report.id === reportId) || null;
}

function leadPayload(input, status) {
  return {
    environment: runtimeEnvironment(),
    name: input.name,
    phone: input.phone,
    email: input.email,
    gender: input.gender,
    dob: input.dob,
    tob: input.tob,
    birth_time_accuracy: input.birth_time_accuracy || '',
    pob: input.pob,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone,
    timezone_id: input.timezone_id || '',
    country_code: input.country_code || '',
    question: input.question || '',
    source: input.source || 'personal_life_blueprint_v2_preview',
    status,
    tier: REPORT_TYPE,
    last_activity_at: now()
  };
}

function initialReportDocument(source, firstStage) {
  return {
    source_context: source.context,
    stages: {},
    stage_audit: [],
    document: null,
    workflow: {
      status: 'generating',
      stage_index: 0,
      current_stage: STAGES[0],
      response_id: firstStage.response_id,
      response_status: firstStage.status,
      started_at: now(),
      updated_at: now(),
      completed_at: null,
      failure: null
    }
  };
}

async function startPersonalLifeBlueprint(input, { reportDate = new Date() } = {}) {
  if (runtimeEnvironment() === 'production') {
    throw Object.assign(new Error('Personal Life Blueprint V2 is not enabled in Production.'), { status: 404 });
  }

  const source = await preparePersonalLifeBlueprintSource(input, {
    includePdfs: false,
    reportDate
  });

  if (!source.verification.ready_for_personal_life_blueprint) {
    const error = new Error('Source verification failed. The report was not started.');
    error.status = 422;
    error.verification = source.verification;
    throw error;
  }

  const existingLead = await findExactLead(input);
  const lead = existingLead
    ? await db.updateLead(existingLead.id, leadPayload(input, 'personal_blueprint_generating'))
    : await db.createLead(leadPayload(input, 'personal_blueprint_generating'));

  if (!lead?.id) throw new Error('Lead could not be created for Personal Life Blueprint');

  const firstStage = await generateStage(STAGES[0], source.context, {}, {
    background: true,
    maxOutputTokens: 10000,
    reasoningEffort: 'none'
  });

  if (!firstStage.response_id) throw new Error('OpenAI did not return a background response ID for Stage 1');

  const reportJson = initialReportDocument(source, firstStage);
  const report = await db.createReport({
    environment: runtimeEnvironment(),
    lead_id: lead.id,
    type: REPORT_TYPE,
    status: 'generating',
    input_data: {
      ...input,
      report_date: reportDate instanceof Date ? reportDate.toISOString() : new Date(reportDate).toISOString(),
      payment_status: 'testing_without_payment_gateway'
    },
    astrology_data: {
      provider: 'AstrologyAPI',
      verification: source.verification,
      source_context: source.context.astrology
    },
    ai_insights: {
      deterministic_numerology: source.deterministic_numerology,
      dominant_planets: source.dominant_planets,
      double_confirmation: source.double_confirmation,
      workflow: reportJson.workflow
    },
    report_json: reportJson,
    ai_report: '',
    generated_by: getModel(),
    pdf_url: '',
    report_contract_version: REPORT_CONTRACT_VERSION,
    calculation_contract_version: CALCULATION_CONTRACT_VERSION,
    prompt_version: PROMPT_VERSION,
    knowledge_version: 'client-master-prompt-reference-v1',
    pdf_template_version: PDF_TEMPLATE_VERSION
  });

  if (!report?.id) throw new Error('Personal Life Blueprint report record was not created');

  return {
    lead_id: lead.id,
    report_id: report.id,
    status: report.status,
    workflow: reportJson.workflow,
    verification: source.verification
  };
}

function completedAudit(response, stage, durationMs = null) {
  return {
    stage,
    response_id: response.response_id,
    status: response.status,
    usage: response.usage,
    duration_ms: durationMs,
    completed_at: now()
  };
}

async function failReport(report, reportJson, message, details = {}) {
  const failure = {
    message: String(message || 'Unknown Personal Life Blueprint failure'),
    ...details,
    failed_at: now()
  };
  reportJson.workflow = {
    ...reportJson.workflow,
    status: 'failed',
    response_status: 'failed',
    failure,
    updated_at: now()
  };
  await db.updateReport(report.id, {
    status: 'failed',
    failure_code: details.code || 'PERSONAL_BLUEPRINT_GENERATION_FAILED',
    failure_message: failure.message,
    report_json: reportJson,
    ai_insights: {
      ...(report.ai_insights || {}),
      workflow: reportJson.workflow
    }
  });
  return { status: 'failed', failure, report_id: report.id };
}

async function advancePersonalLifeBlueprint(reportId) {
  const report = await findReport(reportId);
  if (!report) throw Object.assign(new Error('Personal Life Blueprint report not found'), { status: 404 });
  if (report.type !== REPORT_TYPE) throw Object.assign(new Error('Report is not a Personal Life Blueprint V2 report'), { status: 400 });

  const reportJson = report.report_json || {};
  const workflow = reportJson.workflow || {};
  if (report.status === 'completed' || workflow.status === 'completed') {
    return {
      report_id: report.id,
      status: 'completed',
      workflow,
      document: reportJson.document,
      stages: reportJson.stages
    };
  }
  if (report.status === 'failed' || workflow.status === 'failed') {
    return { report_id: report.id, status: 'failed', workflow };
  }
  if (!workflow.response_id || !workflow.current_stage) {
    return failReport(report, reportJson, 'The generation workflow is missing its active OpenAI response.', {
      code: 'MISSING_ACTIVE_RESPONSE'
    });
  }

  let response;
  try {
    response = await getResponse(workflow.response_id);
  } catch (error) {
    throw Object.assign(error, { status: error.status || 502 });
  }

  if (['queued', 'in_progress'].includes(response.status)) {
    const nextWorkflow = {
      ...workflow,
      response_status: response.status,
      updated_at: now()
    };
    await db.updateReport(report.id, {
      report_json: { ...reportJson, workflow: nextWorkflow },
      ai_insights: { ...(report.ai_insights || {}), workflow: nextWorkflow }
    });
    return {
      report_id: report.id,
      status: 'generating',
      workflow: nextWorkflow
    };
  }

  if (response.status !== 'completed' || !response.output) {
    return failReport(report, reportJson, response.error?.message || `OpenAI Stage ${workflow.current_stage} ended with status ${response.status}.`, {
      code: 'OPENAI_STAGE_FAILED',
      response_id: response.response_id,
      incomplete_details: response.incomplete_details || null
    });
  }

  const stages = { ...(reportJson.stages || {}), [workflow.current_stage]: response.output };
  const stageAudit = [
    ...(reportJson.stage_audit || []),
    completedAudit(response, workflow.current_stage)
  ];
  const currentIndex = STAGES.indexOf(workflow.current_stage);
  const nextStage = STAGES[currentIndex + 1] || null;

  if (nextStage) {
    const background = await generateStage(nextStage, reportJson.source_context, stages, {
      background: true,
      maxOutputTokens: 14000,
      reasoningEffort: 'none'
    });
    if (!background.response_id) {
      return failReport(report, reportJson, `OpenAI did not return a background response ID for ${nextStage}.`, {
        code: 'MISSING_NEXT_RESPONSE_ID'
      });
    }

    const nextWorkflow = {
      ...workflow,
      stage_index: currentIndex + 1,
      current_stage: nextStage,
      response_id: background.response_id,
      response_status: background.status,
      updated_at: now()
    };
    const nextJson = {
      ...reportJson,
      stages,
      stage_audit: stageAudit,
      workflow: nextWorkflow
    };
    await db.updateReport(report.id, {
      report_json: nextJson,
      ai_insights: { ...(report.ai_insights || {}), workflow: nextWorkflow }
    });
    return {
      report_id: report.id,
      status: 'generating',
      completed_stage: workflow.current_stage,
      workflow: nextWorkflow
    };
  }

  const document = composePersonalLifeBlueprint(stages);
  const completedWorkflow = {
    ...workflow,
    status: 'completed',
    response_status: 'completed',
    completed_at: now(),
    updated_at: now()
  };
  const completedJson = {
    ...reportJson,
    stages,
    stage_audit: stageAudit,
    document,
    workflow: completedWorkflow
  };

  await db.updateReport(report.id, {
    status: 'completed',
    completed_at: completedWorkflow.completed_at,
    report_json: completedJson,
    ai_report: document.plain_text,
    ai_insights: {
      ...(report.ai_insights || {}),
      workflow: completedWorkflow,
      stage_audit: stageAudit,
      document_character_count: document.character_count
    },
    pdf_url: '/api/reports/pdf-direct'
  });

  const lead = await db.getLead(report.lead_id);
  if (lead) await db.updateLead(lead.id, { status: 'personal_blueprint_completed' });

  return {
    report_id: report.id,
    status: 'completed',
    workflow: completedWorkflow,
    document,
    stages
  };
}

async function getPersonalLifeBlueprintStatus(reportId) {
  const report = await findReport(reportId);
  if (!report) throw Object.assign(new Error('Personal Life Blueprint report not found'), { status: 404 });
  if (report.type !== REPORT_TYPE) throw Object.assign(new Error('Report is not a Personal Life Blueprint V2 report'), { status: 400 });
  return {
    report_id: report.id,
    lead_id: report.lead_id,
    status: report.status,
    workflow: report.report_json?.workflow || null,
    document: report.status === 'completed' ? report.report_json?.document || null : null,
    stage_audit: report.report_json?.stage_audit || []
  };
}

module.exports = {
  CALCULATION_CONTRACT_VERSION,
  PDF_TEMPLATE_VERSION,
  REPORT_TYPE,
  advancePersonalLifeBlueprint,
  findReport,
  getPersonalLifeBlueprintStatus,
  runtimeEnvironment,
  startPersonalLifeBlueprint
};
