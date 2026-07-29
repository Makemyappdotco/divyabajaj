const db = require('../database');
const { additionalInstructions, buildGammaCards } = require('./personalBlueprintGammaContent');
const {
  createSignedPdfUrl,
  downloadExport,
  gammaConfigured,
  getGeneration,
  listThemes,
  persistGammaPdf,
  startGeneration
} = require('./gammaApi');

function now() {
  return new Date().toISOString();
}

function normaliseVariant(value) {
  return String(value || '').toLowerCase() === 'modern' ? 'modern' : 'editorial';
}

async function findReport(reportId) {
  const rows = await db.getReports({});
  return rows.find(row => row.id === reportId) || null;
}

function logoHeader() {
  const custom = String(process.env.DIVYA_BAJAJ_LOGO_URL || '').trim();
  if (custom) return { type: 'image', source: 'custom', src: custom, size: 'sm' };
  return { type: 'image', source: 'themeLogo', size: 'sm' };
}

function generationPayload({ content, variant, themeId }) {
  const payload = {
    inputText: content.input_text,
    textMode: 'preserve',
    format: 'document',
    cardSplit: 'inputTextBreaks',
    additionalInstructions: additionalInstructions(variant),
    imageOptions: { source: 'noImages' },
    cardOptions: {
      dimensions: 'a4',
      headerFooter: {
        topLeft: logoHeader(),
        topRight: { type: 'text', value: 'PERSONAL LIFE BLUEPRINT', size: 'sm' },
        bottomLeft: { type: 'text', value: content.client_name, size: 'sm' },
        bottomCenter: { type: 'text', value: 'Private personalised report', size: 'sm' },
        bottomRight: { type: 'cardNumber' },
        hideFromFirstCard: true,
        hideFromLastCard: false
      }
    },
    sharingOptions: {
      workspaceAccess: 'view',
      externalAccess: 'noAccess'
    },
    exportAs: 'pdf'
  };
  const selectedTheme = String(themeId || process.env.GAMMA_THEME_ID || '').trim();
  if (selectedTheme) payload.themeId = selectedTheme;
  const folderId = String(process.env.GAMMA_FOLDER_ID || '').trim();
  if (folderId) payload.folderIds = [folderId];
  return payload;
}

function sampleState(report, variant) {
  return report?.report_json?.gamma_samples?.[variant] || null;
}

async function updateSample(report, variant, patch) {
  const reportJson = report.report_json || {};
  const gammaSamples = { ...(reportJson.gamma_samples || {}) };
  gammaSamples[variant] = {
    ...(gammaSamples[variant] || {}),
    ...patch,
    updated_at: now()
  };
  const nextJson = { ...reportJson, gamma_samples: gammaSamples };
  const updated = await db.updateReport(report.id, {
    report_json: nextJson,
    pdf_template_version: 'gamma-personal-life-blueprint-v1'
  });
  return updated?.report_json?.gamma_samples?.[variant] || gammaSamples[variant];
}

async function gammaConfig() {
  return {
    configured: gammaConfigured(),
    theme_id: process.env.GAMMA_THEME_ID || '',
    folder_id: process.env.GAMMA_FOLDER_ID || '',
    custom_logo_url_configured: Boolean(process.env.DIVYA_BAJAJ_LOGO_URL),
    header_logo_source: process.env.DIVYA_BAJAJ_LOGO_URL ? 'custom' : 'themeLogo',
    consultation_url: process.env.CONSULTATION_BOOKING_URL || 'https://divyabajaj.vercel.app/book-consultation'
  };
}

async function availableThemes() {
  return listThemes();
}

