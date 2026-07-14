(function(){
  if (window.__divyaPaidFastPatch) return;
  window.__divyaPaidFastPatch = true;

  var running = false;
  var progressTimer = null;
  var pdfPayload = null;

  function qs(selector, root){ return (root || document).querySelector(selector); }
  function getModal(){ return document.getElementById('paidBlueprintModalV3'); }

  function setStatus(message, type){
    var root = getModal();
    if (!root) return;
    var box = qs('#pb3Status', root);
    if (!box) return;
    box.className = 'pb3-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setButton(loading){
    var root = getModal();
    if (!root) return;
    var button = qs('#pb3Submit', root);
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? 'PREPARING YOUR BLUEPRINT...' : 'GENERATE FULL BLUEPRINT';
  }

  function updateNote(){
    var root = getModal();
    if (!root) return;
    var note = qs('.pb3-note', root);
    if (note) note.textContent = 'Usually ready in about 45 to 90 seconds. Please keep this window open.';
  }

  function getPayload(){
    var root = getModal();
    return {
      name: qs('#pb3Name', root).value.trim(),
      email: qs('#pb3Email', root).value.trim(),
      phone: qs('#pb3Phone', root).value.trim(),
      dob: qs('#pb3Dob', root).value,
      tob: qs('#pb3Tob', root).value,
      pob: qs('#pb3Pob', root).value.trim(),
      question: qs('#pb3Question', root).value.trim(),
      source: 'paid_blueprint_fast_parallel_flow'
    };
  }

  function validate(payload){
    var labels = {
      name: 'Full Name',
      email: 'Email',
      phone: 'WhatsApp Number',
      dob: 'Date of Birth',
      tob: 'Time of Birth',
      pob: 'Place of Birth'
    };
    return ['name','email','phone','dob','tob','pob']
      .filter(function(key){ return !payload[key]; })
      .map(function(key){ return labels[key]; });
  }

  function startProgress(){
    var messages = [
      'Reading your birth details and core number patterns...',
      'Connecting your personality, career, money and relationship patterns...',
      'Building your current-year and future-direction guidance...',
      'Structuring the report into a clear, readable personal blueprint...',
      'Finalising your detailed report and action points...'
    ];
    var index = 0;
    setStatus(messages[0], '');
    clearInterval(progressTimer);
    progressTimer = setInterval(function(){
      index = Math.min(index + 1, messages.length - 1);
      setStatus(messages[index], '');
    }, 12000);
  }

  function stopProgress(){
    clearInterval(progressTimer);
    progressTimer = null;
  }

  async function fetchJson(url, options, timeoutMs){
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, timeoutMs || 180000);
    try {
      var response = await fetch(url, Object.assign({}, options || {}, {
        signal: controller.signal,
        cache: 'no-store'
      }));
      var raw = await response.text();
      var data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch (error) { data = { error: raw || 'Invalid response from server' }; }
      if (!response.ok || data.success === false) {
        throw new Error(data.error || ('Request failed with status ' + response.status));
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function showReport(data, payload){
    var root = getModal();
    pdfPayload = {
      lead: payload,
      numbers: data.numbers || {},
      astrology_data: data.astrology_data || null,
      report_text: data.report_text || '',
      report_type: 'paid_blueprint_test'
    };
    window.__paidBlueprintPdfPayload = pdfPayload;
    qs('#pb3Report', root).textContent = data.report_text || 'Report generated successfully.';
    qs('#pb3Result', root).classList.add('show');
    var seconds = data.generation_ms ? Math.max(1, Math.round(data.generation_ms / 1000)) : null;
    setStatus(seconds
      ? 'Your full blueprint is ready in ' + seconds + ' seconds. Read it below or download the premium PDF.'
      : 'Your full blueprint is ready. Read it below or download the premium PDF.', 'success');
    setTimeout(function(){
      var result = qs('#pb3Result', root);
      if (result && result.scrollIntoView) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  window.submitPaidBlueprintV3 = async function(event){
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (running) return false;

    var root = getModal();
    if (!root) return false;
    updateNote();

    var payload = getPayload();
    var missing = validate(payload);
    if (missing.length) {
      setStatus('Please fill: ' + missing.join(', '), 'error');
      return false;
    }

    running = true;
    pdfPayload = null;
    window.__paidBlueprintPdfPayload = null;
    qs('#pb3Result', root).classList.remove('show');
    setButton(true);
    startProgress();

    try {
      var data = await fetchJson('/api/reports/paid-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 180000);
      stopProgress();
      showReport(data, payload);
    } catch (error) {
      stopProgress();
      if (error && error.name === 'AbortError') {
        setStatus('The report took longer than expected and the request timed out. Please try once more. If this repeats, we will reduce the report load further.', 'error');
      } else if (String(error && error.message || '').toLowerCase().includes('failed to fetch')) {
        setStatus('The server connection dropped before the report could return. Please refresh once and retry. The generation flow itself has been reset to the stable version.', 'error');
      } else {
        setStatus(error.message || 'Something went wrong while generating the report.', 'error');
      }
    } finally {
      running = false;
      setButton(false);
    }
    return false;
  };

  window.downloadPaidBlueprintPdfV4 = async function(event){
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    var payload = window.__paidBlueprintPdfPayload || pdfPayload;
    if (!payload || !payload.report_text) {
      setStatus('Please generate the report first. The PDF is created from the report visible here.', 'error');
      return false;
    }

    var root = getModal();
    var button = qs('#pb3Download', root);
    var original = button.textContent;
    button.classList.add('is-loading');
    button.textContent = 'PREPARING PREMIUM PDF...';
    setStatus('Designing your premium PDF. This usually takes a few seconds.', '');

    try {
      var response = await fetch('/api/reports/pdf-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });

      if (!response.ok) {
        var raw = await response.text();
        var message = raw;
        try {
          var parsed = JSON.parse(raw);
          message = parsed.error || raw;
        } catch (error) {}
        throw new Error(message || 'Could not create the PDF.');
      }

      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var safeName = String(payload.lead.name || 'Divya-Bajaj')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '');
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeName + '-Full-Blueprint.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
      setStatus('Premium PDF downloaded successfully.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not download the premium PDF.', 'error');
    } finally {
      button.classList.remove('is-loading');
      button.textContent = original;
    }
    return false;
  };

  function patchUi(){
    updateNote();
    var root = getModal();
    if (!root) return;
    var button = qs('#pb3Submit', root);
    if (button && !button.__divyaFastBound) {
      button.__divyaFastBound = true;
      button.onclick = window.submitPaidBlueprintV3;
    }
    var download = qs('#pb3Download', root);
    if (download && !download.__divyaFastBound) {
      download.__divyaFastBound = true;
      download.onclick = window.downloadPaidBlueprintPdfV4;
    }
  }

  var observer = new MutationObserver(patchUi);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(patchUi, 1000);
})();
