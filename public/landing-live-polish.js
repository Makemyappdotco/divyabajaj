(function () {
  'use strict';

  if (window.__divyaLandingLivePolishV3) return;
  window.__divyaLandingLivePolishV3 = true;

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function injectStyles() {
    if (document.getElementById('dbLandingPolishStylesV3')) return;

    ['dbLandingPolishStyles', 'dbLandingPolishStylesV2'].forEach(function (id) {
      var oldStyle = document.getElementById(id);
      if (oldStyle) oldStyle.remove();
    });

    var style = document.createElement('style');
    style.id = 'dbLandingPolishStylesV3';
    style.textContent = `
      html{scroll-padding-top:90px}
      body{overflow-x:clip}
      input::placeholder,textarea::placeholder{opacity:1}
      .db-field-error{display:none;margin-top:7px;color:#ffaaa0;font-size:11px;line-height:1.35;text-align:left}
      .db-field-error.show{display:block}
      .db-invalid{border-color:#e37c70!important;box-shadow:0 0 0 3px rgba(227,124,112,.09)!important}
      .db-dob-display{width:100%!important;color:var(--text)!important;background:transparent!important}
      .db-dob-display::placeholder{color:var(--text-s)!important;opacity:1!important}
      .pricing-tags-balanced{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%!important;align-items:stretch!important;justify-content:stretch!important}
      .pricing-tags-balanced>*{display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;min-width:0!important;min-height:34px!important;margin:0!important;padding:7px 9px!important;line-height:1.25!important}
      .pricing-tags-balanced>*:last-child:nth-child(odd){grid-column:1/-1!important}
      .hero .wrap{width:100%!important;max-width:1280px!important;margin-left:auto!important;margin-right:auto!important;padding-left:clamp(24px,4.5vw,68px)!important;padding-right:clamp(24px,4.5vw,68px)!important}
      .hero .hero-inner,.hero .hero-grid{width:100%!important;margin-left:auto!important;margin-right:auto!important}
      .hero .hero-content,.hero .hero-copy{margin-left:0!important}

      #faq .faq-list{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;border-radius:0!important}

      body.light #pricing .price-row>.pcard:nth-child(2) .pcard-save{
        background:#e3f2e6!important;
        color:#176537!important;
        border:1px solid rgba(23,101,55,.24)!important;
        box-shadow:0 5px 14px rgba(23,101,55,.07)!important;
      }
      body.light #pricing .price-row>.pcard:nth-child(3) .pcard-slots{
        width:max-content!important;
        max-width:100%!important;
        padding:6px 9px!important;
        color:#963f36!important;
        background:#fff0ec!important;
        border:1px solid rgba(150,63,54,.22)!important;
        font-weight:700!important;
        letter-spacing:.15px!important;
      }
      body.light #pricing .price-row>.pcard:nth-child(3) .pcard-slots .slot-dot{
        background:#b64e43!important;
        box-shadow:0 0 0 4px rgba(182,78,67,.09)!important;
      }

      body.light #dbpOverlay.dbp-overlay{background:rgba(68,52,38,.42)!important}
      body.light #dbpOverlay .dbp-shell{background:#fffaf1!important;border-color:rgba(151,116,56,.35)!important;box-shadow:0 36px 100px rgba(74,54,35,.24)!important;color:#2b2118!important}
      body.light #dbpOverlay .dbp-close{border-color:rgba(145,108,49,.32)!important;background:rgba(255,250,241,.9)!important;color:#765626!important;box-shadow:0 8px 22px rgba(69,48,28,.1)!important}
      body.light #dbpOverlay .dbp-close:hover{background:#f5ead6!important}
      body.light #dbpOverlay .dbp-aside{background:radial-gradient(circle at 15% 5%,rgba(176,141,74,.16),transparent 34%),linear-gradient(165deg,#fff8ec,#f3e6cf 78%)!important;border-right-color:rgba(145,108,49,.2)!important}
      body.light #dbpOverlay .dbp-aside:after{border-color:rgba(145,108,49,.1)!important;box-shadow:0 0 0 35px rgba(176,141,74,.04),0 0 0 70px rgba(176,141,74,.025)!important}
      body.light #dbpOverlay .dbp-profile{background:#f5e8d2!important;border-color:rgba(145,108,49,.62)!important;box-shadow:0 12px 28px rgba(71,48,26,.15),0 0 0 6px rgba(176,141,74,.07)!important}
      body.light #dbpOverlay .dbp-brand-name{color:#5a3d1d!important}
      body.light #dbpOverlay .dbp-brand-title{color:#8a642c!important}
      body.light #dbpOverlay .dbp-price-tag{border-color:rgba(145,108,49,.3)!important;background:rgba(176,141,74,.1)!important;color:#69491f!important}
      body.light #dbpOverlay .dbp-aside h2{color:#251b13!important}
      body.light #dbpOverlay .dbp-aside-copy{color:#665747!important}
      body.light #dbpOverlay .dbp-benefit{color:#3b3025!important}
      body.light #dbpOverlay .dbp-benefit i{background:rgba(145,108,49,.13)!important;color:#735124!important}
      body.light #dbpOverlay .dbp-trust{border-top-color:rgba(145,108,49,.18)!important;color:#756757!important}
      body.light #dbpOverlay .dbp-main{background:radial-gradient(circle at 100% 0,rgba(176,141,74,.1),transparent 26%),#fffaf3!important}
      body.light #dbpOverlay .dbp-eyebrow{color:#876126!important}
      body.light #dbpOverlay .dbp-main h3{color:#251b13!important}
      body.light #dbpOverlay .dbp-main-head p{color:#726455!important}
      body.light #dbpOverlay .dbp-label{color:#715024!important}
      body.light #dbpOverlay .dbp-optional{color:#988a79!important}
      body.light #dbpOverlay .dbp-input,
      body.light #dbpOverlay .dbp-select,
      body.light #dbpOverlay .dbp-textarea{border-color:rgba(120,88,43,.26)!important;background:#fffdf8!important;color:#2e241b!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)!important}
      body.light #dbpOverlay .dbp-select{color-scheme:light!important}
      body.light #dbpOverlay .dbp-select option{background:#fffaf1!important;color:#2e241b!important}
      body.light #dbpOverlay .dbp-input::placeholder,
      body.light #dbpOverlay .dbp-textarea::placeholder{color:rgba(75,62,48,.48)!important}
      body.light #dbpOverlay .dbp-input:focus,
      body.light #dbpOverlay .dbp-select:focus,
      body.light #dbpOverlay .dbp-textarea:focus{border-color:#a77b38!important;background:#fffdf9!important;box-shadow:0 0 0 3px rgba(167,123,56,.12)!important}
      body.light #dbpOverlay .dbp-help,
      body.light #dbpOverlay .dbp-location-status{color:#827463!important}
      body.light #dbpOverlay .dbp-location-status.ok{color:#257447!important}
      body.light #dbpOverlay .dbp-location-status.error,
      body.light #dbpOverlay .dbp-error{color:#a63f35!important}
      body.light #dbpOverlay .dbp-field.has-error .dbp-input,
      body.light #dbpOverlay .dbp-field.has-error .dbp-select,
      body.light #dbpOverlay .dbp-field.has-error .dbp-textarea{border-color:#b65349!important;box-shadow:0 0 0 3px rgba(182,83,73,.1)!important}
      body.light #dbpOverlay .dbp-suggestions{border-color:rgba(120,88,43,.32)!important;background:#fffaf1!important;box-shadow:0 20px 48px rgba(69,48,28,.18)!important}
      body.light #dbpOverlay .dbp-suggestion{border-bottom-color:rgba(120,88,43,.12)!important;color:#35291e!important}
      body.light #dbpOverlay .dbp-suggestion:hover,
      body.light #dbpOverlay .dbp-suggestion:focus{background:#f3e5cf!important}
      body.light #dbpOverlay .dbp-suggestion small{color:#817260!important}
      body.light #dbpOverlay .dbp-actions{border-top-color:rgba(120,88,43,.16)!important}
      body.light #dbpOverlay .dbp-status{border-color:rgba(120,88,43,.2)!important;background:#f8efdf!important;color:#5d4e3d!important}
      body.light #dbpOverlay .dbp-status.error{border-color:rgba(166,63,53,.28)!important;background:#fff0ed!important;color:#9b3930!important}
      body.light #dbpOverlay .dbp-status.success{border-color:rgba(37,116,71,.25)!important;background:#edf8f0!important;color:#236b42!important}
      body.light #dbpOverlay .dbp-result{border-top-color:rgba(120,88,43,.17)!important}
      body.light #dbpOverlay .dbp-result h4{color:#2b2017!important}
      body.light #dbpOverlay .dbp-result-lead{color:#716352!important}
      body.light #dbpOverlay .dbp-report{border-color:rgba(120,88,43,.18)!important;background:#fffdf8!important;color:#493b2e!important}
      body.light #dbpOverlay .dbp-upsell{border-color:rgba(145,108,49,.3)!important;background:linear-gradient(145deg,#f7ead5,#fffaf1)!important}
      body.light #dbpOverlay .dbp-upsell strong{color:#2b2017!important}
      body.light #dbpOverlay .dbp-upsell p{color:#6d5e4d!important}
      body.light #dbpOverlay .dbp-meta span{border-color:rgba(145,108,49,.28)!important;color:#725124!important;background:rgba(176,141,74,.07)!important}
      body.light #dbpOverlay .dbp-submit,
      body.light #dbpOverlay .dbp-download{background:linear-gradient(135deg,#b78a43,#dfc17f)!important;color:#191107!important;box-shadow:0 15px 34px rgba(145,108,49,.18)!important}
      body.light #dbpOverlay .dbp-consult{background:#ad7f39!important;color:#fffaf1!important}

      @media(min-width:768px) and (max-width:1180px){
        .hero{min-height:auto!important;padding-top:150px!important;padding-bottom:90px!important}
        .hero .wrap{padding-left:clamp(38px,6vw,72px)!important;padding-right:clamp(38px,6vw,72px)!important}
        .hero .hero-content,.hero .hero-copy{max-width:min(640px,58vw)!important}
      }
      @media(max-width:820px){
        body.light #dbpOverlay .dbp-aside{border-right:0!important;border-bottom-color:rgba(145,108,49,.2)!important}
        body.light #dbpOverlay .dbp-close{background:#fff8ec!important}
      }
      @media(max-width:767px){
        .hero .wrap{padding-left:20px!important;padding-right:20px!important}
        .pricing-tags-balanced{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-width:360px){
        .pricing-tags-balanced{gap:6px!important}
        .pricing-tags-balanced>*{font-size:9px!important;padding:7px 5px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function errorFor(input) {
    if (!input) return null;
    var parent = input.parentElement || input;
    var error = qs('.db-field-error', parent);
    if (!error) {
      error = document.createElement('div');
      error.className = 'db-field-error';
      parent.appendChild(error);
    }
    return error;
  }

  function setError(input, message) {
    if (!input) return;
    input.classList.add('db-invalid');
    input.setAttribute('aria-invalid', 'true');
    var error = errorFor(input);
    if (error) {
      error.textContent = message;
      error.classList.add('show');
    }
  }

  function clearError(input) {
    if (!input) return;
    input.classList.remove('db-invalid');
    input.removeAttribute('aria-invalid');
    var error = qs('.db-field-error', input.parentElement || input);
    if (error) error.classList.remove('show');
  }

  function formatDate(value) {
    var valueDigits = digits(value).slice(0, 8);
    if (valueDigits.length <= 2) return valueDigits;
    if (valueDigits.length <= 4) return valueDigits.slice(0, 2) + '/' + valueDigits.slice(2);
    return valueDigits.slice(0, 2) + '/' + valueDigits.slice(2, 4) + '/' + valueDigits.slice(4);
  }

  function parseDisplayDate(value) {
    var match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    var day = Number(match[1]);
    var month = Number(match[2]);
    var year = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    if (year < 1900 || date > new Date()) return null;
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function toDisplayDate(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? match[3] + '/' + match[2] + '/' + match[1] : '';
  }

  function ensureDateBridge() {
    var original = document.getElementById('popDob');
    if (!original) return null;
    if (original._dbDisplayInput) return original._dbDisplayInput;

    var display = document.createElement('input');
    display.type = 'text';
    display.inputMode = 'numeric';
    display.autocomplete = 'bday';
    display.placeholder = 'DD/MM/YYYY';
    display.className = (original.className || '') + ' db-dob-display';
    display.value = toDisplayDate(original.value);
    display.setAttribute('aria-label', 'Date of birth in DD/MM/YYYY format');

    original.style.position = 'absolute';
    original.style.opacity = '0';
    original.style.pointerEvents = 'none';
    original.style.width = '1px';
    original.style.height = '1px';
    original.style.overflow = 'hidden';
    original.setAttribute('aria-hidden', 'true');
    original.tabIndex = -1;
    original.insertAdjacentElement('afterend', display);
    original._dbDisplayInput = display;

    display.addEventListener('input', function () {
      display.value = formatDate(display.value);
      original.value = parseDisplayDate(display.value) || '';
      original.dispatchEvent(new Event('input', { bubbles: true }));
      original.dispatchEvent(new Event('change', { bubbles: true }));
      clearError(display);
    });

    return display;
  }

  function enhanceFreeForm() {
    var form = document.getElementById('popupFormFields');
    if (!form) return;

    var name = document.getElementById('popName');
    var email = document.getElementById('popEmail');
    var phone = document.getElementById('popPhone');
    var dob = ensureDateBridge();

    if (name) name.placeholder = 'Enter your full name';
    if (email) email.placeholder = 'you@example.com';
    if (phone) phone.placeholder = '98765 43210';

    [name, email, phone, dob].forEach(function (input) {
      if (!input || input.dataset.dbValidationBound === 'true') return;
      input.dataset.dbValidationBound = 'true';
      input.addEventListener('input', function () { clearError(input); });
    });
  }

  function validateFreeForm() {
    enhanceFreeForm();

    var name = document.getElementById('popName');
    var email = document.getElementById('popEmail');
    var phone = document.getElementById('popPhone');
    var originalDob = document.getElementById('popDob');
    var dob = originalDob && originalDob._dbDisplayInput;
    var valid = true;

    [name, email, phone, dob].forEach(clearError);

    if (!name || !/^[A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{1,79}$/.test(name.value.trim())) {
      setError(name, 'Enter a valid full name.');
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
      setError(email, 'Enter a valid email address.');
      valid = false;
    }
    var phoneDigits = digits(phone && phone.value);
    if (!phone || phoneDigits.length !== 10) {
      setError(phone, 'Enter a valid 10-digit WhatsApp number.');
      valid = false;
    }
    if (!dob || !parseDisplayDate(dob.value)) {
      setError(dob, 'Use a valid date in DD/MM/YYYY format.');
      valid = false;
    }

    if (!valid) {
      var firstInvalid = qs('.db-invalid', document.getElementById('popupFormFields'));
      if (firstInvalid) firstInvalid.focus({ preventScroll: false });
    }
    return valid;
  }

  function applyExactLandingUpdates() {
    injectStyles();
    enhanceFreeForm();

    document.querySelectorAll('#pricing .pcard-tags').forEach(function (tags) {
      tags.classList.add('pricing-tags-balanced');
    });

    var vipSlots = qs('#pricing .price-row>.pcard:nth-child(3) .pcard-slots');
    if (vipSlots) {
      var dot = vipSlots.querySelector('.slot-dot');
      vipSlots.textContent = 'Only 5 private sessions per week';
      if (dot) vipSlots.insertBefore(dot, vipSlots.firstChild);
    }
  }

  document.addEventListener('click', function (event) {
    var submit = event.target && event.target.closest ? event.target.closest('#popupSubmitBtn') : null;
    if (!submit) return;
    if (!validateFreeForm()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyExactLandingUpdates, { once: true });
  } else {
    applyExactLandingUpdates();
  }
})();
