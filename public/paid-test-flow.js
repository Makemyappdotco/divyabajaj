(function(){
  if (window.__paidBlueprintPatchLoaded) return;
  window.__paidBlueprintPatchLoaded = true;

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function txt(el){ return (el && el.textContent || '').trim().toLowerCase(); }

  function readKnownFormValues(){
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
    var existing = document.getElementById('paidBlueprintModal');
    if (existing) return existing;

    var style = document.createElement('style');
    style.id = 'paidBlueprintStyle';
    style.textContent = '\
      .pb-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(12px)}\
      .pb-modal.show{display:flex}\
      .pb-card{width:min(720px,100%);max-height:92vh;overflow:auto;background:linear-gradient(155deg,rgba(18,16,22,.98),rgba(7,6,10,.98));border:1px solid rgba(201,169,110,.28);box-shadow:0 30px 90px rgba(0,0,0,.45);color:#f7efe4;position:relative}\
      .pb-head{padding:24px 24px 12px;border-bottom:1px solid rgba(201,169,110,.12)}\
      .pb-kicker{color:#c9a96e;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px}\
      .pb-title{font-family:Georgia,serif;font-size:30px;line-height:1.08;margin:0 44px 8px 0}\
      .pb-sub{color:#b9afa2;font-size:14px;line-height:1.6;margin:0}\
      .pb-close{position:absolute;right:18px;top:16px;width:40px;height:40px;border-radius:999px;border:1px solid rgba(201,169,110,.25);background:rgba(201,169,110,.06);color:#e7d3a2;font-size:24px;line-height:1;cursor:pointer}\
      .pb-body{padding:22px 24px 24px}\
      .pb-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}\
      .pb-field{display:flex;flex-direction:column;gap:7px}\
      .pb-field.full{grid-column:1/-1}\
      .pb-field label{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#c9a96e;font-weight:700}\
      .pb-field input,.pb-field textarea{background:rgba(255,255,255,.045);border:1px solid rgba(201,169,110,.2);color:#f7efe4;padding:13px 13px;border-radius:0;outline:none;font-size:15px}\
      .pb-field textarea{min-height:82px;resize:vertical}\
      .pb-field input:focus,.pb-field textarea:focus{border-color:rgba(201,169,110,.55);box-shadow:0 0 0 3px rgba(201,169,110,.09)}\
      .pb-actions{display:flex;gap:12px;margin-top:18px;align-items:center}\
      .pb-submit{flex:1;background:linear-gradient(135deg,#c9a96e,#ead39c);color:#08070a;border:0;padding:15px 18px;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;cursor:pointer}\
      .pb-note{font-size:12px;color:#9f9588;line-height:1.45}\
      .pb-result{margin-top:18px;padding:18px;border:1px solid rgba(201,169,110,.18);background:rgba(201,169,110,.045);display:none}\
      .pb-result.show{display:block}\
      .pb-download{display:inline-block;margin:12px 0 14px;padding:13px 18px;background:#c9a96e;color:#08070a;text-decoration:none;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;font-size:12px}\
      .pb-report{max-height:360px;overflow:auto;white-space:pre-wrap;color:#ddd2c5;line-height:1.7;font-size:14px}\
      .pb-error{color:#ffb3a8;font-size:13px;line-height:1.5;margin-top:12px;display:none}\
      .pb-error.show{display:block}\
      @media(max-width:640px){.pb-modal{padding:0;align-items:stretch}.pb-card{max-height:100vh;height:100vh;width:100%}.pb-grid{grid-template-columns:1fr}.pb-title{font-size:25px}.pb-head,.pb-body{padding-left:18px;padding-right:18px}.pb-actions{display:block}.pb-note{margin-top:10px}}\
    ';
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.className = 'pb-modal';
    modal.id = 'paidBlueprintModal';
    modal.innerHTML = '\
      <div class="pb-card" role="dialog" aria-modal="true" aria-labelledby="pbTitle">\
        <button class="pb-close" type="button" id="pbClose">&times;</button>\
        <div class="pb-head">\
          <div class="pb-kicker">Full Blueprint Test Mode</div>\
          <h2 class="pb-title" id="pbTitle">Generate paid Astrology + Numerology report</h2>\
          <p class="pb-sub">Payment gateway is skipped for testing. This will generate the complete paid report.</p>\
        </div>\
        <div class="pb-body">\
          <form id="pbForm" class="pb-grid">\
            <div class="pb-field"><label>Full Name</label><input name="name" id="pbName" required></div>\
            <div class="pb-field"><label>Email</label><input name="email" id="pbEmail" type="email" required></div>\
            <div class="pb-field"><label>WhatsApp Number</label><input name="phone" id="pbPhone" required></div>\
            <div class="pb-field"><label>Date of Birth</label><input name="dob" id="pbDob" type="date" required></div>\
            <div class="pb-field"><label>Time of Birth</label><input name="tob" id="pbTob" type="time" required></div>\
            <div class="pb-field"><label>Place of Birth</label><input name="pob" id="pbPob" placeholder="City, State, Country" required></div>\
            <div class="pb-field full"><label>Main Concern</label><textarea name="question" id="pbQuestion" placeholder="Career, marriage, money, business, health routine, name correction, etc."></textarea></div>\
            <div class="pb-field full">\
              <div class="pb-actions">\
                <button class="pb-submit" id="pbSubmit" type="submit">Generate Full Blueprint</button>\
                <div class="pb-note">This may take 60 to 120 seconds because it generates a detailed paid report.</div>\
              </div>\
              <div class="pb-error" id="pbError"></div>\
            </div>\
          </form>\
          <div class="pb-result" id="pbResult">\
            <h3>Your paid report is ready</h3>\
            <a class="pb-download" id="pbDownload" href="#" target="_blank">Download PDF</a>\
            <div class="pb-report" id="pbReport"></div>\
          </div>\
        </div>\
      </div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if (e.target === modal) closePaidBlueprint(); });
    qs('#pbClose', modal).addEventListener('click', closePaidBlueprint);
    qs('#pbForm', modal).addEventListener('submit', submitPaidBlueprint);
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePaidBlueprint(); });
    return modal;
  }

  function openPaidBlueprint(){
    var modal = ensureModal();
    var known = readKnownFormValues();
    if (known.name) qs('#pbName', modal).value = known.name;
    if (known.email) qs('#pbEmail', modal).value = known.email;
    if (known.phone) qs('#pbPhone', modal).value = known.phone;
    if (known.dob) qs('#pbDob', modal).value = known.dob;
    if (known.tob) qs('#pbTob', modal).value = known.tob;
    if (known.pob) qs('#pbPob', modal).value = known.pob;
    if (known.question) qs('#pbQuestion', modal).value = known.question;
    qs('#pbError', modal).classList.remove('show');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closePaidBlueprint(){ var modal = document.getElementById('paidBlueprintModal'); if (modal) modal.classList.remove('show'); document.body.style.overflow = ''; }

  async function submitPaidBlueprint(e){
    e.preventDefault();
    var modal = ensureModal();
    var button = qs('#pbSubmit', modal);
    var err = qs('#pbError', modal);
    var resultBox = qs('#pbResult', modal);
    var payload = {
      name: qs('#pbName', modal).value.trim(),
      email: qs('#pbEmail', modal).value.trim(),
      phone: qs('#pbPhone', modal).value.trim(),
      dob: qs('#pbDob', modal).value,
      tob: qs('#pbTob', modal).value,
      pob: qs('#pbPob', modal).value.trim(),
      question: qs('#pbQuestion', modal).value.trim(),
      source: 'paid_blueprint_button'
    };
    var missing = ['name','email','phone','dob','tob','pob'].filter(function(k){ return !payload[k]; });
    if (missing.length) { err.textContent = 'Please fill: ' + missing.join(', '); err.classList.add('show'); return; }
    err.classList.remove('show');
    resultBox.classList.remove('show');
    button.disabled = true;
    button.textContent = 'Generating full report...';
    try {
      var res = await fetch('/api/reports/paid-test', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Paid report generation failed');
      qs('#pbDownload', modal).href = data.pdf_url;
      qs('#pbReport', modal).textContent = data.report_text || 'Report generated successfully.';
      resultBox.classList.add('show');
    } catch(error) {
      err.textContent = error.message || 'Something went wrong.';
      err.classList.add('show');
    } finally {
      button.disabled = false;
      button.textContent = 'Generate Full Blueprint';
    }
  }

  function wirePaidButtons(){
    var keywords = ['get blueprint','full blueprint','advanced report','paid report','go deeper','detailed report'];
    qsa('a, button').forEach(function(el){
      var label = txt(el);
      var href = String(el.getAttribute('href') || '').toLowerCase();
      var shouldWire = keywords.some(function(k){ return label.indexOf(k) > -1 || href.indexOf(k.replace(/\s+/g,'-')) > -1; });
      if (!shouldWire) return;
      if (label.indexOf('read my numbers free') > -1 || label.indexOf('free report') > -1 || label.indexOf('whatsapp') > -1) return;
      if (el.__paidBlueprintWired) return;
      el.__paidBlueprintWired = true;
      el.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openPaidBlueprint(); }, true);
    });
  }

  window.openPaidBlueprint = openPaidBlueprint;
  document.addEventListener('DOMContentLoaded', function(){ wirePaidButtons(); setTimeout(wirePaidButtons, 1000); setTimeout(wirePaidButtons, 3000); });
  if (document.readyState !== 'loading') wirePaidButtons();
  setInterval(wirePaidButtons, 2500);
})();
