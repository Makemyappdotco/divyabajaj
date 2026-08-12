(function () {
  'use strict';

  if (window.__divyaPaidAsyncHotfixV1) return;
  window.__divyaPaidAsyncHotfixV1 = true;

  var state = {
    generating: false,
    job: null,
    pdfPayload: null,
    location: null,
    pendingLocation: null,
    lastLocations: [],
    dobTimer: null
  };

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }
  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function setStatus(message, type) {
    var box = qs('#dbpStatus');
    if (!box) return;
    box.className = 'dbp-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setLocationStatus(message, type) {
    var box = qs('#dbpLocationStatus');
    if (!box) return;
    box.className = 'dbp-location-status' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setGenerating(value) {
    state.generating = value;
    var button = qs('#dbpSubmit');
    if (!button) return;
    button.disabled = value;
    button.textContent = value ? 'Preparing Your Full Blueprint...' : 'Generate My Full Blueprint';
  }

  function parseDob(value) {
    var match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    var day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    if (year < 1900 || date > new Date()) return null;
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function validTime(value) {
    var match = String(value || '').trim().match(/^(\d{2}):(\d{2})$/);
    return !!match && Number(match[1]) >= 0 && Number(match[1]) <= 23 && Number(match[2]) >= 0 && Number(match[2]) <= 59;
  }

  async function fetchJson(url, options, timeoutMs) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, timeoutMs || 45000);
    try {
      var opts = Object.assign({}, options || {}, { signal: controller.signal, cache: 'no-store' });
      var response = await window.fetch(url, opts);
      var raw = await response.text();
      var data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch (error) { data = { error: raw || 'Invalid server response' }; }
      if (!response.ok || data.success === false) throw new Error(data.error || 'Request failed');
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function installLocationCapture() {
    if (window.__divyaPaidAsyncFetchWrapped) return;
    window.__divyaPaidAsyncFetchWrapped = true;
    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : String((input && input.url) || '');
      var isSearch = url.indexOf('/api/locations/search') !== -1;
      var isTimezone = url.indexOf('/api/locations/timezone') !== -1;
      var timezoneBody = null;

      if (isTimezone && init && init.body) {
        try { timezoneBody = JSON.parse(init.body); } catch (error) {}
      }

      return nativeFetch(input, init).then(function (response) {
        if (!isSearch && !isTimezone) return response;
        response.clone().json().then(function (data) {
          if (isSearch && data && Array.isArray(data.locations)) {
            state.lastLocations = data.locations;
          }
          if (isTimezone && response.ok && data && data.success !== false && Number.isFinite(Number(data.timezone)) && timezoneBody) {
            state.location = Object.assign({}, state.pendingLocation || {}, {
              latitude: Number(timezoneBody.latitude),
              longitude: Number(timezoneBody.longitude),
              timezone: Number(data.timezone)
            });
          }
        }).catch(function () {});
        return response;
      });
    };
  }

  async function resolvePendingLocationTimezone() {
    if (!state.pendingLocation) return;
    var dob = parseDob((qs('#dbp-dob') || {}).value);
    if (!dob) return;
    var latitude = Number(state.pendingLocation.latitude);
    var longitude = Number(state.pendingLocation.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    setLocationStatus('Verifying historical timezone...', '');
    try {
      var data = await fetchJson('/api/locations/timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: latitude, longitude: longitude, dob: dob })
      }, 30000);
      state.location = Object.assign({}, state.pendingLocation, { timezone: Number(data.timezone) });
      var label = String(state.pendingLocation.place_name || (qs('#dbpPob') || {}).value || '').trim();
      setLocationStatus('Verified: ' + label + ' · UTC ' + (state.location.timezone >= 0 ? '+' : '') + state.location.timezone, 'ok');
    } catch (error) {
      state.location = null;
      setLocationStatus('Could not verify this birthplace. Please choose another suggestion.', 'error');
    }
  }

  function installLocationEvents() {
    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('.dbp-suggestion') : null;
      if (!button) return;
      var box = button.parentElement;
      var index = box ? Array.prototype.indexOf.call(box.children, button) : -1;
      if (index >= 0 && state.lastLocations[index]) {
        state.pendingLocation = state.lastLocations[index];
        state.location = null;
      }
    }, true);

    document.addEventListener('input', function (event) {
      if (event.target && event.target.id === 'dbpPob') {
        state.location = null;
        state.pendingLocation = null;
      }
      if (event.target && event.target.id === 'dbp-dob') {
        clearTimeout(state.dobTimer);
        state.dobTimer = setTimeout(resolvePendingLocationTimezone, 450);
      }
    }, true);
  }

  function formPayload() {
    var name = String((qs('#dbp-name') || {}).value || '').trim();
    var gender = String((qs('#dbp-gender') || {}).value || '').trim();
    var email = String((qs('#dbp-email') || {}).value || '').trim();
    var phone = String((qs('#dbp-phone') || {}).value || '').trim();
    var dob = parseDob((qs('#dbp-dob') || {}).value);
    var tob = String((qs('#dbp-tob') || {}).value || '').trim();
    var accuracy = String((qs('#dbp-accuracy') || {}).value || '').trim();
    var pob = String((qs('#dbpPob') || {}).value || '').trim();
    var question = String((qs('#dbpQuestion') || {}).value || '').trim();

    if (!/^[A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{1,79}$/.test(name)) throw new Error('Please enter a valid full name.');
    if (!gender) throw new Error('Please select gender.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Please enter a valid email address.');
    if (digits(phone).length < 10 || digits(phone).length > 15) throw new Error('Please enter a valid WhatsApp number.');
    if (!dob) throw new Error('Please enter a valid date of birth in DD/MM/YYYY format.');
    if (!validTime(tob)) throw new Error('Please enter a valid time of birth in HH:MM format.');
    if (!accuracy) throw new Error('Please select birth time accuracy.');
    if (!pob || !state.location || !Number.isFinite(Number(state.location.timezone))) {
      throw new Error('Please choose your birthplace from the suggestions and wait for timezone verification.');
    }
    if (question.length < 5) throw new Error('Please add your main concern in a few words.');

    return {
      name: name,
      gender: gender,
      email: email,
      phone: phone,
      dob: dob,
      tob: tob,
      birth_time_accuracy: accuracy,
      pob: pob,
      latitude: Number(state.location.latitude),
      longitude: Number(state.location.longitude),
      timezone: Number(state.location.timezone),
      timezone_id: String(state.location.timezone_id || ''),
      country_code: String(state.location.country_code || ''),
      question: question,
      source: 'paid_blueprint_live_background'
    };
  }

  async function pollUntilComplete(job, payload) {
    var started = Date.now();
    var maxMs = 12 * 60 * 1000;
    while (Date.now() - started < maxMs) {
      await sleep(4200);
      var data = await fetchJson('/api/reports/paid-test-v2/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_token: job.job_token, response_ids: job.response_ids })
      }, 45000);

      if (data.completed) return data;
      var completed = Number(data.completed_stages) || 0;
      var messages = [
        'Writing your verified report in three sections in parallel...',
        'One report section is complete. The remaining sections are being checked...',
        'Two report sections are complete. Finishing the final section and quality checks...'
      ];
      setStatus(messages[Math.min(completed, 2)], '');
    }
    throw new Error('The report is still processing longer than expected. Please try again in a moment.');
  }

  async function handleSubmit(event) {
    var form = event.target;
    if (!form || form.id !== 'dbpForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.generating) return;

    var payload;
    try { payload = formPayload(); }
    catch (error) { setStatus(error.message, 'error'); return; }

    state.pdfPayload = null;
    state.job = null;
    var result = qs('#dbpResult');
    if (result) result.classList.remove('show');
    setGenerating(true);
    setStatus('Verifying your chart, Dasha, birthplace and numerology...', '');

    try {
      var job = await fetchJson('/api/reports/paid-test-v2/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 75000);
      state.job = job;
      setStatus('Verified. Writing your Full Blueprint in three sections in parallel...', '');

      var data = await pollUntilComplete(job, payload);
      if (!data.report_text) throw new Error('The completed report did not contain report content.');

      state.pdfPayload = {
        lead: payload,
        numbers: data.numbers || job.numbers || {},
        astrology_data: data.astrology_data || null,
        report_text: data.report_text,
        report_type: 'paid_blueprint_live'
      };

      var reportBox = qs('#dbpReport');
      if (reportBox) reportBox.textContent = data.report_text;
      if (result) result.classList.add('show');
      setStatus('Your verified Full Blueprint is ready.', 'success');
      setTimeout(function () {
        if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error('[Full Blueprint background generation]', error);
      var message = error && error.name === 'AbortError'
        ? 'The connection took too long while starting the report. Please try once more.'
        : (error.message || 'Could not prepare the report. Please try again.');
      setStatus(message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(event) {
    var target = event.target && event.target.closest ? event.target.closest('#dbpDownload') : null;
    if (!target || !state.pdfPayload) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    var old = target.textContent;
    target.disabled = true;
    target.textContent = 'Preparing Your PDF...';
    setStatus('Preparing your branded PDF...', '');
    try {
      var response = await window.fetch('/api/reports/pdf-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(state.pdfPayload)
      });
      if (!response.ok) {
        var raw = await response.text();
        try { raw = JSON.parse(raw).error || raw; } catch (error) {}
        throw new Error(raw || 'Could not prepare the PDF.');
      }
      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      var safeName = String(state.pdfPayload.lead.name || 'Divya-Bajaj').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
      link.href = url;
      link.download = safeName + '-Full-Blueprint.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      setStatus('Your Full Blueprint PDF has been downloaded.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not download the PDF.', 'error');
    } finally {
      target.disabled = false;
      target.textContent = old;
    }
  }

  installLocationCapture();
  installLocationEvents();
  document.addEventListener('submit', handleSubmit, true);
  document.addEventListener('click', handleDownload, true);
})();