async function startGammaSample(reportId, { variant = 'editorial', themeId = '' } = {}) {
  const selectedVariant = normaliseVariant(variant);
  const report = await findReport(reportId);
  if (!report) throw Object.assign(new Error('Paid report not found.'), { status: 404 });
  if (report.status !== 'completed' || !report.report_json?.stages) {
    throw Object.assign(new Error('The paid report must be completed before Gamma rendering starts.'), { status: 409 });
  }
  const lead = await db.getLead(report.lead_id);
  if (!lead) throw Object.assign(new Error('Report lead not found.'), { status: 404 });

  const existing = sampleState(report, selectedVariant);
  if (existing && ['pending', 'working', 'completed'].includes(existing.status)) {
    return { report_id: report.id, variant: selectedVariant, sample: existing, reused: true };
  }

  const content = buildGammaCards(report, lead, selectedVariant);
  const payload = generationPayload({ content, variant: selectedVariant, themeId });
  const started = await startGeneration(payload);
  if (!started.generationId) throw new Error('Gamma did not return a generation ID.');

  const sample = await updateSample(report, selectedVariant, {
    status: 'pending',
    generation_id: started.generationId,
    warnings: started.warnings || '',
    theme_id: payload.themeId || '',
    card_count: content.card_count,
    gamma_url: '',
    export_url: '',
    credits: null,
    storage_path: '',
    document_id: '',
    error: '',
    started_at: now()
  });
  return { report_id: report.id, variant: selectedVariant, sample, reused: false };
}

async function refreshGammaSample(reportId, variant = 'editorial') {
  const selectedVariant = normaliseVariant(variant);
  let report = await findReport(reportId);
  if (!report) throw Object.assign(new Error('Paid report not found.'), { status: 404 });
  let sample = sampleState(report, selectedVariant);
  if (!sample?.generation_id) throw Object.assign(new Error('Gamma sample has not been started.'), { status: 404 });
  if (sample.status === 'completed' && sample.storage_path) {
    return { report_id: report.id, variant: selectedVariant, sample };
  }

  const generation = await getGeneration(sample.generation_id);
  const status = String(generation.status || '').toLowerCase();
  if (status === 'failed') {
    sample = await updateSample(report, selectedVariant, {
      status: 'failed',
      error: generation.error || generation.message || 'Gamma generation failed.',
      gamma_url: generation.gammaUrl || '',
      export_url: generation.exportUrl || '',
      credits: generation.credits || null,
      failed_at: now()
    });
    return { report_id: report.id, variant: selectedVariant, sample };
  }

  if (status !== 'completed') {
    sample = await updateSample(report, selectedVariant, {
      status: status || 'working',
      gamma_url: generation.gammaUrl || sample.gamma_url || '',
      export_url: generation.exportUrl || sample.export_url || '',
      credits: generation.credits || sample.credits || null
    });
    return { report_id: report.id, variant: selectedVariant, sample };
  }

  if (!generation.exportUrl) throw new Error('Gamma completed without a PDF export URL.');
  const pdfBuffer = await downloadExport(generation.exportUrl);
  const stored = await persistGammaPdf({
    reportId: report.id,
    generationId: sample.generation_id,
    variant: selectedVariant,
    pdfBuffer
  });
  report = await findReport(report.id);
  sample = await updateSample(report, selectedVariant, {
    status: 'completed',
    gamma_url: generation.gammaUrl || '',
    export_url: generation.exportUrl,
    credits: generation.credits || null,
    storage_path: stored.storage_path,
    document_id: stored.document_id,
    checksum_sha256: stored.checksum_sha256,
    byte_size: stored.byte_size,
    completed_at: now(),
    error: ''
  });
  return { report_id: report.id, variant: selectedVariant, sample };
}

async function gammaSampleStatus(reportId, variant = 'editorial') {
  const selectedVariant = normaliseVariant(variant);
  const report = await findReport(reportId);
  if (!report) throw Object.assign(new Error('Paid report not found.'), { status: 404 });
  return {
    report_id: report.id,
    variant: selectedVariant,
    sample: sampleState(report, selectedVariant)
  };
}

async function gammaSamplePdfUrl(reportId, variant = 'editorial') {
  const status = await gammaSampleStatus(reportId, variant);
  if (!status.sample?.storage_path) {
    throw Object.assign(new Error('Gamma PDF is not ready yet.'), { status: 409 });
  }
  return createSignedPdfUrl(status.sample.storage_path, 3600);
}

module.exports = {
  availableThemes,
  gammaConfig,
  gammaSamplePdfUrl,
  gammaSampleStatus,
  normaliseVariant,
  refreshGammaSample,
  startGammaSample
};