(function () {
  'use strict';

  if (window.__divyaPaidLiveFlow) return;
  window.__divyaPaidLiveFlow = true;

  var state = {
    generating: false,
    selectedLocation: null,
    locationTimer: null,
    locationRequest: 0,
    progressTimer: null,
    pdfPayload: null
  };

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function textOf(el) { return String((el && el.textContent) || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function injectStyles() {
    if (document.getElementById('dbPaidLiveStyles')) return;
    var style = document.createElement('style');
    style.id = 'dbPaidLiveStyles';
    style.textContent = `
      .dbp-overlay{position:fixed;inset:0;z-index:10000000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(5,4,7,.86);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
      .dbp-overlay.is-open{display:flex}
      .dbp-shell{position:relative;width:min(1040px,100%);max-height:min(92vh,900px);overflow:hidden;border:1px solid rgba(201,169,110,.28);background:#0c0a0f;box-shadow:0 40px 120px rgba(0,0,0,.66);color:#f8f1e7}
      .dbp-close{position:absolute;z-index:6;right:18px;top:18px;width:42px;height:42px;border-radius:50%;border:1px solid rgba(201,169,110,.32);background:rgba(255,255,255,.035);color:#ead39c;font-size:25px;line-height:1;cursor:pointer;display:grid;place-items:center}
      .dbp-close:hover{background:rgba(201,169,110,.11)}
      .dbp-layout{display:grid;grid-template-columns:330px minmax(0,1fr);max-height:min(92vh,900px)}
      .dbp-aside{position:relative;overflow:hidden;padding:42px 32px;background:radial-gradient(circle at 15% 5%,rgba(201,169,110,.19),transparent 32%),linear-gradient(165deg,#18141b,#0a090d 72%);border-right:1px solid rgba(201,169,110,.18)}
      .dbp-aside:after{content:'';position:absolute;width:280px;height:280px;border:1px solid rgba(201,169,110,.08);border-radius:50%;right:-155px;bottom:-120px;box-shadow:0 0 0 35px rgba(201,169,110,.025),0 0 0 70px rgba(201,169,110,.018)}
      .dbp-brand{font-size:10px;letter-spacing:2.8px;color:#c9a96e;font-weight:800;text-transform:uppercase;margin-bottom:34px}
      .dbp-price-tag{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(201,169,110,.25);background:rgba(201,169,110,.07);padding:8px 11px;color:#e6cf9a;font-size:10px;letter-spacing:1.7px;text-transform:uppercase;font-weight:800}
      .dbp-price-tag:before{content:'';width:7px;height:7px;border-radius:50%;background:#37d47c;box-shadow:0 0 13px rgba(55,212,124,.55)}
      .dbp-aside h2{font-family:Fraunces,Georgia,serif;font-size:36px;line-height:1.06;margin:20px 0 14px;color:#fff9ef;font-weight:600}
      .dbp-aside-copy{color:#bdb2a5;font-size:14px;line-height:1.65;margin-bottom:28px}
      .dbp-benefits{display:grid;gap:12px;margin-top:24px}
      .dbp-benefit{display:grid;grid-template-columns:25px 1fr;gap:10px;align-items:start;color:#e8ded2;font-size:13px;line-height:1.45}
      .dbp-benefit i{font-style:normal;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:rgba(201,169,110,.12);color:#d8ba7c;font-size:11px}
      .dbp-trust{margin-top:32px;padding-top:18px;border-top:1px solid rgba(201,169,110,.13);font-size:11px;color:#8f8579;line-height:1.55}
      .dbp-main{overflow:auto;padding:38px 42px 42px;background:radial-gradient(circle at 100% 0,rgba(201,169,110,.06),transparent 24%),#0d0b10}
      .dbp-main-head{padding-right:55px;margin-bottom:24px}
      .dbp-eyebrow{font-size:10px;letter-spacing:2.1px;color:#c9a96e;font-weight:800;text-transform:uppercase;margin-bottom:8px}
      .dbp-main h3{font-family:Fraunces,Georgia,serif;font-size:28px;line-height:1.15;color:#fff7ec;margin:0 0 8px;font-weight:600}
      .dbp-main-head p{font-size:13px;color:#9e9488;line-height:1.55;margin:0}
      .dbp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .dbp-field{position:relative;display:flex;flex-direction:column;gap:7px;min-width:0}
      .dbp-field.full{grid-column:1/-1}
      .dbp-label{display:flex;justify-content:space-between;gap:8px;font-size:10px;letter-spacing:1.35px;text-transform:uppercase;color:#d4b477;font-weight:800}
      .dbp-optional{color:#71695f;font-weight:500;letter-spacing:.7px}
      .dbp-input,.dbp-select,.dbp-textarea{width:100%;height:50px;border:1px solid rgba(201,169,110,.23);background:rgba(255,255,255,.035);color:#f7efe5;padding:0 15px;font:500 15px/1.3 'Hanken Grotesk',system-ui,sans-serif;outline:none;border-radius:0;transition:border-color .2s,box-shadow .2s,background .2s}
      .dbp-textarea{height:92px;padding-top:14px;resize:vertical}
      .dbp-select{appearance:auto;color-scheme:dark}
      .dbp-select option{background:#151219;color:#f7efe5}
      .dbp-input::placeholder,.dbp-textarea::placeholder{color:rgba(232,226,216,.34);opacity:1}
      .dbp-input:focus,.dbp-select:focus,.dbp-textarea:focus{border-color:#c9a96e;background:rgba(201,169,110,.055);box-shadow:0 0 0 3px rgba(201,169,110,.09)}
      .dbp-field.has-error .dbp-input,.dbp-field.has-error .dbp-select,.dbp-field.has-error .dbp-textarea{border-color:#e37c70;box-shadow:0 0 0 3px rgba(227,124,112,.08)}
      .dbp-error{display:none;color:#ffaaa0;font-size:11px;line-height:1.35}
      .dbp-field.has-error .dbp-error{display:block}
      .dbp-help{font-size:11px;color:#797168;line-height:1.4}
      .dbp-location-status{font-size:11px;color:#8e857b;line-height:1.35;min-height:15px}
      .dbp-location-status.ok{color:#98ddb7}.dbp-location-status.error{color:#ffaaa0}
      .dbp-suggestions{position:absolute;left:0;right:0;top:74px;z-index:30;display:none;max-height:250px;overflow:auto;border:1px solid rgba(201,169,110,.34);background:#141117;box-shadow:0 20px 55px rgba(0,0,0,.55)}
      .dbp-suggestions.show{display:block}
      .dbp-suggestion{display:block;width:100%;padding:12px 14px;text-align:left;border:0;border-bottom:1px solid rgba(201,169,110,.11);background:transparent;color:#eee3d7;font:inherit;cursor:pointer}
      .dbp-suggestion:hover,.dbp-suggestion:focus{background:rgba(201,169,110,.11);outline:none}
      .dbp-suggestion small{display:block;color:#8f867c;font-size:11px;margin-top:3px}
      .dbp-actions{grid-column:1/-1;margin-top:5px;padding-top:18px;border-top:1px solid rgba(201,169,110,.11)}
      .dbp-submit,.dbp-download{width:100%;border:0;padding:17px 20px;background:linear-gradient(135deg,#c9a96e,#ead39c);color:#09070a;font:900 11px/1.2 'Hanken Grotesk',system-ui,sans-serif;letter-spacing:1.8px;text-transform:uppercase;cursor:pointer;box-shadow:0 15px 40px rgba(201,169,110,.13)}
      .dbp-submit:disabled,.dbp-download:disabled{opacity:.6;cursor:wait}
      .dbp-status{display:none;margin-top:12px;padding:12px 14px;border:1px solid rgba(201,169,110,.18);background:rgba(201,169,110,.04);color:#d2c6b9;font-size:12px;line-height:1.5;white-space:pre-wrap}
      .dbp-status.show{display:block}.dbp-status.error{border-color:rgba(227,124,112,.35);color:#ffaaa0;background:rgba(227,124,112,.06)}.dbp-status.success{border-color:rgba(55,212,124,.3);color:#b6edcc;background:rgba(55,212,124,.055)}
      .dbp-result{display:none;margin-top:22px;padding-top:22px;border-top:1px solid rgba(201,169,110,.14)}
      .dbp-result.show{display:block}
      .dbp-result h4{font-family:Fraunces,Georgia,serif;font-size:25px;color:#fff6e9;margin:0 0 6px}
      .dbp-result-lead{font-size:13px;color:#9e9488;line-height:1.55;margin-bottom:14px}
      .dbp-download{display:block;text-align:center;text-decoration:none;margin-bottom:14px}
      .dbp-report{max-height:340px;overflow:auto;padding:18px;border:1px solid rgba(201,169,110,.14);background:rgba(255,255,255,.025);white-space:pre-wrap;color:#d8cec1;font-size:13px;line-height:1.65}
      .dbp-upsell{margin-top:16px;padding:20px;border:1px solid rgba(201,169,110,.28);background:linear-gradient(145deg,rgba(201,169,110,.105),rgba(201,169,110,.025));text-align:center}
      .dbp-upsell strong{display:block;font-family:Fraunces,Georgia,serif;font-size:22px;color:#fff5e6;margin:6px 0 7px}
      .dbp-upsell p{font-size:12px;color:#a99f92;line-height:1.55;margin:0 0 13px}
      .dbp-meta{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin-bottom:12px}.dbp-meta span{padding:6px 9px;border:1px solid rgba(201,169,110,.22);color:#e6cc94;font-size:10px}
      .dbp-consult{display:block;padding:14px 16px;background:#c9a96e;color:#08070a;text-decoration:none;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:1.4px}
      body.dbp-lock{overflow:hidden!important}
      @media(max-width:820px){
        .dbp-overlay{padding:0;align-items:stretch}
        .dbp-shell{max-height:none;height:100dvh;width:100%;border:0}
        .dbp-layout{display:block;max-height:none;height:100%;overflow:auto}
        .dbp-aside{padding:26px 22px 22px;border-right:0;border-bottom:1px solid rgba(201,169,110,.17)}
        .dbp-brand{margin-bottom:18px}.dbp-aside h2{font-size:30px;margin:15px 0 10px}.dbp-aside-copy{margin-bottom:16px}.dbp-benefits{grid-template-columns:1fr 1fr;gap:9px}.dbp-benefit{font-size:11px}.dbp-trust{display:none}
        .dbp-main{overflow:visible;padding:26px 20px 36px}.dbp-main-head{padding-right:44px;margin-bottom:20px}.dbp-main h3{font-size:25px}.dbp-grid{grid-template-columns:1fr;gap:15px}.dbp-field.full,.dbp-actions{grid-column:auto}.dbp-close{right:13px;top:13px;background:#151219}
        .dbp-input,.dbp-select{height:54px;font-size:16px}.dbp-textarea{font-size:16px}.dbp-suggestions{top:78px}.dbp-report{max-height:none}
      }
      @media(max-width:430px){.dbp-benefits{grid-template-columns:1fr}.dbp-aside{padding-top:24px}.dbp-price-tag{font-size:9px}.dbp-aside h2{font-size:28px}}
    `;
    document.head.appendChild(style);
  }

  function modalHtml() {
    return `
      <div class="dbp-shell" role="dialog" aria-modal="true" aria-labelledby="dbpTitle">
        <button class="dbp-close" type="button" data-dbp-action="close" aria-label="Close">&times;</button>
        <div class="dbp-layout">
          <aside class="dbp-aside">
            <div class="dbp-brand">Divya Bajaj · Astro-Numerologist</div>
            <div class="dbp-price-tag">The Full Blueprint · ₹999</div>
            <h2>Your chart.<br>Your numbers.<br>One clear blueprint.</h2>
            <p class="dbp-aside-copy">A personalised astrology and numerology report created from your exact birth details, verified location, planetary chart and current Dasha.</p>
            <div class="dbp-benefits">
              <div class="dbp-benefit"><i>✓</i><span>Birth chart and key planetary patterns</span></div>
              <div class="dbp-benefit"><i>✓</i><span>Current Dasha and practical guidance</span></div>
              <div class="dbp-benefit"><i>✓</i><span>Career, money and relationship insights</span></div>
              <div class="dbp-benefit"><i>✓</i><span>30-day personalised action plan</span></div>
            </div>
            <div class="dbp-trust">Private and personalised. Your details are used only to prepare your report.</div>
          </aside>
          <main class="dbp-main">
            <div class="dbp-main-head">
              <div class="dbp-eyebrow">Create your personalised report</div>
              <h3 id="dbpTitle">Enter your birth details</h3>
              <p>Please use accurate information. Your date, time and birthplace directly affect the chart calculations.</p>
            </div>
            <form id="dbpForm" novalidate>
              <div class="dbp-grid">
                ${field('name','Full name','text','Enter your full name','name')}
                ${selectField('gender','Gender','<option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option>')}
                ${field('email','Email address','email','you@example.com','email')}
                ${field('phone','WhatsApp number','tel','98765 43210','tel')}
                ${field('dob','Date of birth','text','DD/MM/YYYY','numeric')}
                ${field('tob','Time of birth','text','HH:MM','numeric')}
                ${selectField('accuracy','Birth time accuracy','<option value="">Select accuracy</option><option value="exact_record">Exact, from records</option><option value="family_confirmed">Confirmed by family</option><option value="approximate">Approximate</option>', 'Exact time gives more reliable houses and divisional charts.')}
                <div class="dbp-field" data-field="pob">
                  <label class="dbp-label" for="dbpPob">Place of birth</label>
                  <input class="dbp-input" id="dbpPob" type="text" autocomplete="off" placeholder="Type city, state or country">
                  <div class="dbp-suggestions" id="dbpSuggestions"></div>
                  <div class="dbp-location-status" id="dbpLocationStatus">Choose a location from the suggestions.</div>
                  <div class="dbp-error"></div>
                </div>
                <div class="dbp-field full" data-field="question">
                  <label class="dbp-label" for="dbpQuestion">Main concern</label>
                  <textarea class="dbp-textarea" id="dbpQuestion" placeholder="For example: career direction, business growth, marriage, money or overall life clarity"></textarea>
                  <div class="dbp-error"></div>
                </div>
                <div class="dbp-actions">
                  <button class="dbp-submit" id="dbpSubmit" type="submit">Generate My Full Blueprint</button>
                  <div class="dbp-status" id="dbpStatus" role="status" aria-live="polite"></div>
                </div>
              </div>
            </form>
            <section class="dbp-result" id="dbpResult">
              <h4>Your Full Blueprint is ready</h4>
              <p class="dbp-result-lead">Download the PDF first. Your complete written reading is also available below.</p>
              <button class="dbp-download" id="dbpDownload" type="button">Download Full Blueprint PDF</button>
              <div class="dbp-report" id="dbpReport"></div>
              <div class="dbp-upsell">
                <div class="dbp-eyebrow">Need a deeper personal answer?</div>
                <strong>Book a one-to-one consultation with Divya</strong>
                <p>Discuss exact timing, compare real choices and apply the report to your present situation.</p>
                <div class="dbp-meta"><span>₹4,999</span><span>60 minutes</span><span>Phone or video</span></div>
                <a class="dbp-consult" href="/consultation" target="_blank" rel="noopener">Book Personal Consultation</a>
              </div>
            </section>
          </main>
        </div>
      </div>`;
  }

  function field(name, label, type, placeholder, inputmode) {
    return `<div class="dbp-field" data-field="${name}">
      <label class="dbp-label" for="dbp-${name}">${label}</label>
      <input class="dbp-input" id="dbp-${name}" type="${type}" placeholder="${placeholder}"${inputmode ? ` inputmode="${inputmode}"` : ''} autocomplete="${name === 'phone' ? 'tel' : name}">
      <div class="dbp-error"></div>
    </div>`;
  }

  function selectField(name, label, options, help) {
    return `<div class="dbp-field" data-field="${name}">
      <label class="dbp-label" for="dbp-${name}">${label}</label>
      <select class="dbp-select" id="dbp-${name}">${options}</select>
      ${help ? `<div class="dbp-help">${help}</div>` : ''}
      <div class="dbp-error"></div>
    </div>`;
  }

  function ensureModal() {
    injectStyles();
    var overlay = document.getElementById('dbpOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'dbpOverlay';
    overlay.className = 'dbp-overlay';
    overlay.innerHTML = modalHtml();
    document.body.appendChild(overlay);

    qs('#dbpForm', overlay).addEventListener('submit', submitReport);
    qs('#dbpDownload', overlay).addEventListener('click', downloadPdf);
    qs('#dbpPob', overlay).addEventListener('input', onLocationInput);
    qs('#dbp-dob', overlay).addEventListener('input', function (event) { event.target.value = formatDate(event.target.value); clearFieldError('dob'); });
    qs('#dbp-tob', overlay).addEventListener('input', function (event) { event.target.value = formatTime(event.target.value); clearFieldError('tob'); });
    ['name','email','phone','gender','accuracy','question'].forEach(function (name) {
      var el = qs(name === 'question' ? '#dbpQuestion' : '#dbp-' + name, overlay);
      if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () { clearFieldError(name); });
    });
    return overlay;
  }

  function openModal() {
    var overlay = ensureModal();
    overlay.classList.add('is-open');
    document.body.classList.add('dbp-lock');
    setTimeout(function () { var el = qs('#dbp-name', overlay); if (el) el.focus({ preventScroll:true }); }, 80);
  }

  function closeModal() {
    if (state.generating) {
      setStatus('Your report is still being prepared. Please wait until it finishes.', '');
      return;
    }
    var overlay = document.getElementById('dbpOverlay');
    if (overlay) overlay.classList.remove('is-open');
    document.body.classList.remove('dbp-lock');
  }

  function formatDate(value) {
    var d = digits(value).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0,2) + '/' + d.slice(2);
    return d.slice(0,2) + '/' + d.slice(2,4) + '/' + d.slice(4);
  }

  function formatTime(value) {
    var d = digits(value).slice(0, 4);
    if (d.length <= 2) return d;
    return d.slice(0,2) + ':' + d.slice(2);
  }

  function parseDate(value) {
    var match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    var day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    var today = new Date();
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    if (year < 1900 || date > today) return null;
    return year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0');
  }

  function validTime(value) {
    var match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    return !!match && Number(match[1]) >= 0 && Number(match[1]) <= 23 && Number(match[2]) >= 0 && Number(match[2]) <= 59;
  }

  function setFieldError(name, message) {
    var field = qs('.dbp-field[data-field="' + name + '"]', ensureModal());
    if (!field) return;
    field.classList.add('has-error');
    var error = qs('.dbp-error', field);
    if (error) error.textContent = message;
    var control = qs('input,select,textarea', field);
    if (control) control.setAttribute('aria-invalid','true');
  }

  function clearFieldError(name) {
    var field = qs('.dbp-field[data-field="' + name + '"]', ensureModal());
    if (!field) return;
    field.classList.remove('has-error');
    var control = qs('input,select,textarea', field);
    if (control) control.removeAttribute('aria-invalid');
  }

  function setStatus(message, type) {
    var box = qs('#dbpStatus', ensureModal());
    box.className = 'dbp-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function setLocationStatus(message, type) {
    var box = qs('#dbpLocationStatus', ensureModal());
    box.className = 'dbp-location-status' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function onLocationInput(event) {
    state.selectedLocation = null;
    clearFieldError('pob');
    setLocationStatus('Choose a location from the suggestions.', '');
    clearTimeout(state.locationTimer);
    var query = event.target.value.trim();
    if (query.length < 2) { hideSuggestions(); return; }
    state.locationTimer = setTimeout(function () { searchLocations(query); }, 300);
  }

  async function searchLocations(query) {
    var requestId = ++state.locationRequest;
    setLocationStatus('Searching accurate locations...', '');
    try {
      var response = await fetch('/api/locations/search?q=' + encodeURIComponent(query), { cache:'no-store' });
      var data = await response.json();
      if (requestId !== state.locationRequest) return;
      if (!response.ok || data.success === false) throw new Error(data.error || 'Location search failed');
      renderSuggestions(data.locations || []);
    } catch (error) {
      if (requestId !== state.locationRequest) return;
      hideSuggestions();
      setLocationStatus(error.message || 'Could not search locations.', 'error');
    }
  }

  function renderSuggestions(locations) {
    var box = qs('#dbpSuggestions', ensureModal());
    box.innerHTML = '';
    if (!locations.length) {
      setLocationStatus('No location found. Add the state or country and try again.', 'error');
      return;
    }
    locations.forEach(function (location) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'dbp-suggestion';
      button.innerHTML = '<strong>' + escapeHtml(location.place_name) + '</strong><small>' + escapeHtml([location.country_code, location.timezone_id].filter(Boolean).join(' · ')) + '</small>';
      button.addEventListener('click', function () { selectLocation(location); });
      box.appendChild(button);
    });
    box.classList.add('show');
  }

  function hideSuggestions() {
    var box = qs('#dbpSuggestions', document);
    if (!box) return;
    box.classList.remove('show');
    box.innerHTML = '';
  }

  async function selectLocation(location) {
    state.selectedLocation = location;
    qs('#dbpPob', ensureModal()).value = location.place_name;
    hideSuggestions();
    setLocationStatus('Location selected. Verifying the historical timezone...', '');
    clearFieldError('pob');
    await resolveTimezone();
  }

  async function resolveTimezone() {
    if (!state.selectedLocation) return;
    var isoDob = parseDate(qs('#dbp-dob', ensureModal()).value);
    if (!isoDob) {
      setLocationStatus('Location selected. Add a valid date of birth to verify timezone.', '');
      return;
    }
    try {
      var response = await fetch('/api/locations/timezone', {
        method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
        body:JSON.stringify({ latitude:state.selectedLocation.latitude, longitude:state.selectedLocation.longitude, dob:isoDob })
      });
      var data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.error || 'Timezone lookup failed');
      state.selectedLocation.timezone = Number(data.timezone);
      setLocationStatus('Verified: ' + state.selectedLocation.place_name + ' · UTC ' + (state.selectedLocation.timezone >= 0 ? '+' : '') + state.selectedLocation.timezone, 'ok');
    } catch (error) {
      state.selectedLocation.timezone = null;
      setLocationStatus(error.message || 'Could not verify timezone.', 'error');
    }
  }

  function validateForm() {
    var overlay = ensureModal();
    var values = {
      name: qs('#dbp-name', overlay).value.trim(),
      gender: qs('#dbp-gender', overlay).value,
      email: qs('#dbp-email', overlay).value.trim(),
      phone: qs('#dbp-phone', overlay).value.trim(),
      dobDisplay: qs('#dbp-dob', overlay).value.trim(),
      tob: qs('#dbp-tob', overlay).value.trim(),
      accuracy: qs('#dbp-accuracy', overlay).value,
      pob: qs('#dbpPob', overlay).value.trim(),
      question: qs('#dbpQuestion', overlay).value.trim()
    };
    var errors = {};
    if (!/^[A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{1,79}$/.test(values.name)) errors.name = 'Enter a valid full name.';
    if (!values.gender) errors.gender = 'Select gender.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) errors.email = 'Enter a valid email address.';
    var phoneDigits = digits(values.phone);
    if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = 'Enter a valid WhatsApp number with 10 to 15 digits.';
    var isoDob = parseDate(values.dobDisplay);
    if (!isoDob) errors.dob = 'Use a valid date in DD/MM/YYYY format.';
    if (!validTime(values.tob)) errors.tob = 'Use a valid time in HH:MM format.';
    if (!values.accuracy) errors.accuracy = 'Select birth time accuracy.';
    if (!state.selectedLocation) errors.pob = 'Select the birthplace from the suggestions.';
    else if (!Number.isFinite(Number(state.selectedLocation.timezone))) errors.pob = 'Wait for the location and timezone to be verified.';
    if (values.question.length < 5) errors.question = 'Tell us your main concern in at least a few words.';

    ['name','gender','email','phone','dob','tob','accuracy','pob','question'].forEach(clearFieldError);
    Object.keys(errors).forEach(function (name) { setFieldError(name, errors[name]); });
    if (Object.keys(errors).length) {
      var first = qs('.dbp-field.has-error input,.dbp-field.has-error select,.dbp-field.has-error textarea', overlay);
      if (first) first.focus({ preventScroll:false });
      setStatus('Please correct the highlighted information before continuing.', 'error');
      return null;
    }

    return {
      name: values.name,
      gender: values.gender,
      email: values.email,
      phone: values.phone,
      dob: isoDob,
      tob: values.tob,
      birth_time_accuracy: values.accuracy,
      pob: values.pob,
      latitude: state.selectedLocation.latitude,
      longitude: state.selectedLocation.longitude,
      timezone: state.selectedLocation.timezone,
      timezone_id: state.selectedLocation.timezone_id || '',
      country_code: state.selectedLocation.country_code || '',
      question: values.question,
      include_source_pdfs: false,
      source: 'paid_blueprint_live'
    };
  }

  function setGenerating(value) {
    state.generating = value;
    var button = qs('#dbpSubmit', ensureModal());
    button.disabled = value;
    button.textContent = value ? 'Preparing Your Full Blueprint...' : 'Generate My Full Blueprint';
  }

  function startProgress() {
    var messages = [
      'Verifying your birthplace and historical timezone...',
      'Calculating planetary positions and divisional charts...',
      'Reading your current Vimshottari Dasha...',
      'Calculating your numerology profile...',
      'Connecting the patterns with your main concern...',
      'Writing and checking your personalised report...'
    ];
    var index = 0;
    setStatus(messages[0], '');
    clearInterval(state.progressTimer);
    state.progressTimer = setInterval(function () {
      index = Math.min(index + 1, messages.length - 1);
      setStatus(messages[index], '');
    }, 17000);
  }

  function stopProgress() { clearInterval(state.progressTimer); state.progressTimer = null; }

  async function submitReport(event) {
    event.preventDefault();
    if (state.generating) return;
    var payload = validateForm();
    if (!payload) return;

    var overlay = ensureModal();
    qs('#dbpResult', overlay).classList.remove('show');
    state.pdfPayload = null;
    setGenerating(true);
    startProgress();
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 300000);

    try {
      var response = await fetch('/api/reports/paid-test-v2', {
        method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store', signal:controller.signal,
        body:JSON.stringify(payload)
      });
      var raw = await response.text();
      var data;
      try { data = raw ? JSON.parse(raw) : {}; } catch (error) { data = { error:raw || 'Invalid server response' }; }
      if (!response.ok || data.success === false) throw new Error(data.error || 'Could not generate the report.');
      if (!data.report_text) throw new Error('The report service returned no report content.');

      state.pdfPayload = {
        lead:payload,
        numbers:data.numbers || {},
        astrology_data:data.astrology_data || null,
        report_text:data.report_text,
        report_type:'paid_blueprint_live'
      };
      qs('#dbpReport', overlay).textContent = data.report_text;
      qs('#dbpResult', overlay).classList.add('show');
      setStatus('Your verified Full Blueprint is ready.', 'success');
      setTimeout(function () { qs('#dbpResult', overlay).scrollIntoView({ behavior:'smooth', block:'start' }); }, 100);
    } catch (error) {
      setStatus(error && error.name === 'AbortError' ? 'The report took longer than expected. Please try again.' : (error.message || 'Could not generate the report.'), 'error');
    } finally {
      clearTimeout(timeout);
      stopProgress();
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!state.pdfPayload) { setStatus('Generate the report first.', 'error'); return; }
    var button = qs('#dbpDownload', ensureModal());
    var old = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing Your PDF...';
    setStatus('Preparing your branded PDF...', '');
    try {
      var response = await fetch('/api/reports/pdf-direct', {
        method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store', body:JSON.stringify(state.pdfPayload)
      });
      if (!response.ok) {
        var raw = await response.text();
        try { raw = JSON.parse(raw).error || raw; } catch (error) {}
        throw new Error(raw || 'Could not prepare the PDF.');
      }
      var blob = await response.blob();
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      var safeName = String(state.pdfPayload.lead.name || 'Divya-Bajaj').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
      link.href = url;
      link.download = safeName + '-Full-Blueprint.pdf';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      setStatus('Your Full Blueprint PDF has been downloaded.', 'success');
    } catch (error) {
      setStatus(error.message || 'Could not download the PDF.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function isPaidCta(el) {
    if (!el || el.closest('#dbpOverlay')) return false;
    var label = textOf(el);
    var href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    if (/free report|read my numbers free|whatsapp/.test(label)) return false;
    return /get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label + ' ' + href);
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;
    if (target.matches('[data-dbp-action="close"]')) { event.preventDefault(); closeModal(); return; }
    if (isPaidCta(target)) { event.preventDefault(); event.stopPropagation(); openModal(); }
  }, true);
  document.addEventListener('click', function (event) {
    var overlay = document.getElementById('dbpOverlay');
    if (overlay && event.target === overlay) closeModal();
    if (!event.target.closest('#dbpPob') && !event.target.closest('#dbpSuggestions')) hideSuggestions();
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeModal(); });

  window.openPaidBlueprint = openModal;
  window.openPaidBlueprintV4 = openModal;
})();
