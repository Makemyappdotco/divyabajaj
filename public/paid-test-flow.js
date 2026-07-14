(function(){
  if (window.__divyaPaidSingleFlow) return;
  window.__divyaPaidSingleFlow = true;

  var isGenerating = false;
  var progressTimer = null;
  var pdfPayload = null;

  function qs(selector, root){ return (root || document).querySelector(selector); }
  function textOf(el){ return String((el && el.textContent) || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function injectStyle(){
    if (document.getElementById('divyaPaidSingleStyle')) return;
    var style = document.createElement('style');
    style.id = 'divyaPaidSingleStyle';
    style.textContent = `
      .pb3-modal{position:fixed;inset:0;z-index:9999999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(3,3,5,.78);backdrop-filter:blur(14px)}
      .pb3-modal.show{display:flex}
      .pb3-card{width:min(760px,100%);max-height:92vh;overflow:auto;background:radial-gradient(circle at 18% 8%,rgba(201,169,110,.13),transparent 30%),linear-gradient(155deg,rgba(18,16,22,.99),rgba(7,6,10,.99));border:1px solid rgba(201,169,110,.32);box-shadow:0 34px 110px rgba(0,0,0,.58);color:#f7efe4;position:relative}
      .pb3-head{padding:26px 26px 18px;border-bottom:1px solid rgba(201,169,110,.13)}
      .pb3-kicker{display:inline-flex;align-items:center;gap:9px;color:#c9a96e;font-size:10px;font-weight:800;letter-spacing:2.8px;text-transform:uppercase;margin-bottom:12px;padding:7px 10px;border:1px solid rgba(201,169,110,.2);background:rgba(201,169,110,.055)}
      .pb3-kicker:before{content:'';width:8px;height:8px;border-radius:50%;background:#32d676;box-shadow:0 0 12px rgba(50,214,118,.55)}
      .pb3-title{font-family:Georgia,serif;font-size:32px;line-height:1.08;margin:0 46px 9px 0;color:#fff7ec;font-weight:700}
      .pb3-sub{color:#b9afa2;font-size:14px;line-height:1.65;margin:0;max-width:600px}
      .pb3-close{position:absolute;right:18px;top:17px;width:42px;height:42px;border-radius:999px;border:1px solid rgba(201,169,110,.28);background:rgba(201,169,110,.06);color:#e7d3a2;font-size:24px;line-height:1;cursor:pointer;z-index:4}
      .pb3-body{padding:24px 26px 34px}
      .pb3-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .pb3-field{display:flex;flex-direction:column;gap:8px}
      .pb3-field.full{grid-column:1/-1}
      .pb3-field label{font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:#c9a96e;font-weight:800}
      .pb3-field input,.pb3-field textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.045);border:1px solid rgba(201,169,110,.22);color:#f7efe4;padding:14px;outline:none;font-size:15px;font-family:inherit}
      .pb3-field textarea{min-height:88px;resize:vertical}
      .pb3-field input:focus,.pb3-field textarea:focus{border-color:rgba(201,169,110,.62);box-shadow:0 0 0 3px rgba(201,169,110,.09)}
      .pb3-actions{grid-column:1/-1;margin-top:10px;padding-top:18px;padding-bottom:8px;border-top:1px solid rgba(201,169,110,.1)}
      .pb3-submit{display:block;width:100%;background:linear-gradient(135deg,#c9a96e,#ead39c);color:#08070a;border:0;padding:18px 20px;font-size:12px;font-weight:900;letter-spacing:2.4px;text-transform:uppercase;cursor:pointer;box-shadow:0 16px 42px rgba(201,169,110,.16);touch-action:manipulation}
      .pb3-submit:active{transform:translateY(1px)}
      .pb3-submit:disabled{opacity:.62;cursor:wait}
      .pb3-note{font-size:12px;color:#9f9588;line-height:1.55;margin-top:12px;text-align:center}
      .pb3-status{margin-top:14px;padding:14px;border:1px solid rgba(201,169,110,.17);background:rgba(201,169,110,.045);color:#d7cabc;font-size:13px;line-height:1.55;display:none;white-space:pre-wrap}
      .pb3-status.show{display:block}
      .pb3-status.error{border-color:rgba(255,120,105,.35);color:#ffb4aa;background:rgba(255,120,105,.06)}
      .pb3-status.success{border-color:rgba(59,211,126,.32);color:#d9f8e6;background:rgba(59,211,126,.06)}
      .pb3-result{margin-top:18px;padding:18px;border:1px solid rgba(201,169,110,.18);background:rgba(201,169,110,.045);display:none}
      .pb3-result.show{display:block}
      .pb3-download{display:block;margin:12px 0 16px;padding:16px 18px;background:linear-gradient(135deg,#c9a96e,#ead39c);color:#08070a;text-decoration:none;font-weight:900;letter-spacing:1.7px;text-transform:uppercase;font-size:12px;text-align:center;cursor:pointer}
      .pb3-download.is-loading{opacity:.65;pointer-events:none}
      .pb3-report{max-height:420px;overflow:auto;white-space:pre-wrap;color:#ddd2c5;line-height:1.72;font-size:14px;padding-right:6px}
      @media(max-width:640px){.pb3-modal{padding:10px}.pb3-card{max-height:94vh;width:100%}.pb3-grid{grid-template-columns:1fr}.pb3-title{font-size:25px}.pb3-head{padding:22px 18px 16px}.pb3-body{padding:20px 18px 30px}.pb3-close{right:12px;top:12px}.pb3-submit{padding:17px 16px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal(){
    injectStyle();
    var existing = document.getElementById('paidBlueprintModalV3');
    if (existing) return existing;

    var modal = document.createElement('div');
    modal.className = 'pb3-modal';
    modal.id = 'paidBlueprintModalV3';
    modal.innerHTML = `
      <div class="pb3-card" role="dialog" aria-modal="true" aria-labelledby="pb3Title">
        <button class="pb3-close" type="button" data-pb-action="close" aria-label="Close">&times;</button>
        <div class="pb3-head">
          <div class="pb3-kicker">Full Blueprint Test Mode</div>
          <h2 class="pb3-title" id="pb3Title">Generate the Full Blueprint Report</h2>
          <p class="pb3-sub">A detailed astrology + numerology personal blueprint. Payment is skipped during testing.</p>
        </div>
        <div class="pb3-body">
          <div class="pb3-grid">
            <div class="pb3-field"><label>Full Name</label><input id="pb3Name" autocomplete="name"></div>
            <div class="pb3-field"><label>Email</label><input id="pb3Email" type="email" autocomplete="email"></div>
            <div class="pb3-field"><label>WhatsApp Number</label><input id="pb3Phone" inputmode="tel"></div>
            <div class="pb3-field"><label>Date of Birth</label><input id="pb3Dob" type="date"></div>
            <div class="pb3-field"><label>Time of Birth</label><input id="pb3Tob" type="time"></div>
            <div class="pb3-field"><label>Place of Birth</label><input id="pb3Pob" placeholder="City, State, Country"></div>
            <div class="pb3-field full"><label>Main Concern</label><textarea id="pb3Question" placeholder="Career, money, marriage, business, life direction, etc."></textarea></div>
            <div class="pb3-actions">
              <button class="pb3-submit" id="pb3Submit" type="button" data-pb-action="submit">Generate Full Blueprint</button>
              <div class="pb3-note">Usually ready in about 45 to 90 seconds. Please keep this window open.</div>
              <div class="pb3-status" id="pb3Status"></div>
            </div>
          </div>
          <div class="pb3-result" id="pb3Result">
            <h3 style="margin:0 0 8px;color:#c9a96e;font-family:Georgia,serif;font-size:24px">Your full blueprint is ready</h3>
            <button class="pb3-download" id="pb3Download" type="button" data-pb-action="download">Download Premium PDF</button>
            <div class="pb3-report" id="pb3Report"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function setStatus(message, type){
    var box = qs('#pb3Status', ensureModal());
    box.className = 'pb3-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setGenerating(value){
    isGenerating = value;
    var button = qs('#pb3Submit', ensureModal());
    button.disabled = value;
    button.textContent = value ? 'PREPARING YOUR BLUEPRINT...' : 'GENERATE FULL BLUEPRINT';
  }

  function openModal(){
    var modal = ensureModal();
    qs('#pb3Status', modal).className = 'pb3-status';
    qs('#pb3Result', modal).classList.remove('show');
    pdfPayload = null;
    setGenerating(false);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    if (isGenerating) {
      setStatus('Your report is still being generated. Please wait for it to finish before closing this window.', '');
      return;
    }
    var modal = document.getElementById('paidBlueprintModalV3');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
  }

  function payloadFromForm(){
    var modal = ensureModal();
    return {
      name: qs('#pb3Name', modal).value.trim(),
      email: qs('#pb3Email', modal).value.trim(),
      phone: qs('#pb3Phone', modal).value.trim(),
      dob: qs('#pb3Dob', modal).value,
      tob: qs('#pb3Tob', modal).value,
      pob: qs('#pb3Pob', modal).value.trim(),
      question: qs('#pb3Question', modal).value.trim(),
      source: 'paid_blueprint_single_flow'
    };
  }

  function validate(payload){
    var names = {name:'Full Name',email:'Email',phone:'WhatsApp Number',dob:'Date of Birth',tob:'Time of Birth',pob:'Place of Birth'};
    return ['name','email','phone','dob','tob','pob'].filter(function(key){ return !payload[key]; }).map(function(key){ return names[key]; });
  }

  function startProgress(){
    var messages = [
      'Reading your birth details and core number patterns...',
      'Connecting your personality, career, money and relationship patterns...',
      'Building your current-year and future-direction guidance...',
      'Structuring your report into a clear personal blueprint...',
      'Finalising your detailed report and action points...'
    ];
    var index = 0;
    setStatus(messages[index], '');
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

  async function submitReport(){
    if (isGenerating) return;
    var payload = payloadFromForm();
    var missing = validate(payload);
    if (missing.length) {
      setStatus('Please fill: ' + missing.join(', '), 'error');
      return;
    }

    var modal = ensureModal();
    qs('#pb3Result', modal).classList.remove('show');
    pdfPayload = null;
    setGenerating(true);
    startProgress();

    var controller = new AbortController();
    var timeout = setTimeout(function(){ controller.abort(); }, 180000);

    try {
      var response = await fetch('/api/reports/paid-test', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: 'no-store'
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
        report_type: 'paid_blueprint_test'
      };
      window.__paidBlueprintPdfPayload = pdfPayload;
      qs('#pb3Report', modal).textContent = data.report_text;
      qs('#pb3Result', modal).classList.add('show');
      var seconds = data.generation_ms ? Math.max(1, Math.round(data.generation_ms / 1000)) : null;
      setStatus(seconds ? 'Your full blueprint is ready in ' + seconds + ' seconds.' : 'Your full blueprint is ready.', 'success');
      setTimeout(function(){ qs('#pb3Result', modal).scrollIntoView({behavior:'smooth',block:'start'}); }, 100);
    } catch (error) {
      if (error && error.name === 'AbortError') setStatus('The report took longer than 3 minutes and was stopped. Please try again.', 'error');
      else setStatus(error.message || 'Something went wrong while generating the report.', 'error');
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
    var button = qs('#pb3Download', ensureModal());
    var original = button.textContent;
    button.disabled = true;
    button.textContent = 'PREPARING PREMIUM PDF...';
    setStatus('Designing your premium PDF. This usually takes a few seconds.', '');
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
      link.download = safeName + '-Full-Blueprint.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
      setStatus('Premium PDF downloaded successfully.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not download the PDF.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function isPaidCta(el){
    if (!el || el.closest('#paidBlueprintModalV3')) return false;
    var label = textOf(el);
    var href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    if (/free report|read my numbers free|whatsapp/.test(label)) return false;
    return /get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label + ' ' + href);
  }

  document.addEventListener('click', function(event){
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;

    if (target.matches('[data-pb-action="close"]')) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (target.matches('[data-pb-action="submit"]')) {
      event.preventDefault();
      submitReport();
      return;
    }
    if (target.matches('[data-pb-action="download"]')) {
      event.preventDefault();
      downloadPdf();
      return;
    }
    if (isPaidCta(target)) {
      event.preventDefault();
      event.stopPropagation();
      openModal();
    }
  }, true);

  document.addEventListener('keydown', function(event){
    if (event.key === 'Escape') closeModal();
  });

  window.openPaidBlueprint = openModal;
  window.openPaidBlueprintV3 = openModal;
})();
