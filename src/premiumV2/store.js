const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const db = require('../database');

let client;
let bucketReady = false;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Premium v2 requires durable Supabase storage. SUPABASE_URL and a service-role or secret key are required.');
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

function safeName(value) {
  return String(value || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
}

function now() {
  return new Date().toISOString();
}

function premiumState(row) {
  return row?.ai_insights?.premium_v2 || {};
}

function normalizeRun(row) {
  if (!row) return null;
  const inputData = row.input_data || {};
  const state = premiumState(row);
  return {
    id: row.id,
    public_token: inputData.public_token || '',
    lead_id: row.lead_id,
    report_id: row.id,
    status: row.status,
    stage: inputData.stage || state.stage || 'facts',
    current_page: Number(inputData.current_page || state.current_page || 0),
    retry_count: Number(inputData.retry_count || state.retry_count || 0),
    input_json: inputData.payload || {},
    fact_ledger: state.fact_ledger || null,
    master_interpretation: state.master_interpretation || null,
    page_content: state.page_content || null,
    layout_plan: state.layout_plan || null,
    content_qa: state.content_qa || null,
    geometry_qa: state.geometry_qa || null,
    visual_qa_summary: state.visual_qa_summary || null,
    final_pdf_path: row.pdf_url || inputData.final_pdf_path || '',
    error_message: inputData.error_message || state.error_message || '',
    started_at: inputData.started_at || row.created_at,
    completed_at: inputData.completed_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    generated_by: row.generated_by || ''
  };
}

async function rawReport(id) {
  const { data, error } = await getClient().from('reports').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not read premium report run: ${error.message}`);
  return data;
}

async function createOrUpdateLead(input) {
  const matches = await db.getLeads({ search: input.phone });
  const exact = matches.find(item => String(item.phone || '').trim() === String(input.phone || '').trim());
  const leadData = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    dob: input.dob,
    tob: input.tob,
    pob: input.pob,
    question: input.question || '',
    source: input.source || 'premium_v2_test',
    status: 'premium_v2_queued',
    tier: 'premium_blueprint_v2'
  };
  return exact ? db.updateLead(exact.id, leadData) : db.createLead(leadData);
}

async function createRun(input) {
  if (!db.usingSupabase()) throw new Error('Premium v2 will not use temporary local storage. Connect Supabase before generating this report.');
  const publicToken = token();
  const lead = await createOrUpdateLead(input);
  const report = await db.createReport({
    lead_id: lead.id,
    type: 'premium_blueprint_v2',
    status: 'queued',
    input_data: {
      public_token: publicToken,
      payload: input,
      stage: 'facts',
      current_page: 0,
      retry_count: 0,
      started_at: now(),
      completed_at: null,
      error_message: ''
    },
    horosoft_data: null,
    astrology_data: null,
    ai_report: '',
    ai_insights: {
      premium_v2: {
        version: 'premium-report-v2',
        pages: {},
        stage: 'facts',
        current_page: 0,
        retry_count: 0
      }
    },
    generated_by: '',
    pdf_url: ''
  });
  return normalizeRun(report);
}

async function getRun(id) {
  return normalizeRun(await rawReport(id));
}

async function getRunByPublicToken(id, publicToken) {
  const run = await getRun(id);
  if (!run || !publicToken || run.public_token !== publicToken) return null;
  return run;
}

async function updateRun(id, updates) {
  const current = await rawReport(id);
  if (!current) throw new Error('Premium report run not found');

  const currentInput = current.input_data || {};
  const currentInsights = current.ai_insights || {};
  const currentPremium = currentInsights.premium_v2 || {};

  const inputData = {
    ...currentInput,
    ...(updates.stage !== undefined ? { stage: updates.stage } : {}),
    ...(updates.current_page !== undefined ? { current_page: updates.current_page } : {}),
    ...(updates.retry_count !== undefined ? { retry_count: updates.retry_count } : {}),
    ...(updates.final_pdf_path !== undefined ? { final_pdf_path: updates.final_pdf_path } : {}),
    ...(updates.error_message !== undefined ? { error_message: updates.error_message } : {}),
    ...(updates.started_at !== undefined ? { started_at: updates.started_at } : {}),
    ...(updates.completed_at !== undefined ? { completed_at: updates.completed_at } : {})
  };

  const nextPremium = {
    ...currentPremium,
    ...(updates.stage !== undefined ? { stage: updates.stage } : {}),
    ...(updates.current_page !== undefined ? { current_page: updates.current_page } : {}),
    ...(updates.retry_count !== undefined ? { retry_count: updates.retry_count } : {}),
    ...(updates.fact_ledger !== undefined ? { fact_ledger: updates.fact_ledger } : {}),
    ...(updates.master_interpretation !== undefined ? { master_interpretation: updates.master_interpretation } : {}),
    ...(updates.page_content !== undefined ? { page_content: updates.page_content } : {}),
    ...(updates.layout_plan !== undefined ? { layout_plan: updates.layout_plan } : {}),
    ...(updates.content_qa !== undefined ? { content_qa: updates.content_qa } : {}),
    ...(updates.geometry_qa !== undefined ? { geometry_qa: updates.geometry_qa } : {}),
    ...(updates.visual_qa_summary !== undefined ? { visual_qa_summary: updates.visual_qa_summary } : {}),
    ...(updates.error_message !== undefined ? { error_message: updates.error_message } : {})
  };

  const reportUpdates = {
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    input_data: inputData,
    ai_insights: { ...currentInsights, premium_v2: nextPremium },
    ...(updates.fact_ledger !== undefined ? { horosoft_data: updates.fact_ledger?.numerology || null, astrology_data: updates.fact_ledger?.astrology || null } : {}),
    ...(updates.master_interpretation !== undefined ? { ai_report: JSON.stringify(updates.master_interpretation) } : {}),
    ...(updates.generated_by !== undefined ? { generated_by: updates.generated_by } : {}),
    ...(updates.final_pdf_path !== undefined ? { pdf_url: updates.final_pdf_path } : {})
  };

  const updated = await db.updateReport(id, reportUpdates);
  return normalizeRun(updated);
}

async function upsertPage(runId, pageNumber, values) {
  const current = await rawReport(runId);
  if (!current) throw new Error('Premium report run not found');
  const insights = current.ai_insights || {};
  const premium = insights.premium_v2 || {};
  const pages = { ...(premium.pages || {}) };
  const key = String(pageNumber);
  pages[key] = {
    ...(pages[key] || {}),
    page_number: pageNumber,
    ...values,
    updated_at: now()
  };
  await db.updateReport(runId, {
    ai_insights: {
      ...insights,
      premium_v2: {
        ...premium,
        pages
      }
    }
  });
  return pages[key];
}

async function getPage(runId, pageNumber) {
  const current = await rawReport(runId);
  return current?.ai_insights?.premium_v2?.pages?.[String(pageNumber)] || null;
}

async function getPages(runId) {
  const current = await rawReport(runId);
  const pages = current?.ai_insights?.premium_v2?.pages || {};
  return Object.values(pages).sort((a, b) => Number(a.page_number) - Number(b.page_number));
}

async function ensureBucket() {
  if (bucketReady) return;
  const supabase = getClient();
  const { data, error } = await supabase.storage.getBucket('premium-reports');
  if (!data) {
    const created = await supabase.storage.createBucket('premium-reports', { public: false });
    if (created.error && !String(created.error.message || '').toLowerCase().includes('already exists')) {
      throw new Error(`Could not create premium-reports storage bucket: ${created.error.message}`);
    }
  } else if (error && !String(error.message || '').toLowerCase().includes('not found')) {
    throw new Error(`Could not inspect premium-reports storage bucket: ${error.message}`);
  }
  bucketReady = true;
}

async function uploadBuffer({ path, buffer, contentType, upsert = true }) {
  await ensureBucket();
  const { error } = await getClient().storage.from('premium-reports').upload(path, buffer, { contentType, upsert });
  if (error) throw new Error(`Could not upload ${path}: ${error.message}`);
  return path;
}

async function uploadPreview(runId, pageNumber, buffer) {
  return uploadBuffer({
    path: `${runId}/previews/page-${String(pageNumber).padStart(2, '0')}.png`,
    buffer,
    contentType: 'image/png'
  });
}

async function uploadFinalPdf(run, buffer) {
  const name = safeName(run.input_json?.name);
  const path = `${run.id}/final/${name}-full-blueprint.pdf`;
  await uploadBuffer({ path, buffer, contentType: 'application/pdf' });
  return path;
}

async function createSignedUrl(path, expiresIn = 3600) {
  await ensureBucket();
  const { data, error } = await getClient().storage.from('premium-reports').createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Could not create signed report URL: ${error.message}`);
  return data.signedUrl;
}

module.exports = {
  getClient,
  createRun,
  getRun,
  getRunByPublicToken,
  updateRun,
  upsertPage,
  getPage,
  getPages,
  uploadPreview,
  uploadFinalPdf,
  createSignedUrl
};
