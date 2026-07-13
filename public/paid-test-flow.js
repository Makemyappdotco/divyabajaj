(function(){
  if (window.__paidBlueprintPatchLoadedV3) return;
  window.__paidBlueprintPatchLoadedV3 = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function cleanText(el){ return (el && el.textContent || '').trim().toLowerCase().replace(/\s+/g,' '); }

  function injectStyle(){
    if (document.getElementById('paidBlueprintStyleV3')) return;
    var style = document.createElement('style');
    style.id = 'paidBlueprintStyleV3';
    style.textContent = `
      .pb3-modal{position:fixed;inset:0;z-index:9999999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(3,3,5,.78);backdrop-filter:blur(14px)}
      .pb3-modal.show{display:flex}
      .pb3-card{width:min(760px,100%);max-height:92vh;overflow:auto;background:radial-gradient(circle at 18% 8%,rgba(201,169,110,.13),transparent 30%),linear-gradient(155deg,rgba(18,16,22,.99),rgba(7,6,10,.99));border:1px solid rgba(201,169,110,.32);box-shadow:0 34px 110px rgba(0,0,0,.58);color:#f7efe4;position:relative;border-radius:0}
      .pb3-head{padding:26px 26px 18px;border-bottom:1px solid rgba(201,169,110,.13)}
      .pb3-kicker{display:inline-flex;align-items:center;gap:9px;color:#c9a96e;font-size:10px;font-weight:800;letter-spacing:2.8px;text-transform:uppercase;margin-bottom:12px;padding:7px 10px;border:1px solid rgba(201,169,110,.2);background:rgba(201,169,110,.055)}
      .pb3-kicker:before{content:'';width:8px;height:8px;border-radius:50%;background:#32d676;box-shadow:0 0 12px rgba(50,214,118,.55)}
      .pb3-title{font-family:Georgia,serif;font-size:32px;line-height:1.08;margin:0 46px 9px 0;color:#fff7ec;font-weight:700}
      .pb3-sub{color:#b9afa2;font-size:14px;line-height:1.65;margin:0;max-width:600px}
      .pb3-close{position:absolute;right:18px;top:17px;width:42px;height:42px;border-radius:999px;border:1px solid rgba(201,169,110,.28);background:rgba(201,169,110,.06);color:#e7d3a2;font-size:24px;line-height:1;cursor:pointer;z-index:4}
      .pb3-body{padding:24px 26px 34px}
      .pb3-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;position:relative;z-index:2}
      .pb3-field{display:flex;flex-direction:column;gap:8px}
      .pb3-field.full{grid-column:1/-1}
      .pb3-field label{font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:#c9a96e;font-weight:800}
      .pb3-field input,.pb3-field textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.045);border:1px solid rgba(201,169,110,.22);color:#f7efe4;padding:14px 14px;outline:none;font-size:15px;border-radius:0;font-family:inherit;position:relative;z-index:3}
      .pb3-field textarea{min-height:88px;resize:vertical}
      .pb3-field input:focus,.pb3-field textarea:focus{border-color:rgba(201,169,110,.62);box-shadow:0 0 0 3px rgba(201,169,110,.09)}
      .pb3-actions{grid-column:1/-1;margin-top:10px;padding-top:18px;padding-bottom:4px;border-top:1px solid rgba(201,169,110,.1);position:relative;z-index:5}
      .pb3-submit{display:block;width:100%;background:linear-gradient(135deg,#c9a96e,#ead39c);color:#08070a;border:0;padding:18px 20px;font-size:12px;font-weight:900;letter-spacing:2.4px;text-transform:uppercase;cursor:pointer;box-shadow:0 16px 42px rgba(201,169,110,.16);position:relative;z-index:99999999;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent}
      .pb3-submit:active{transform:translateY(1px)}
      .pb3-submit:disabled{opacity:.62;cursor:not-allowed}
      .pb3-note{font-size:12px;color:#9f9588;line-height:1.55;margin-top:12px;text-align:center}
      .pb3-status{margin-top:14px;padding:14px;border:1px solid rgba(201,169,110,.17);background:rgba(201,169,110,.045);color:#d7cabc;font-size:13px;line-height:1.55;display:none;white-space:pre-wrap}
      .pb3-status.show{display:block}
      .pb3-status.error{border-color:rgba(255,120,105,.35);color:#ffb4aa;background:rgba(255,120,105,.06)}
      .pb3-status.success{border-color:rgba(59,211,126,.32);color:#d9f8e6;background:rgba(59,211,126,.06)}
      .pb3-result{margin-top:18px;padding:18px;border:1px solid rgba(201,169,110,.18);background:rgba(201,169,110,.045);display:none}
      .pb3-result.show{display:block}
      .pb3-download{display:block;margin:12px 0 16px;padding:14px 18px;background:#c9a96e;color:#08070a;text-decoration:none;font-weight:900;letter-spacing:1.7px;text-transform:uppercase;font-size:12px;text-align:center}
      .pb3-report{max-height:370px;overflow:auto;white-space:pre-wrap;color:#ddd2c5;line-height:1.72;font-size:14px;padding-right:4px}
      @media(max-width:640px){.pb3-modal{padding:10px;align-items:center}.pb3-card{max-height:94vh;width:100%}.pb3-grid{grid-template-columns:1fr}.pb3-title{font-size:25px}.pb3-head{padding:22px 18px 16px}.pb3-body{padding:20px 18px 30px}.pb3-close{right:12px;top:12px}.pb3-submit{padding:17px 16px}}
    `;
    document.head.appendChild(style);
  }

  function readKnownValues(){
    var data = {};
    qsa('input, textarea, select').forEach(function(el){
      var key = String(el.name || el.id || el.placeholder || '').toLowerCase();
      var value = String(el.value || '').trim();
      if (!value) return;
      if (!data.name && /name/.test(key)) data.name = value;
      if (!data.email && /email/.test(key)) data.email = value;
      if (!data.phone && /(phone|whatsapp|mobile)/.test(key)) data.phone = value;
      if (!data.dob && /(dob|date of birth|birth date)/.test(key)) data.dob = value;
      if (!data.tob && /(tob|time of birth|birth time)/.test(key)) data.tob = value;
      if (!data.pob && /(pob|place of birth|birth place|city)/.test(key)) data.pob = value;
      if (!data.question && /(question|concern|clarity|focus)/.test(key)) data.question = value;
    });
    return data;
  }

  function ensureModal(){
    injectStyle();
    var modal = document.getElementById('paidBlueprintModalV3');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'pb3-modal';
    modal.id = 'paidBlueprintModalV3';
    modal.innerHTML = `
      <div class="pb3-card" role="dialog" aria-modal="true" aria-labelledby="pb3Title">
        <button class="pb3-close" type="button" id="pb3Close">&times;</button>
        <div class="pb3-head">
          <div class="pb3-kicker">Paid Blueprint Test Mode</div>
          <h2 class="pb3-title" id="pb3Title">Generate the Full Blueprint Report</h2>
          <p class="pb3-sub">Astrology + numerology full report. Payment gateway is skipped for testing right now.</p>
        </div>
        <div class="pb3-body">
          <div id="pb3Form" class="pb3-grid">
            <div class="pb3-field"><label>Full Name</label><input id="pb3Name" autocomplete="name"></div>
            <div class="pb3-field"><label>Email</label><input id="pb3Email" type="email" autocomplete="email"></div>
            <div class="pb3-field"><label>WhatsApp Number</label><input id="pb3Phone" inputmode="tel"></div>
            <div class="pb3-field"><label>Date of Birth</label><input id="pb3Dob" type="date"></div>
            <div class="pb3-field"><label>Time of Birth</label><input id="pb3Tob" type="time"></div>
            <div class="pb3-field"><label>Place of Birth</label><input id="pb3Pob" placeholder="City, State, Country"></div>
            <div class="pb3-field full"><label>Main Concern</label><textarea id="pb3Question" placeholder="Career, marriage, money, business, name correction, health routine, etc."></textarea></div>
            <div class="pb3-actions">
              <button class="pb3-submit" id="pb3Submit" type="button" onclick="window.submitPaidBlueprintV3(event)">Generate Full Blueprint</button>
              <div class="pb3-note">This can take 60 to 120 seconds because it creates a detailed paid report.</div>
              <div class="pb3-status" id="pb3Status"></div>
            </div>
          </div>
          <div class="pb3-result" id="pb3Result">
            <h3 style="margin:0 0 8px;color:#c9a96e;font-family:Georgia,serif;font-size:24px">Your paid report is ready</h3>
            <a class="pb3-download" id="pb3Download" href="#" target="_blank">Download PDF</a>
            <div class="pb3-report" id="pb3Report"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if (e.target === modal) closePaidBlueprintV3(); });
    qs('#pb3Close', modal).addEventListener('click', closePaidBlueprintV3);
    qs('#pb3Submit', modal).addEventListener('click', window.submitPaidBlueprintV3, true);
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePaidBlueprintV3(); });
    return modal;
  }

  function setStatus(message, type){
    var modal = ensureModal();
    var box = qs('#pb3Status', modal);
    box.className = 'pb3-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function openPaidBlueprintV3(){
    var modal = ensureModal();
    var known = readKnownValues();
    if (known.name) qs('#pb3Name', modal).value = known.name;
    if (known.email) qs('#pb3Email', modal).value = known.email;
    if (known.phone) qs('#pb3Phone', modal).value = known.phone;
    if (known.dob) qs('#pb3Dob', modal).value = known.dob;
    if (known.tob) qs('#pb3Tob', modal).value = known.tob;
    if (known.pob) qs('#pb3Pob', modal).value = known.pob;
    if (known.question) qs('#pb3Question', modal).value = known.question;
    qs('#pb3Status', modal).className = 'pb3-status';
    qs('#pb3Result', modal).classList.remove('show');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(function(){ var first = qs('#pb3Name', modal); if (first) first.focus(); }, 120);
  }

  function closePaidBlueprintV3(){
    var modal = document.getElementById('paidBlueprintModalV3');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
  }

  window.submitPaidBlueprintV3 = async function(event){
    if (event) { event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); }
    var modal = ensureModal();
    var button = qs('#pb3Submit', modal);
    var payload = {
      name: qs('#pb3Name', modal).value.trim(),
      email: qs('#pb3Email', modal).value.trim(),
      phone: qs('#pb3Phone', modal).value.trim(),
      dob: qs('#pb3Dob', modal).value,
      tob: qs('#pb3Tob', modal).value,
      pob: qs('#pb3Pob', modal).value.trim(),
      question: qs('#pb3Question', modal).value.trim(),
      source: 'paid_blueprint_button'
    };
    var labels = { name:'Full Name', email:'Email', phone:'WhatsApp Number', dob:'Date of Birth', tob:'Time of Birth', pob:'Place of Birth' };
    var missing = ['name','email','phone','dob','tob','pob'].filter(function(k){ return !payload[k]; });
    if (missing.length) {
      setStatus('Please fill: ' + missing.map(function(k){ return labels[k]; }).join(', '), 'error');
      return false;
    }
    qs('#pb3Result', modal).classList.remove('show');
    button.disabled = true;
    button.textContent = 'Generating... Please wait';
    setStatus('Click received. Generating your full blueprint now. Please keep this window open. This can take 60 to 120 seconds.', '');
    try {
      var res = await fetch('/api/reports/paid-test', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      var raw = await res.text();
      var data;
      try { data = JSON.parse(raw); } catch(e) { data = { error: raw }; }
      if (!res.ok || !data.success) throw new Error(data.error || 'Paid report generation failed.');
      qs('#pb3Download', modal).href = data.pdf_url;
      qs('#pb3Report', modal).textContent = data.report_text || 'Report generated successfully.';
      qs('#pb3Result', modal).classList.add('show');
      setStatus('Report generated successfully. You can download the PDF now.', 'success');
    } catch(error) {
      setStatus(error.message || 'Something went wrong while generating the paid report.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Generate Full Blueprint';
    }
    return false;
  };

  function wireButtons(){
    var keywords = ['get blueprint','full blueprint','advanced report','paid report','go deeper','detailed report'];
    qsa('a, button').forEach(function(el){
      var label = cleanText(el);
      var href = String(el.getAttribute('href') || '').toLowerCase();
      var shouldWire = keywords.some(function(k){ return label.indexOf(k) > -1 || href.indexOf(k.replace(/\s+/g,'-')) > -1; });
      if (!shouldWire) return;
      if (label.indexOf('read my numbers free') > -1 || label.indexOf('free report') > -1 || label.indexOf('whatsapp') > -1) return;
      if (el.__paidBlueprintWiredV3) return;
      el.__paidBlueprintWiredV3 = true;
      el.addEventListener('click', function(e){ e.preventDefault(); e.stopImmediatePropagation(); openPaidBlueprintV3(); return false; }, true);
    });
  }

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('#pb3Submit');
    if (btn) window.submitPaidBlueprintV3(e);
  }, true);

  window.openPaidBlueprint = openPaidBlueprintV3;
  window.openPaidBlueprintV3 = openPaidBlueprintV3;
  window.closePaidBlueprintV3 = closePaidBlueprintV3;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireButtons); else wireButtons();
  setTimeout(wireButtons, 800);
  setTimeout(wireButtons, 2000);
  setInterval(wireButtons, 2500);
})();
