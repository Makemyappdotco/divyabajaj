const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const API_BASE = 'https://public-api.gamma.app/v1.0';
const STORAGE_BUCKET = 'paid-reports';

function gammaConfigured() {
  return Boolean(process.env.GAMMA_API_KEY);
}

function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function gammaRequest(path, { method = 'GET', body = null, timeoutMs = 45000 } = {}) {
  if (!gammaConfigured()) {
    throw Object.assign(new Error('Gamma API is not configured. Add GAMMA_API_KEY to the Preview environment.'), {
      status: 503,
      code: 'GAMMA_NOT_CONFIGURED'
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.GAMMA_API_KEY
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

    if (!response.ok) {
      const message = data.message || data.error || data.detail || `Gamma API request failed with HTTP ${response.status}`;
      throw Object.assign(new Error(String(message)), {
        status: response.status,
        code: response.status === 402 ? 'GAMMA_CREDITS_EXHAUSTED' : 'GAMMA_API_ERROR',
        details: data
      });
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('Gamma API request timed out.'), { status: 504, code: 'GAMMA_TIMEOUT' });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function listThemes() {
  return gammaRequest('/themes');
}

async function startGeneration(payload) {
  return gammaRequest('/generations', { method: 'POST', body: payload, timeoutMs: 60000 });
}

async function getGeneration(generationId) {
  return gammaRequest(`/generations/${encodeURIComponent(generationId)}`);
}

async function downloadExport(exportUrl) {
  if (!/^https:\/\//i.test(String(exportUrl || ''))) throw new Error('Gamma export URL is invalid.');
  const response = await fetch(exportUrl);
  if (!response.ok) throw Object.assign(new Error(`Gamma PDF download failed with HTTP ${response.status}`), { status: 502 });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function persistGammaPdf({ reportId, generationId, variant, pdfBuffer }) {
  const supabase = storageClient();
  if (!supabase) throw Object.assign(new Error('Supabase storage is not configured.'), { status: 503 });
  if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) throw new Error('Gamma PDF buffer is empty.');

  const safeVariant = String(variant || 'sample').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const storagePath = `preview/${reportId}/gamma/${safeVariant}-${generationId}.pdf`;
  const upload = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: true
  });
  if (upload.error) throw new Error(`Gamma PDF storage failed: ${upload.error.message}`);

  const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  const documentId = `doc_${crypto.randomBytes(8).toString('hex')}`;
  const insert = await supabase.from('generated_documents').insert({
    id: documentId,
    report_id: reportId,
    report_version_id: null,
    document_type: 'pdf',
    template_version: `gamma-${safeVariant}-v1`,
    storage_bucket: STORAGE_BUCKET,
    storage_path: storagePath,
    checksum_sha256: checksum,
    byte_size: pdfBuffer.length,
    status: 'completed'
  });
  if (insert.error) throw new Error(`Generated document record failed: ${insert.error.message}`);

  return {
    document_id: documentId,
    storage_bucket: STORAGE_BUCKET,
    storage_path: storagePath,
    checksum_sha256: checksum,
    byte_size: pdfBuffer.length
  };
}

async function createSignedPdfUrl(storagePath, expiresIn = 3600) {
  const supabase = storageClient();
  if (!supabase) throw Object.assign(new Error('Supabase storage is not configured.'), { status: 503 });
  const result = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, expiresIn);
  if (result.error || !result.data?.signedUrl) throw new Error(`Signed PDF URL failed: ${result.error?.message || 'unknown error'}`);
  return result.data.signedUrl;
}

module.exports = {
  API_BASE,
  STORAGE_BUCKET,
  createSignedPdfUrl,
  downloadExport,
  gammaConfigured,
  getGeneration,
  listThemes,
  persistGammaPdf,
  startGeneration
};