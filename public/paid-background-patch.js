(function(){
  if (window.__divyaPaidBackgroundPatch) return;
  window.__divyaPaidBackgroundPatch = true;

  var state = {
    running: false,
    jobId: '',
    reportId: '',
    leadId: '',
    payload: null,
    numbers: {},
    astrologyData: null,
    reportText: '',
    model: ''
  };

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function modal() {
    return document.getElementById('paidBlueprintModalV3');
  }

  function status(message, type) {
    var root = modal();
    if (!root) return;
    var box = qs('#pb3Status', root);
    if (!box) return;
    box.className = 'pb3-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setButton(loading) {
    var root = modal();
    if (!root) return;
    var button = qs('#pb3Submit', root);
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? 'Generating In Background...' : 'Generate Full Blueprint';
  }

  function getPayload() {
    var root = modal();
    return {
      name: qs('#pb3Name', root).value.trim(),
      email: qs('#pb3Email', root).value.trim(),
      phone: qs('#pb3Phone', root).value.trim(),
      dob: qs('#pb3Dob', root).value,
      tob: qs('#pb3Tob', root).value,
      pob: qs('#pb3Pob', root).value.trim(),
      question: qs('#pb3Question', root).value.trim(),
      source: 'paid_blueprint_background_flow'
    };
  }

  function validate(payload) {
    var labels = {
      name: 'Full Name',
      email: 'Email',
      phone: 'WhatsApp Number',
      dob: 'Date of Birth',
      tob: 'Time of Birth',
      pob: 'Place of Birth'
    };
    var missing = ['name','email','phone','dob','tob','pob'].filter(function(key){
      return !payload[key];
    });
    return missing.map(function(key){ return labels[key]; });
  }

  function wait(ms) {
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, timeoutMs || 30000);
    try {
      return await fetch(url, Object.assign({}, options || {}, {
        signal: controller.signal,
        cache: 'no-store'
      }));
    } finally {
      clearTimeout(timer);
    }
  }

  async function parseResponse(response) {
    var raw = await response.text();
    var data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = { error: raw || 'Invalid response from server' };
    }
    if (!response.ok || data.success === false) {
      throw new Error(data.error || ('Request failed with status ' + response.status));
    }
    return data;
  }

  function saveSession() {
    try {
      sessionStorage.setItem('divya_paid_background_job', JSON.stringify({
        jobId: state.jobId,
        reportId: state.reportId,
        leadId: state.leadId,
        payload: state.payload,
        numbers: state.numbers,
        astrologyData: state.astrologyData,
        model: state.model,
        savedAt: Date.now()
      }));
    } catch (error) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem('divya_paid_background_job'); } catch (error) {}
  }

  function showCompleted(reportText) {
    var root = modal();
    state.reportText = reportText;
    window.__paidBlueprintPdfPayload = {
      lead: state.payload,
      numbers: state.numbers || {},
      astrology_data: state.astrologyData || null,
      report_text: reportText,
      report_type: 'paid_blueprint_test'
    };

    qs('#pb3Report', root).textContent = reportText;
    qs('#pb3Result', root).classList.add('show');
    status('Your full blueprint is ready. You can read it below or download the premium PDF.', 'success');
    setButton(false);
    state.running = false;
    clearSession();
  }

  async function pollUntilComplete() {
    var startedAt = Date.now();
    var maxWaitMs = 9 * 60 * 1000;
    var consecutiveNetworkErrors = 0;

    while (Date.now() - startedAt < maxWaitMs) {
      var elapsed = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      var url = '/api/reports/paid-test/status/' + encodeURIComponent(state.jobId)
        + '?report_id=' + encodeURIComponent(state.reportId || '')
        + '&lead_id=' + encodeURIComponent(state.leadId || '')
        + '&t=' + Date.now();

      try {
        var response = await fetchWithTimeout(url, { method: 'GET' }, 30000);
        var data = await parseResponse(response);
        consecutiveNetworkErrors = 0;

        if (data.ready && data.report_text) {
          state.model = data.generated_by || state.model;
          showCompleted(data.report_text);
          return;
        }

        var phase = data.status === 'queued'
          ? 'Your request is queued securely.'
          : 'Divya’s system is preparing your detailed blueprint.';
        status(phase + '\n\nElapsed time: ' + elapsed + ' seconds. You can keep this window open. The report continues safely in the background.', '');
      } catch (error) {
        consecutiveNetworkErrors += 1;
        if (consecutiveNetworkErrors >= 5) throw error;
        status('The connection briefly dropped, but your report is still being prepared. Reconnecting automatically...\n\nRetry ' + consecutiveNetworkErrors + ' of 5.', '');
      }

      await wait(5000);
    }

    throw new Error('The report is still taking longer than expected. Please keep this tab open and try the status again shortly.');
  }

  window.submitPaidBlueprintV3 = async function(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }

    if (state.running) return false;

    var root = modal();
    if (!root) return false;
    var payload = getPayload();
    var missing = validate(payload);

    if (missing.length) {
      status('Please fill: ' + missing.join(', '), 'error');
      return false;
    }

    qs('#pb3Result', root).classList.remove('show');
    state.running = true;
    state.payload = payload;
    state.reportText = '';
    setButton(true);
    status('Starting your secure background report job. Please wait...', '');

    try {
      var response = await fetchWithTimeout('/api/reports/paid-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 45000);
      var data = await parseResponse(response);

      if (!data.job_id) throw new Error('The server did not return a report job ID.');

      state.jobId = data.job_id;
      state.reportId = data.report_id || '';
      state.leadId = data.lead_id || '';
      state.numbers = data.numbers || {};
      state.astrologyData = data.astrology_data || null;
      state.model = data.generated_by || '';
      saveSession();

      status('Your report job has started successfully. Divya’s system is now building the full blueprint in the background.', '');
      await pollUntilComplete();
    } catch (error) {
      state.running = false;
      setButton(false);
      status(error.name === 'AbortError'
        ? 'The start request took too long. Please tap Generate Full Blueprint once again.'
        : (error.message || 'Could not generate the paid report.'), 'error');
    }

    return false;
  };

  window.downloadPaidBlueprintPdfV4 = async function(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    var payload = window.__paidBlueprintPdfPayload;
    if (!payload || !payload.report_text) {
      status('Please wait for the report to finish before downloading the PDF.', 'error');
      return false;
    }

    var root = modal();
    var button = qs('#pb3Download', root);
    var original = button.textContent;
    button.classList.add('is-loading');
    button.textContent = 'Preparing Premium PDF...';
    status('Designing your premium PDF. This usually takes a few seconds.', '');

    try {
      var response = await fetchWithTimeout('/api/reports/pdf-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 90000);

      if (!response.ok) {
        var errorData = await parseResponse(response);
        throw new Error(errorData.error || 'Could not create the PDF.');
      }

      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var filename = String(payload.lead.name || 'Divya-Bajaj')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '') + '-Full-Blueprint.pdf';
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
      status('Premium PDF downloaded successfully.', 'success');
    } catch (error) {
      status(error.message || 'Could not download the premium PDF.', 'error');
    } finally {
      button.classList.remove('is-loading');
      button.textContent = original;
    }

    return false;
  };
})();
