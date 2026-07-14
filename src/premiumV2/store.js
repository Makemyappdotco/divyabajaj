const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

let client;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Premium v2 requires SUPABASE_URL and a service-role or secret key');
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

async function createRun(input) {
  const supabase = getClient();
  const row = {
    public_token: token(),
    status: 'queued',
    stage: 'facts',
    current_page: 0,
    retry_count: 0,
    input_json: input,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('report_runs').insert(row).select('*').single();
  if (error) throw new Error(`Could not create premium report run: ${error.message}`);
  return data;
}

async function getRun(id) {
  const { data, error } = await getClient().from('report_runs').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not read premium report run: ${error.message}`);
  return data;
}

async function getRunByPublicToken(id, publicToken) {
  const { data, error } = await getClient().from('report_runs').select('*').eq('id', id).eq('public_token', publicToken).maybeSingle();
  if (error) throw new Error(`Could not read premium report run: ${error.message}`);
  return data;
}

async function updateRun(id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await getClient().from('report_runs').update(payload).eq('id', id).select('*').single();
  if (error) throw new Error(`Could not update premium report run: ${error.message}`);
  return data;
}

async function upsertPage(runId, pageNumber, values) {
  const payload = {
    run_id: runId,
    page_number: pageNumber,
    ...values,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await getClient()
    .from('report_pages')
    .upsert(payload, { onConflict: 'run_id,page_number' })
    .select('*')
    .single();
  if (error) throw new Error(`Could not save page ${pageNumber}: ${error.message}`);
  return data;
}

async function getPage(runId, pageNumber) {
  const { data, error } = await getClient().from('report_pages').select('*').eq('run_id', runId).eq('page_number', pageNumber).maybeSingle();
  if (error) throw new Error(`Could not read page ${pageNumber}: ${error.message}`);
  return data;
}

async function getPages(runId) {
  const { data, error } = await getClient().from('report_pages').select('*').eq('run_id', runId).order('page_number', { ascending: true });
  if (error) throw new Error(`Could not read premium report pages: ${error.message}`);
  return data || [];
}

async function uploadBuffer({ bucket = 'premium-reports', path, buffer, contentType, upsert = true }) {
  const supabase = getClient();
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert });
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
