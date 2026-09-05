// The Full Blueprint: validating the customer's details, generating the
// report, and saving it.
//
// Lifted out of publicPaidRoutes.js so the paid path and the old open route
// share one definition. Two copies of "what a valid birth detail looks like"
// is how a customer pays and is then told their date of birth is wrong.

const db = require('../database');
const { generatePaidReportV2 } = require('./paidReportV2');

const REPORT_TYPE = 'paid_blueprint_v2_preview';

function normalizePhone(value) { return String(value || '').replace(/\D/g, ''); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }

/** Everything the generator needs, and nothing the browser can smuggle in. */
function normalisePayload(body = {}) {
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
    include_source_pdfs: false,
    source: String(body.source || 'paid_blueprint_live').trim()
  };
}

function missingFields(body) {
  const stringFields = ['name', 'phone', 'dob', 'email', 'tob', 'pob', 'gender', 'birth_time_accuracy'];
  const missing = stringFields.filter(field => !String(body[field] || '').trim());
  ['latitude', 'longitude', 'timezone'].forEach(field => {
    if (!Number.isFinite(Number(body[field]))) missing.push(field);
  });
  return missing;
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

/** Creates or updates the lead. Called before payment so we know who is paying. */
async function upsertLead(payload, { status = 'paid_blueprint_started' } = {}) {
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
    status,
    tier: REPORT_TYPE
  };

  const lead = existing ? await db.updateLead(existing.id, leadData) : await db.createLead(leadData);
  if (!lead?.id) throw new Error('Lead record was not created');
  return lead;
}

/** The expensive part. Minutes, not seconds. */
async function generate(payload) {
  const result = await generatePaidReportV2(payload, { includePdfs: false });
  result.numbers = numbersFromV2(result);
  return result;
}

/**
 * @param {object} opts.paidWith - order and payment ids, written onto the
 * report so a report and the money that bought it are traceable to each other.
 */
async function saveGeneratedReport({ payload, result, leadId, paidWith = null, type = REPORT_TYPE }) {
  try {
    const lead = leadId
      ? { id: leadId }
      : await upsertLead(payload, { status: 'paid_test_report_generated' });

    const completedAt = new Date().toISOString();
    const report = await db.createReport({
      lead_id: lead.id,
      type,
      status: 'completed',
      completed_at: completedAt,
      report_contract_version: 'integrated-life-report-v1',
      calculation_contract_version: 'astrologyapi-kp-chaldean-v1',
      prompt_version: 'integrated-life-report-prompt-v1',
      knowledge_version: 'client-template-2026-08-21',
      pdf_template_version: 'legacy-paid-v1',
      input_data: Object.assign({}, payload, paidWith
        ? { payment_status: 'paid', order_id: paidWith.orderId || '', gateway_payment_id: paidWith.paymentId || '' }
        : { payment_status: 'testing_without_payment_gateway' }),
      horosoft_data: result.numbers || result.numerology_data || {},
      astrology_data: result.astrology_data,
      ai_report: result.report_text,
      report_json: result.report_json || null,
      ai_insights: {
        ...(result.insights || {}),
        numerology_data: result.numerology_data || null,
        source_pdfs: result.source_pdfs || null,
        generation_ms: result.generation_ms,
        report_contract_version: result.report_contract_version || ''
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

module.exports = {
  REPORT_TYPE, normalisePayload, missingFields, numbersFromV2,
  findExactLead, upsertLead, generate, saveGeneratedReport
};
