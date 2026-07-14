const express = require('express');
const store = require('./store');
const { runWorkerStage } = require('./worker');

const router = express.Router();

let vercelWaitUntil;
try {
  ({ waitUntil: vercelWaitUntil } = require('@vercel/functions'));
} catch (error) {
  vercelWaitUntil = null;
}

function background(promise) {
  const guarded = Promise.resolve(promise).catch(error => console.error('[Premium v2 background task]', error));
  if (vercelWaitUntil) vercelWaitUntil(guarded);
  else guarded.catch(() => {});
}

function requestBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'https';
  return `${protocol}://${req.get('host')}`;
}

function requiredFields(body) {
  return ['name', 'email', 'phone', 'dob', 'tob', 'pob'].filter(key => !String(body?.[key] || '').trim());
}

function progressFor(run) {
  if (!run) return 0;
  if (run.status === 'ready') return 100;
  if (run.status === 'failed') return 100;
  if (run.stage === 'facts') return 5;
  if (run.stage === 'content') return 15;
  if (run.stage === 'render') return 35;
  if (run.stage === 'visual_qa') return Math.min(92, 40 + Math.round((Number(run.current_page || 1) - 1) / 14 * 50));
  if (run.stage === 'finalise') return 95;
  return 2;
}

async function continueRun({ runId, publicToken, baseUrl }) {
  const run = await store.getRun(runId);
  if (!run || run.public_token !== publicToken) return;
  if (['ready', 'failed', 'cancelled'].includes(run.status)) return;

  await runWorkerStage(runId);
  const updated = await store.getRun(runId);
  if (!updated || ['ready', 'failed', 'cancelled'].includes(updated.status)) return;

  const response = await fetch(`${baseUrl}/api/premium-v2/jobs/${runId}/worker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-premium-worker-token': publicToken
    },
    body: '{}'
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Could not schedule next premium v2 stage: ${response.status} ${body}`);
  }
}

router.post('/premium-v2/jobs', async (req, res) => {
  try {
    const payload = {
      name: String(req.body?.name || '').trim(),
      email: String(req.body?.email || '').trim(),
      phone: String(req.body?.phone || '').trim(),
      dob: String(req.body?.dob || '').trim(),
      tob: String(req.body?.tob || '').trim(),
      pob: String(req.body?.pob || '').trim(),
      question: String(req.body?.question || '').trim(),
      source: String(req.body?.source || 'premium_v2_test').trim(),
      requested_at: new Date().toISOString()
    };

    const missing = requiredFields(payload);
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
    }

    const run = await store.createRun(payload);
    const baseUrl = requestBaseUrl(req);
    background(continueRun({ runId: run.id, publicToken: run.public_token, baseUrl }));

    return res.status(202).json({
      success: true,
      version: 'premium-report-v2',
      job_id: run.id,
      job_token: run.public_token,
      status: run.status,
      stage: run.stage,
      progress: progressFor(run),
      status_url: `/api/premium-v2/jobs/${run.id}?token=${run.public_token}`
    });
  } catch (error) {
    console.error('[Create premium v2 job]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not create premium report job' });
  }
});

router.post('/premium-v2/jobs/:id/worker', async (req, res) => {
  try {
    const run = await store.getRun(req.params.id);
    const token = String(req.headers['x-premium-worker-token'] || '');
    if (!run || !token || token !== run.public_token) return res.status(404).json({ success: false, error: 'Job not found' });

    if (['ready', 'failed', 'cancelled'].includes(run.status)) {
      return res.json({ success: true, terminal: true, status: run.status, stage: run.stage });
    }

    const baseUrl = requestBaseUrl(req);
    background(continueRun({ runId: run.id, publicToken: run.public_token, baseUrl }));
    return res.status(202).json({ success: true, accepted: true, status: run.status, stage: run.stage });
  } catch (error) {
    console.error('[Premium v2 worker route]', error);
    return res.status(500).json({ success: false, error: error.message || 'Premium report worker failed' });
  }
});

router.get('/premium-v2/jobs/:id', async (req, res) => {
  try {
    const token = String(req.query.token || req.headers['x-report-token'] || '');
    const run = await store.getRunByPublicToken(req.params.id, token);
    if (!run) return res.status(404).json({ success: false, error: 'Job not found' });

    let downloadUrl = null;
    if (run.status === 'ready' && run.final_pdf_path) {
      downloadUrl = await store.createSignedUrl(run.final_pdf_path, 3600);
    }

    return res.json({
      success: true,
      version: 'premium-report-v2',
      job_id: run.id,
      status: run.status,
      stage: run.stage,
      current_page: run.current_page,
      progress: progressFor(run),
      qa: run.visual_qa_summary,
      download_url: downloadUrl,
      error: run.status === 'failed' ? run.error_message : null,
      created_at: run.created_at,
      completed_at: run.completed_at
    });
  } catch (error) {
    console.error('[Premium v2 status route]', error);
    return res.status(500).json({ success: false, error: error.message || 'Could not read premium report status' });
  }
});

module.exports = router;
