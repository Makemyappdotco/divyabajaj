(function(){
  if (window.__divyaPaidV2Flow) return;
  window.__divyaPaidV2Flow = true;

  var isGenerating = false;
  var progressTimer = null;
  var searchTimer = null;
  var locationRequest = 0;
  var selectedLocation = null;
  var pdfPayload = null;

  function qs(selector, root){ return (root || document).querySelector(selector); }
  function qsa(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function textOf(el){ return String((el && el.textContent) || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function injectStyle(){
    if (document.getElementById('divyaPaidV2Style')) return;
    var style = document.createElement('style');
    style.id = 'divyaPaidV2Style';
    style.textContent = `
      .pb4-modal{position:fixed;inset:0;z-index:9999999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(3,3,5,.82);backdrop-filter:blur(14px)}
      .pb4-modal.show{display:flex}
      .pb4-card{width:min(820px,100%);max-height:94vh;overflow:auto;background:radial-gradient(circle at 18% 8%,rgba(201,169,110,.13),transparent 30%),linear-gradient(155deg,rgba(18,16,22,.99),rgba(7,6,10,.99));border:1px solid rgba(201,169,110,.32);box-shadow:0 34px 110px rgba(0,0,0,.62);color:#f7efe4;position:relative}
      .pb4-head{padding:27px 28px 19px;border-bottom:1px solid rgba(201,169,110,.13)}
      .pb4-kicker{display:inline-flex;align-items:center;gap:9px;color:#c9a96e;font-size:10px;font-weight:800;letter-spacing:2.6px;text-transform:uppercase;margin-bottom:12px;padding:7px 10px;border:1px solid rgba(201,169,110,.2);background:rgba(201,169,110,.055)}
      .pb4-kicker:before{content:'';width:8px;height:8px;border-radius:50%;background:#32d676;box-shadow:0 0 12px rgba(50,214,118,.55)}
      .pb4-title{font-family:Georgia,serif;font-size:33px;line-height:1.08;margin:0 50px 9px 0;color:#fff7ec;font-weight:700}
      .pb4-sub{color:#b9afa2;font-size:14px;line-height:1.65;margin:0;max-width:660px}
      .pb4-close{position:absolute;right:18px;top:17px;width:42px;height:42px;border-radius:999px;border:1px solid rgba(201,169,110,.28);background:rgba(201,169,110,.06);color:#e7d3a2;font-size:24px;line-height:1;cursor:pointer;z-index:4}
      .pb4-body{padding:24px 28px 36px}
      .pb4-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .pb4-field{display:flex;flex-direction:column;gap:8px;position:relative}
      .pb4-field.full{grid-column:1/-1}
      .pb4-field label{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a96e;font-weight:800}
      .pb4-field input,.pb4-field textarea,.pb4-field select{width:100%;box-sizing:border-box;background:rgba(255,255,255,.045);border:1px solid rgba(201,169,110,.22);color:#f7efe4;padding:14px;outline:none;font-size:15px;font-family:inherit;border-radius:0}
      .pb4-field select{appearance:auto;color-scheme:dark}
      .pb4-field option{background:#151219;color:#f7efe4}
      .pb4-field textarea{min-height:92px;resize:vertical}
      .pb4-field input:focus,.pb4-field textarea:focus,.pb4-field select:focus{border-color:rgba(201,169,110,.62);box-shadow:0 0 0 3px rgba(201,169,110,.09)}
      .pb4-help{font-size:11px;color:#8f867b;line-height:1.45;margin-top:-2px}
      .pb4-location-status{font-size:11px;color:#c5b8a8;min-height:16px}
      .pb4-location-status.ok{color:#a9e6c2}
      .pb4-location-status.error{color:#ffb4aa}
      .pb4-suggestions{position:absolute;left:0;right:0;top:75px;z-index:20;background:#111015;border:1px solid rgba(201,169,110,.35);box-shadow:0 18px 48px rgba(0,0,0,.5);max-height:260px;overflow:auto;display:none}
      .pb4-suggestions.show{display:block}
      .pb4-suggestion{width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid rgba(201,169,110,.1);padding:12px 14px;color:#eee3d6;cursor:pointer;font:inherit}
      .pb4-suggestion:hover,.pb4-suggestion:focus{background:rgba(201,169,110,.11);outline:none}
      .pb4-suggestion small{display:block;color:#938a80;margin-top:4px}
      .pb4-actions{grid-column:1/-1;margin-top:10px;padding-top:18px;padding-bottom:8px;border-top:1px solid rgba(201,169,110,.1)}
      .pb4-submit{display:block;width:100%;background:linear-gradient(135deg,#c9a96e,#ead39c);color:#08070a;border:0;padding:18px 20px;font-size:12px;font-weight:900;letter-spacing:2.2px;text-transform:uppercase;cursor:pointer;box-shadow:0 16px 42px rgba(201,169,110,.16);touch-action:manipulation}
      .pb4-submit:disabled{opacity:.62;cursor:wait}
      .pb4-note{font-size:12px;color:#9f9588;line-height:1.55;margin-top:12px;text-align:center}
      .pb4-status{margin-top:14px;padding:14px;border:1px solid rgba(201,169,110,.17);background:rgba(201,169,110,.045);color:#d7cabc;font-size:13px;line-height:1.55;display:none;white-space:pre-wrap}
      .pb4-status.show{display:block}
      .pb4-status.error{border-color:rgba(255,120,105,.35);color:#ffb4aa;background:rgba(255,120,105,.06)}
      .pb4-status.success{border-color:rgba(59,211,126,.32);color:#d9f8e6;background:rgba(59,211,126,.06)}
      .pb4-result{margin-top:18px;padding:18px;border:1px solid rgba(201,169,110,.18);background:rgba(201,169,110,.045);display:none}
      .pb4-result.show{display:block}
      .pb4-download{display:block;width:100%;margin:12px 0 16px;padding:16px 18px;background:linear-gradient(135deg,#c9a96e,#ead39c);color:#08070a;border:0;text-decoration:none;font-weight:900;letter-spacing:1.7px;text-transform:uppercase;font-size:12px;text-align:center;cursor:pointer}
      .pb4-report{max-height:430px;overflow:auto;white-space:pre-wrap;color:#ddd2c5;line-height:1.72;font-size:14px;padding-right:6px}
      @media(max-width:680px){.pb4-modal{padding:8px}.pb4-card{max-height:96vh}.pb4-grid{grid-template-columns:1fr}.pb4-field.full{grid-column:auto}.pb4-title{font-size:25px}.pb4-head{padding:22px 18px 16px}.pb4-body{padding:20px 18px 30px}.pb4-close{right:12px;top:12px}.pb4-submit{padding:17px 16px}.pb4-suggestions{top:75px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal(){
    injectStyle();
    var existing = document.getElementById('paidBlueprintModalV4');
    if (existing) return existing;

    var modal = document.createElement('div');
    modal.className = 'pb4-modal';
    modal.id = 'paidBlueprintModalV4';
    modal.innerHTML = `
      <div class="pb4-card" role="dialog" aria-modal="true" aria-labelledby="pb4Title">
        <button class="pb4-close" type="button" data-pb4-action="close" aria-label="Close">&times;</button>
        <div class="pb4-head">
          <div class="pb4-kicker">AstrologyAPI V2 Preview</div>
          <h2 class="pb4-title" id="pb4Title">Generate the Full Blueprint</h2>
          <p class="pb4-sub">A real astrology and numerology report using verified chart, Dasha, location and numerology calculations. Payment is skipped in this private preview.</p>
        </div>
        <div class="pb4-body">
          <div class="pb4-grid">
            <div class="pb4-field"><label>Full Name</label><input id="pb4Name" autocomplete="name"></div>
            <div class="pb4-field"><label>Gender</label><select id="pb4Gender"><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option></select></div>
            <div class="pb4-field"><label>Email</label><input id="pb4Email" type="email" autocomplete="email"></div>
            <div class="pb4-field"><label>WhatsApp Number</label><input id="pb4Phone" inputmode="tel" autocomplete="tel"></div>
            <div class="pb4-field"><label>Date of Birth</label><input id="pb4Dob" type="date"></div>
            <div class="pb4-field"><label>Time of Birth</label><input id="pb4Tob" type="time"></div>
            <div class="pb4-field"><label>Birth Time Accuracy</label><select id="pb4Accuracy"><option value="">Select accuracy</option><option value="exact_record">Exact, from records</option><option value="family_confirmed">Confirmed by family</option><option value="approximate">Approximate</option></select><div class="pb4-help">Exact time gives more reliable house and divisional-chart calculations.</div></div>
            <div class="pb4-field"><label>Place of Birth</label><input id="pb4Pob" autocomplete="off" placeholder="Start typing a city, district or village"><div class="pb4-location-status" id="pb4LocationStatus">Select a location from the suggestions.</div><div class="pb4-suggestions" id="pb4Suggestions"></div></div>
            <div class="pb4-field full"><label>Main Concern</label><textarea id="pb4Question" placeholder="Career, money, marriage, business, relationship or overall life direction"></textarea></div>
            <div class="pb4-actions">
              <button class="pb4-submit" id="pb4Submit" type="button" data-pb4-action="submit">Generate Full Blueprint</button>
              <div class="pb4-note">The preview may take 1 to 3 minutes because it verifies multiple astrology and numerology sources before writing the report.</div>
              <div class="pb4-status" id="pb4Status"></div>
            </div>
          </div>
          <div class="pb4-result" id="pb4Result">
            <h3 style="margin:0 0 8px;color:#c9a96e;font-family:Georgia,serif;font-size:24px">Your Full Blueprint is ready</h3>
            <button class="pb4-download" id="pb4Download" type="button" data-pb4-action="download">Download Preview PDF</button>
            <div class="pb4-report" id="pb4Report"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    qs('#pb4Pob', modal).addEventListener('input', onLocationInput);
    qs('#pb4Dob', modal).addEventListener('change', function(){
      if (selectedLocation) resolveTimezone();
    });
    document.addEventListener('click', function(event){
      if (!event.target.closest('#pb4Pob') && !event.target.closest('#pb4Suggestions')) hideSuggestions();
    });
    return modal;
  }

  function setStatus(message, type){
    var box = qs('#pb4Status', ensureModal());
    box.className = 'pb4-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setLocationStatus(message, type){
    var box = qs('#pb4LocationStatus', ensureModal());
    box.className = 'pb4-location-status' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setGenerating(value){
    isGenerating = value;
    var button = qs('#pb4Submit', ensureModal());
    button.disabled = value;
    button.textContent = value ? 'PREPARING YOUR BLUEPRINT...' : 'GENERATE FULL BLUEPRINT';
  }

  function openModal(){
    var modal = ensureModal();
    qs('#pb4Status', modal).className = 'pb4-status';
    qs('#pb4Result', modal).classList.remove('show');
    pdfPayload = null;
    setGenerating(false);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    if (isGenerating) {
      setStatus('Your report is still being generated. Please wait before closing this window.', '');
      return;
    }
    var modal = document.getElementById('paidBlueprintModalV4');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
  }

  function hideSuggestions(){
    var box = qs('#pb4Suggestions', ensureModal());
    box.classList.remove('show');
    box.innerHTML = '';
  }

  function onLocationInput(event){
    selectedLocation = null;
    setLocationStatus('Select a location from the suggestions.', '');
    clearTimeout(searchTimer);
    var query = event.target.value.trim();
    if (query.length < 2) {
      hideSuggestions();
      return;
    }
    searchTimer = setTimeout(function(){ searchLocations(query); }, 350);
  }

  async function searchLocations(query){
    var requestId = ++locationRequest;
    setLocationStatus('Searching accurate locations...', '');
    try {
      var response = await fetch('/api/locations/search?q=' + encodeURIComponent(query), { cache:'no-store' });
      var data = await response.json();
      if (requestId !== locationRequest) return;
      if (!response.ok || data.success === false) throw new Error(data.error || 'Location search failed');
      renderSuggestions(data.locations || []);
    } catch (error) {
      if (requestId !== locationRequest) return;
      hideSuggestions();
      setLocationStatus(error.message || 'Could not search locations.', 'error');
    }
  }

  function renderSuggestions(locations){
    var box = qs('#pb4Suggestions', ensureModal());
    box.innerHTML = '';
    if (!locations.length) {
      setLocationStatus('No matching location found. Try a nearby city or add the state/country.', 'error');
      box.classList.remove('show');
      return;
    }

    locations.forEach(function(location){
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pb4-suggestion';
      button.innerHTML = '<strong></strong><small></small>';
      qs('strong', button).textContent = location.place_name;
      qs('small', button).textContent = [location.country_code, location.timezone_id].filter(Boolean).join(' · ');
      button.addEventListener('click', function(){ selectLocation(location); });
      box.appendChild(button);
    });
    box.classList.add('show');
  }

  async function selectLocation(location){
    selectedLocation = location;
    qs('#pb4Pob', ensureModal()).value = location.place_name;
    hideSuggestions();
    setLocationStatus('Location selected. Calculating the correct historical timezone...', '');
    await resolveTimezone();
  }

  async function resolveTimezone(){
    if (!selectedLocation) return;
    var dob = qs('#pb4Dob', ensureModal()).value;
    if (!dob) {
      setLocationStatus('Location selected. Add date of birth to calculate the timezone.', 'ok');
      return;
    }

    try {
      var response = await fetch('/api/locations/timezone', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          latitude:selectedLocation.latitude,
          longitude:selectedLocation.longitude,
          dob:dob
        }),
        cache:'no-store'
      });
      var data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.error || 'Timezone lookup failed');
      selectedLocation.timezone = Number(data.timezone);
      setLocationStatus('Verified: ' + selectedLocation.place_name + ' · UTC ' + (selectedLocation.timezone >= 0 ? '+' : '') + selectedLocation.timezone, 'ok');
    } catch (error) {
      selectedLocation.timezone = null;
      setLocationStatus(error.message || 'Could not calculate the timezone.', 'error');
    }
  }

  function payloadFromForm(){
    var modal = ensureModal();
    return {
      name: qs('#pb4Name', modal).value.trim(),
      gender: qs('#pb4Gender', modal).value,
      email: qs('#pb4Email', modal).value.trim(),
      phone: qs('#pb4Phone', modal).value.trim(),
      dob: qs('#pb4Dob', modal).value,
      tob: qs('#pb4Tob', modal).value,
      birth_time_accuracy: qs('#pb4Accuracy', modal).value,
      pob: qs('#pb4Pob', modal).value.trim(),
      latitude: selectedLocation ? selectedLocation.latitude : null,
      longitude: selectedLocation ? selectedLocation.longitude : null,
      timezone: selectedLocation ? selectedLocation.timezone : null,
      timezone_id: selectedLocation ? selectedLocation.timezone_id : '',
      country_code: selectedLocation ? selectedLocation.country_code : '',
      question: qs('#pb4Question', modal).value.trim(),
      include_source_pdfs: false,
      source: 'paid_blueprint_astrologyapi_v2_preview'
    };
  }

  function validate(payload){
    var names = {
      name:'Full Name', gender:'Gender', email:'Email', phone:'WhatsApp Number', dob:'Date of Birth',
      tob:'Time of Birth', birth_time_accuracy:'Birth Time Accuracy', pob:'Place of Birth'
    };
    var missing = Object.keys(names).filter(function(key){ return !payload[key]; }).map(function(key){ return names[key]; });
    if (!selectedLocation) missing.push('Select Place of Birth from suggestions');
    else if (!Number.isFinite(Number(payload.timezone))) missing.push('Verified birth-place timezone');
    return missing;
  }

  function startProgress(){
    var messages = [
      'Verifying your birthplace, coordinates and historical timezone...',
      'Calculating planetary positions, D1, D9 and D10 charts...',
      'Reading your current Vimshottari Dasha periods...',
      'Calculating your complete numerology profile...',
      'Connecting astrology and numerology with your main concern...',
      'Writing the report in Divya Bajaj’s simple and practical voice...',
      'Structuring the final Full Blueprint and checking accuracy...'
    ];
    var index = 0;
    setStatus(messages[index], '');
    clearInterval(progressTimer);
    progressTimer = setInterval(function(){
      index = Math.min(index + 1, messages.length - 1);
      setStatus(messages[index], '');
    }, 18000);
  }

  function stopProgress(){ clearInterval(progressTimer); progressTimer = null; }

  async function submitReport(){
    if (isGenerating) return;
    var payload = payloadFromForm();
    var missing = validate(payload);
    if (missing.length) {
      setStatus('Please complete: ' + missing.join(', '), 'error');
      return;
    }

    var modal = ensureModal();
    qs('#pb4Result', modal).classList.remove('show');
    pdfPayload = null;
    setGenerating(true);
    startProgress();

    var controller = new AbortController();
    var timeout = setTimeout(function(){ controller.abort(); }, 300000);

    try {
      var response = await fetch('/api/reports/paid-test-v2', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        signal:controller.signal,
        cache:'no-store'
      });
      var raw = await response.text();
      var data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch (error) { data = { error: raw || 'Invalid server response' }; }
      if (!response.ok || data.success === false) throw new Error(data.error || ('Request failed with status ' + response.status));
      if (!data.report_text) throw new Error('The report service returned no report text.');

      pdfPayload = {
        lead: payload,
        numbers: data.numbers || {},
        astrology_data: data.astrology_data || null,
        report_text: data.report_text,
        report_type: 'paid_blueprint_v2_preview'
      };
      window.__paidBlueprintPdfPayload = pdfPayload;
      qs('#pb4Report', modal).textContent = data.report_text;
      qs('#pb4Result', modal).classList.add('show');
      var seconds = data.generation_ms ? Math.max(1, Math.round(data.generation_ms / 1000)) : null;
      setStatus(seconds ? 'Verified Full Blueprint generated in ' + seconds + ' seconds.' : 'Your verified Full Blueprint is ready.', 'success');
      setTimeout(function(){ qs('#pb4Result', modal).scrollIntoView({behavior:'smooth',block:'start'}); }, 100);
    } catch (error) {
      if (error && error.name === 'AbortError') setStatus('The report took longer than five minutes. No payment was taken. Please try again.', 'error');
      else setStatus(error.message || 'Could not generate the report.', 'error');
    } finally {
      clearTimeout(timeout);
      stopProgress();
      setGenerating(false);
    }
  }

  async function downloadPdf(){
    if (!pdfPayload || !pdfPayload.report_text) {
      setStatus('Please generate the report first.', 'error');
      return;
    }
    var button = qs('#pb4Download', ensureModal());
    var original = button.textContent;
    button.disabled = true;
    button.textContent = 'PREPARING PREVIEW PDF...';
    setStatus('Preparing the branded preview PDF...', '');
    try {
      var response = await fetch('/api/reports/pdf-direct', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(pdfPayload),
        cache:'no-store'
      });
      if (!response.ok) {
        var raw = await response.text();
        var message = raw;
        try { message = JSON.parse(raw).error || raw; } catch (error) {}
        throw new Error(message || 'Could not create the PDF.');
      }
      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var safeName = String(pdfPayload.lead.name || 'Divya-Bajaj').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
      var link = document.createElement('a');
      link.href = url;
      link.download = safeName + '-Full-Blueprint-V2-Preview.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
      setStatus('Preview PDF downloaded successfully.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not download the PDF.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function isPaidCta(el){
    if (!el || el.closest('#paidBlueprintModalV4')) return false;
    var label = textOf(el);
    var href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    if (/free report|read my numbers free|whatsapp/.test(label)) return false;
    return /get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label + ' ' + href);
  }

  document.addEventListener('click', function(event){
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;
    if (target.matches('[data-pb4-action="close"]')) { event.preventDefault(); closeModal(); return; }
    if (target.matches('[data-pb4-action="submit"]')) { event.preventDefault(); submitReport(); return; }
    if (target.matches('[data-pb4-action="download"]')) { event.preventDefault(); downloadPdf(); return; }
    if (isPaidCta(target)) { event.preventDefault(); event.stopPropagation(); openModal(); }
  }, true);

  document.addEventListener('keydown', function(event){ if (event.key === 'Escape') closeModal(); });

  window.openPaidBlueprint = openModal;
  window.openPaidBlueprintV4 = openModal;
})();