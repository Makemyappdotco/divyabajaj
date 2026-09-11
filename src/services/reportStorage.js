// Keeping the rendered PDF, instead of rebuilding it every time.
//
// This exists because of how WhatsApp attaches a document. Meta's servers
// FETCH the URL you give them, with a short timeout, and attach whatever comes
// back. Our report URL rendered the PDF on demand - fine for a browser that
// will wait, fatal here, because the paid blueprint has taken 396 and 410
// seconds to render. Meta would give up every single time and the customer
// would get a message with no attachment.
//
// So the PDF is written to Supabase Storage the moment it is generated, and
// served from there afterwards. Rendering happens once, when somebody has
// already been told to expect a wait.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BUCKETS = {
  free: process.env.SUPABASE_STORAGE_BUCKET_FREE_REPORTS || 'free-reports',
  paid: process.env.SUPABASE_STORAGE_BUCKET_PAID_REPORTS || 'paid-reports'
};

function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isConfigured() { return Boolean(storageClient()); }

function bucketFor(reportType) {
  return String(reportType || '').includes('paid') ? BUCKETS.paid : BUCKETS.free;
}

function pathFor(reportId) {
  return `reports/${reportId}.pdf`;
}

/**
 * Writes the PDF and records it.
 *
 * Never throws at its caller: a report that generated successfully must not be
 * marked failed because object storage had a bad minute. It returns null and
 * the read path falls back to rendering, which is slow but correct.
 */
async function store({ reportId, reportType, pdf, templateVersion = 'v1' }) {
  const supabase = storageClient();
  if (!supabase || !reportId || !Buffer.isBuffer(pdf) || !pdf.length) return null;

  const bucket = bucketFor(reportType);
  const storagePath = pathFor(reportId);

  try {
    const upload = await supabase.storage.from(bucket).upload(storagePath, pdf, {
      contentType: 'application/pdf',
      cacheControl: '86400',
      // A regenerated report replaces the old file rather than piling up.
      upsert: true
    });
    if (upload.error) throw new Error(upload.error.message);

    const checksum = crypto.createHash('sha256').update(pdf).digest('hex');
    await supabase.from('generated_documents').insert({
      id: `doc_${crypto.randomBytes(8).toString('hex')}`,
      report_id: reportId,
      document_type: 'pdf',
      template_version: templateVersion,
      storage_bucket: bucket,
      storage_path: storagePath,
      checksum_sha256: checksum,
      byte_size: pdf.length,
      status: 'completed'
    });

    return { bucket, path: storagePath, bytes: pdf.length, checksum };
  } catch (error) {
    console.error('[reportStorage] could not store the PDF:', error.message);
    return null;
  }
}

/** The stored bytes, or null if there are none. */
async function fetch_({ reportId, reportType }) {
  const supabase = storageClient();
  if (!supabase || !reportId) return null;

  const bucket = bucketFor(reportType);
  try {
    const { data, error } = await supabase.storage.from(bucket).download(pathFor(reportId));
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    return null;
  }
}

/**
 * A URL Meta can fetch directly, valid for a while.
 *
 * Signed rather than public: the bucket holds people's birth charts, and a
 * public bucket makes every report guessable. The signature is long enough for
 * WhatsApp to collect the file and short enough that a forwarded link dies.
 */
async function signedUrl({ reportId, reportType, expiresInSeconds = 60 * 60 * 24 * 7 }) {
  const supabase = storageClient();
  if (!supabase || !reportId) return null;

  const bucket = bucketFor(reportType);
  try {
    const { data, error } = await supabase.storage
      .from(bucket).createSignedUrl(pathFor(reportId), expiresInSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  } catch (error) {
    console.error('[reportStorage] could not sign a URL:', error.message);
    return null;
  }
}

async function exists({ reportId, reportType }) {
  return Boolean(await signedUrl({ reportId, reportType, expiresInSeconds: 60 }));
}

module.exports = { store, fetch: fetch_, signedUrl, exists, isConfigured, bucketFor, pathFor, BUCKETS };
