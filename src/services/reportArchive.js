const crypto = require('crypto');
const db = require('../database');
const { generateReportPdf } = require('./pdf');

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

function isPaid(report = {}) {
  return String(report.type || '').toLowerCase().includes('paid');
}

function environmentOf(report = {}) {
  return String(report.environment || report.input_data?.environment || process.env.VERCEL_ENV || 'production').toLowerCase();
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'unknown';
}

function checksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function nextVersionNumber(supabase, reportId) {
  const result = await supabase
    .from('report_versions')
    .select('version_number')
    .eq('report_id', reportId)
    .order('version_number', { ascending: false })
    .limit(1);
  if (result.error) throw new Error(`Fetch report version failed: ${result.error.message}`);
  return (Number(result.data?.[0]?.version_number) || 0) + 1;
}

async function archiveReportSnapshot({ report, lead, templateVersion = 'pdfkit-archive-v1' }) {
  const supabase = db.getSupabaseClient();
  if (!supabase) {
    return {
      archived: false,
      reason: 'Persistent Supabase storage is not configured.'
    };
  }
  if (!report?.id) throw new Error('Report ID is required for archive');
  if (!lead?.id) throw new Error('Lead ID is required for archive');
  if (!String(report.ai_report || '').trim()) throw new Error('Report text is required for archive');

  const existingDocs = await db.getGeneratedDocuments({ report_id: report.id, status: 'active' });
  const existingPdf = existingDocs.find(doc => doc.document_type === 'pdf');
  if (existingPdf) {
    return { archived: true, existing: true, document: existingPdf };
  }

  const versionNumber = await nextVersionNumber(supabase, report.id);
  const versionId = id('rv');
  const now = new Date().toISOString();
  const insights = report.ai_insights || {};

  const versionRow = {
    id: versionId,
    report_id: report.id,
    version_number: versionNumber,
    status: 'completed',
    report_contract_version: insights.report_contract_version || report.report_contract_version || 'legacy',
    calculation_contract_version: insights.calculation_contract_version || report.calculation_contract_version || 'legacy',
    prompt_version: insights.prompt_version || report.prompt_version || 'legacy',
    knowledge_version: insights.knowledge_version || report.knowledge_version || 'legacy',
    model: report.generated_by || '',
    provider_versions: insights.provider_versions || {},
    input_snapshot: report.input_data || {},
    raw_source_snapshot: report.astrology_data || {},
    calculation_snapshot: report.horosoft_data || insights.numerology_data || {},
    report_document: report.report_json || insights.report_json || {},
    report_text: report.ai_report || '',
    failure_code: '',
    failure_message: '',
    created_at: now,
    completed_at: now
  };

  const versionInsert = await supabase.from('report_versions').insert(versionRow).select().single();
  if (versionInsert.error) throw new Error(`Create report version failed: ${versionInsert.error.message}`);

  const pdfBuffer = await generateReportPdf({
    lead,
    report,
    numbers: report.horosoft_data || {},
    astrologyData: report.astrology_data || null,
    reportText: report.ai_report || ''
  });

  const docId = id('doc');
  const bucket = isPaid(report) ? 'paid-reports' : 'free-reports';
  const path = [
    safeSegment(environmentOf(report)),
    safeSegment(lead.id),
    safeSegment(report.id),
    `v${versionNumber}-${docId}.pdf`
  ].join('/');

  const upload = await supabase.storage.from(bucket).upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
    cacheControl: '31536000'
  });
  if (upload.error) {
    await supabase.from('report_versions').update({
      status: 'failed',
      failure_code: 'PDF_ARCHIVE_FAILED',
      failure_message: upload.error.message
    }).eq('id', versionId);
    throw new Error(`Archive PDF upload failed: ${upload.error.message}`);
  }

  const document = await db.createGeneratedDocument({
    id: docId,
    report_id: report.id,
    report_version_id: versionId,
    document_type: 'pdf',
    template_version: templateVersion,
    storage_bucket: bucket,
    storage_path: path,
    checksum_sha256: checksum(pdfBuffer),
    byte_size: pdfBuffer.length,
    status: 'active',
    created_at: now
  });

  await db.updateReport(report.id, {
    pdf_url: `/api/admin/documents/${docId}/download`,
    pdf_template_version: templateVersion,
    report_contract_version: versionRow.report_contract_version,
    calculation_contract_version: versionRow.calculation_contract_version,
    prompt_version: versionRow.prompt_version,
    knowledge_version: versionRow.knowledge_version,
    report_json: versionRow.report_document,
    completed_at: report.completed_at || now
  });

  await db.logEvent('reports.archived', 'reports', report.id, {
    report_version_id: versionId,
    document_id: docId,
    bucket,
    path,
    byte_size: pdfBuffer.length,
    checksum_sha256: document?.checksum_sha256 || checksum(pdfBuffer)
  });

  return {
    archived: true,
    existing: false,
    version: versionInsert.data,
    document
  };
}

async function getDocument(documentId) {
  const supabase = db.getSupabaseClient();
  if (!supabase) return null;
  const result = await supabase.from('generated_documents').select('*').eq('id', documentId).maybeSingle();
  if (result.error) throw new Error(`Fetch document failed: ${result.error.message}`);
  return result.data || null;
}

async function signedDocumentUrl(documentId, expiresIn = 900) {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Persistent storage is not configured');
  const document = await getDocument(documentId);
  if (!document) throw new Error('Archived document not found');
  const result = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, Math.max(60, Math.min(Number(expiresIn) || 900, 3600)));
  if (result.error) throw new Error(`Create document download URL failed: ${result.error.message}`);
  return { document, signed_url: result.data.signedUrl };
}

module.exports = { archiveReportSnapshot, getDocument, signedDocumentUrl };
