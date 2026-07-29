function renderPersonalBlueprintPreviewPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Personal Life Blueprint V2 Preview</title>
  <style>
    :root { color-scheme: dark; --panel:#1b191f; --line:#302c36; --text:#f5f0e8; --muted:#aaa3b0; --gold:#d6ad62; --ok:#80d6a3; --bad:#ff9b9b; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:radial-gradient(circle at top,#24202b 0,#111014 46%); color:var(--text); font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif; }
    main { width:min(900px,calc(100% - 32px)); margin:0 auto; padding:54px 0 80px; }
    .eyebrow { color:var(--gold); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
    h1 { margin:10px 0 12px; font-size:clamp(34px,6vw,58px); line-height:1.02; letter-spacing:-.035em; }
    .intro { max-width:720px; color:var(--muted); font-size:17px; line-height:1.65; }
    .panel { margin-top:30px; padding:24px; border:1px solid var(--line); border-radius:20px; background:rgba(27,25,31,.94); box-shadow:0 24px 80px rgba(0,0,0,.28); }
    button,a.button { appearance:none; border:0; border-radius:12px; padding:13px 18px; background:var(--gold); color:#1a1410; font-weight:800; font-size:15px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
    button[disabled] { opacity:.5; cursor:not-allowed; }
    .secondary { background:#2a2730!important; color:var(--text)!important; border:1px solid var(--line)!important; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
    .progress { height:9px; overflow:hidden; border-radius:999px; background:#2b2730; margin:22px 0 18px; }
    .bar { height:100%; width:0; background:linear-gradient(90deg,#bc8b3d,#e8ca8b); transition:width .4s ease; }
    .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:16px; }
    .stage { padding:12px 10px; border:1px solid var(--line); border-radius:12px; color:var(--muted); font-size:12px; line-height:1.35; }
    .stage.active { border-color:var(--gold); color:var(--text); }
    .stage.done { border-color:#3e7453; color:var(--ok); }
    .status { font-size:18px; font-weight:750; }
    .detail { margin-top:6px; color:var(--muted); line-height:1.55; }
    .meta { margin-top:18px; padding-top:18px; border-top:1px solid var(--line); display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .meta div { color:var(--muted); font-size:12px; }
    .meta strong { display:block; margin-top:4px; color:var(--text); font-size:15px; word-break:break-word; }
    .error { color:var(--bad); white-space:pre-wrap; }
    .success { color:var(--ok); }
    pre { max-height:420px; overflow:auto; padding:16px; border:1px solid var(--line); border-radius:14px; background:#0e0d10; color:#d9d2dd; font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre-wrap; }
    @media (max-width:680px) { .grid,.meta { grid-template-columns:1fr 1fr; } main { padding-top:32px; } .panel { padding:18px; } }
  </style>
</head>
<body>
<main>
  <div class="eyebrow">Preview environment only</div>
  <h1>Personal Life Blueprint V2</h1>
  <p class="intro">Runs the complete four-stage client-master-prompt report using verified KP data and backend numerology. It does not affect the live website or the current paid-report engine.</p>

  <section class="panel">
    <div id="status" class="status">Ready to run the full diagnostic report</div>
    <div id="detail" class="detail">One test lead and one test report will be stored in Preview Supabase for review.</div>
    <div class="progress"><div id="bar" class="bar"></div></div>
    <div class="grid">
      <div class="stage" data-stage="verification_big_picture">1. Verification and Big Picture</div>
      <div class="stage" data-stage="life_areas_one_to_three">2. Nature, Karma and Finances</div>
      <div class="stage" data-stage="life_areas_four_to_seven">3. Marriage, Health, Children and Property</div>
      <div class="stage" data-stage="remedies_audit_closing">4. Remedies, Audit and Closing</div>
    </div>
    <div class="actions">
      <button id="start">Start full diagnostic</button>
      <button id="resume" class="secondary" hidden>Resume saved run</button>
      <a id="download" class="button secondary" hidden>Download report text</a>
      <button id="clear" class="secondary" hidden>Forget browser run</button>
    </div>
    <div class="meta">
      <div>Report ID<strong id="reportId">Not started</strong></div>
      <div>Current stage<strong id="currentStage">Not started</strong></div>
      <div>Completed stages<strong id="completedStages">0 / 4</strong></div>
    </div>
    <p id="error" class="error"></p>
    <pre id="result" hidden></pre>
  </section>
</main>
<script>
(() => {
  const stages = ['verification_big_picture','life_areas_one_to_three','life_areas_four_to_seven','remedies_audit_closing'];
  const key = 'divya_personal_blueprint_preview_report_id';
  const ids = ['status','detail','bar','start','resume','download','clear','reportId','currentStage','completedStages','error','result'];
  const els = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  let reportId = localStorage.getItem(key) || '';
  let busy = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const label = value => String(value || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());

  function completedCount(workflow = {}) {
    if (workflow.status === 'completed') return 4;
    const index = Number(workflow.stage_index);
    return Number.isFinite(index) ? Math.max(0, Math.min(index, 3)) : 0;
  }

  function paint(workflow = {}) {
    const completed = completedCount(workflow);
    els.reportId.textContent = reportId || 'Not started';
    els.currentStage.textContent = workflow.current_stage ? label(workflow.current_stage) : label(workflow.status || 'Not started');
    els.completedStages.textContent = completed + ' / 4';
    els.bar.style.width = ((completed / 4) * 100) + '%';
    document.querySelectorAll('.stage').forEach((node, index) => {
      node.classList.toggle('done', index < completed || workflow.status === 'completed');
      node.classList.toggle('active', node.dataset.stage === workflow.current_stage && workflow.status !== 'completed');
    });
  }

  async function jsonFetch(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || 'Invalid JSON response' }; }
    if (!response.ok || data.success === false) throw new Error(data.error || 'Request failed');
    return data;
  }

  function setBusy(value) {
    busy = value;
    els.start.disabled = value;
    els.resume.disabled = value;
  }

  async function start() {
    if (busy) return;
    setBusy(true);
    els.error.textContent = '';
    els.status.classList.remove('success');
    els.status.textContent = 'Verifying source data and starting Stage 1';
    els.detail.textContent = 'Please keep this tab open. The workflow is resumable even if you close it.';
    try {
      const data = await jsonFetch('/api/reports/personal-life-blueprint-v2/diagnostic-start');
      reportId = data.report_id;
      localStorage.setItem(key, reportId);
      els.start.hidden = true;
      els.clear.hidden = false;
      paint(data.workflow || {});
    } catch (error) {
      els.status.textContent = 'Could not start the report';
      els.error.textContent = error.message;
      setBusy(false);
      return;
    }
    setBusy(false);
    await drive();
  }

  async function drive() {
    if (!reportId || busy) return;
    setBusy(true);
    els.resume.hidden = true;
    els.clear.hidden = false;
    els.error.textContent = '';
    try {
      while (true) {
        const url = '/api/reports/personal-life-blueprint-v2/' + encodeURIComponent(reportId) + '/advance';
        const data = await jsonFetch(url);
        paint(data.workflow || {});

        if (data.status === 'completed') {
          els.status.textContent = 'Full diagnostic report completed';
          els.status.classList.add('success');
          els.detail.textContent = 'All four stages passed and the final document was composed.';
          els.bar.style.width = '100%';
          els.completedStages.textContent = '4 / 4';
          els.download.href = '/api/reports/personal-life-blueprint-v2/' + encodeURIComponent(reportId) + '/document.txt';
          els.download.hidden = false;
          els.result.hidden = false;
          els.result.textContent = JSON.stringify({
            workflow: data.workflow,
            document: data.document ? {
              character_count: data.document.character_count,
              section_count: data.document.section_count
            } : null
          }, null, 2);
          break;
        }

        if (data.status === 'failed') {
          throw new Error(data.failure?.message || data.workflow?.failure?.message || 'Generation failed');
        }

        const current = data.workflow?.current_stage ? label(data.workflow.current_stage) : 'next stage';
        els.status.textContent = 'Generating ' + current;
        els.detail.textContent = 'OpenAI status: ' + (data.workflow?.response_status || 'working') + '. This page will check again automatically.';
        await sleep(12000);
      }
    } catch (error) {
      els.status.textContent = 'Generation paused';
      els.detail.textContent = 'The saved run can be resumed without restarting completed stages.';
      els.error.textContent = error.message;
      els.resume.hidden = false;
    } finally {
      setBusy(false);
    }
  }

  function clearRun() {
    localStorage.removeItem(key);
    reportId = '';
    location.reload();
  }

  els.start.addEventListener('click', start);
  els.resume.addEventListener('click', drive);
  els.clear.addEventListener('click', clearRun);

  if (reportId) {
    els.start.hidden = true;
    els.resume.hidden = false;
    els.clear.hidden = false;
    els.reportId.textContent = reportId;
    els.status.textContent = 'A saved Preview run was found';
    els.detail.textContent = 'Resume it to continue from the last completed stage.';
  }
})();
</script>
</body>
</html>`;
}

module.exports = { renderPersonalBlueprintPreviewPage };
