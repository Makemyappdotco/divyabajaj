(function () {
  'use strict';

  if (window.__divyaLandingLivePolish) return;
  window.__divyaLandingLivePolish = true;

  var downloadWatcher = null;

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }
  function normalise(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function injectStyles() {
    if (document.getElementById('dbLandingPolishStyles')) return;
    var style = document.createElement('style');
    style.id = 'dbLandingPolishStyles';
    style.textContent = `
      html{scroll-padding-top:90px}
      body{overflow-x:clip}
      input::placeholder,textarea::placeholder{opacity:1}
      .db-field-error{display:none;margin-top:7px;color:#ffaaa0;font-size:11px;line-height:1.35;text-align:left}
      .db-field-error.show{display:block}
      .db-invalid{border-color:#e37c70!important;box-shadow:0 0 0 3px rgba(227,124,112,.09)!important}
      .db-dob-display{width:100%!important;color:var(--text)!important;background:transparent!important}
      .db-dob-display::placeholder{color:var(--text-s)!important;opacity:1!important}
      .free-download-top{display:block!important;width:100%!important;order:-10!important;margin:0 0 18px!important;position:relative!important;top:auto!important}
      .pricing-tags-balanced{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%!important;align-items:stretch!important;justify-content:stretch!important}
      .pricing-tags-balanced>*{display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;min-width:0!important;min-height:34px!important;margin:0!important;padding:7px 9px!important;line-height:1.25!important}
      .pricing-tags-balanced>*:last-child:nth-child(odd){grid-column:1/-1!important}
      .hero .wrap{width:100%!important;max-width:1280px!important;margin-left:auto!important;margin-right:auto!important;padding-left:clamp(24px,4.5vw,68px)!important;padding-right:clamp(24px,4.5vw,68px)!important}
      .hero .hero-inner,.hero .hero-grid{width:100%!important;margin-left:auto!important;margin-right:auto!important}
      .hero .hero-content,.hero .hero-copy{margin-left:0!important}
      @media(min-width:768px) and (max-width:1180px){
        .hero{min-height:auto!important;padding-top:150px!important;padding-bottom:90px!important}
        .hero .wrap{padding-left:clamp(38px,6vw,72px)!important;padding-right:clamp(38px,6vw,72px)!important}
        .hero .hero-content,.hero .hero-copy{max-width:min(640px,58vw)!important}
      }
      @media(max-width:767px){
        .hero .wrap{padding-left:20px!important;padding-right:20px!important}
        .pricing-tags-balanced{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-width:360px){.pricing-tags-balanced{gap:6px!important}.pricing-tags-balanced>*{font-size:9px!important;padding:7px 5px!important}}
    `;
    document.head.appendChild(style);
  }

  function findButton(pattern) {
    return qsa('button,a').find(function (el) { return pattern.test(normalise(el.textContent)); }) || null;
  }

  function findFreeContainer() {
    var button = findButton(/generate my free report|generate free report|create my free report/);
    if (!button) return null;
    var node = button;
    for (var i = 0; i < 10 && node; i += 1, node = node.parentElement) {
      var text = normalise(node.textContent);
      if (node.querySelectorAll && node.querySelectorAll('input').length >= 3 && /free numerology|free personal report|generate my free report/.test(text)) return node;
    }
    return button.closest('form') || button.parentElement;
  }

  function findInput(container, kind) {
    var inputs = qsa('input', container);
    if (kind === 'name') return inputs.find(function (el) { return el.autocomplete === 'name' || /name/.test(normalise(el.placeholder + ' ' + el.name + ' ' + el.id)); });
    if (kind === 'email') return inputs.find(function (el) { return el.type === 'email' || /email/.test(normalise(el.placeholder + ' ' + el.name + ' ' + el.id)); });
    if (kind === 'phone') return inputs.find(function (el) { return el.inputMode === 'tel' || el.type === 'tel' || /phone|whatsapp|mobile/.test(normalise(el.placeholder + ' ' + el.name + ' ' + el.id)); });
    if (kind === 'dob') return inputs.find(function (el) { return el.type === 'date' || /dob|birth|date/.test(normalise(el.placeholder + ' ' + el.name + ' ' + el.id)); });
    return null;
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
    if (error) { error.textContent = message; error.classList.add('show'); }
  }

  function clearError(input) {
    if (!input) return;
    input.classList.remove('db-invalid');
    input.removeAttribute('aria-invalid');
    var error = errorFor(input);
    if (error) error.classList.remove('show');
  }

  function formatDate(value) {
    var d = digits(value).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0,2) + '/' + d.slice(2);
    return d.slice(0,2) + '/' + d.slice(2,4) + '/' + d.slice(4);
  }

  function parseDisplayDate(value) {
    var match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    var day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    if (year < 1900 || date > new Date()) return null;
    return year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0');
  }

  function toDisplayDate(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? match[3] + '/' + match[2] + '/' + match[1] : '';
  }

  function addDateBridge(original) {
    if (!original || original.dataset.dbDateBridged === 'true') return original && original._dbDisplayInput;
    original.dataset.dbDateBridged = 'true';
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
      var iso = parseDisplayDate(display.value);
      original.value = iso || '';
      original.dispatchEvent(new Event('input', { bubbles:true }));
      original.dispatchEvent(new Event('change', { bubbles:true }));
      clearError(display);
    });
    return display;
  }

  function enhanceFreeForm() {
    var container = findFreeContainer();
    if (!container) return;
    container.dataset.dbFreeEnhanced = 'true';
    container.setAttribute('lang', 'en-GB');

    var name = findInput(container, 'name');
    var email = findInput(container, 'email');
    var phone = findInput(container, 'phone');
    var dobOriginal = findInput(container, 'dob');
    var dob = dobOriginal && dobOriginal.type === 'date' ? addDateBridge(dobOriginal) : dobOriginal;

    if (name) name.placeholder = 'Enter your full name';
    if (email) email.placeholder = 'you@example.com';
    if (phone) phone.placeholder = '98765 43210';
    if (dob) dob.placeholder = 'DD/MM/YYYY';

    [name,email,phone,dob].forEach(function (input) {
      if (input && input.dataset.dbValidationBound !== 'true') {
        input.dataset.dbValidationBound = 'true';
        input.addEventListener('input', function () { clearError(input); });
      }
    });
  }

  function validateFreeForm(button) {
    var container = findFreeContainer();
    if (!container || !container.contains(button)) return true;
    enhanceFreeForm();

    var name = findInput(container, 'name');
    var email = findInput(container, 'email');
    var phone = findInput(container, 'phone');
    var dobOriginal = findInput(container, 'dob');
    var dob = dobOriginal && dobOriginal._dbDisplayInput ? dobOriginal._dbDisplayInput : dobOriginal;
    var valid = true;

    [name,email,phone,dob].forEach(clearError);
    if (!name || !/^[A-Za-zÀ-ž][A-Za-zÀ-ž .'’-]{1,79}$/.test(name.value.trim())) { setError(name, 'Enter a valid full name.'); valid = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { setError(email, 'Enter a valid email address.'); valid = false; }
    var phoneDigits = digits(phone && phone.value);
    if (!phone || phoneDigits.length < 10 || phoneDigits.length > 15) { setError(phone, 'Enter a valid WhatsApp number with 10 to 15 digits.'); valid = false; }
    var displayValue = dob ? dob.value : '';
    if (!parseDisplayDate(displayValue)) { setError(dob, 'Use a valid date in DD/MM/YYYY format.'); valid = false; }

    if (!valid) {
      var first = qs('.db-invalid', container);
      if (first) first.focus({ preventScroll:false });
    }
    return valid;
  }

  function watchForFreeDownload(container) {
    clearInterval(downloadWatcher);
    var attempts = 0;
    downloadWatcher = setInterval(function () {
      attempts += 1;
      var candidates = qsa('button,a', container).filter(function (el) {
        return /download.*(pdf|report)|download pdf copy/.test(normalise(el.textContent));
      });
      var button = candidates[0];
      if (button) {
        var result = button.closest('[id*="result"],[class*="result"],[id*="report"],[class*="report"]');
        if (!result) {
          var node = button.parentElement;
          for (var i = 0; i < 7 && node; i += 1, node = node.parentElement) {
            if (normalise(node.textContent).length > 250 && container.contains(node)) { result = node; break; }
          }
        }
        if (result && result !== container) {
          button.classList.add('free-download-top');
          result.insertBefore(button, result.firstChild);
        } else {
          button.classList.add('free-download-top');
          container.insertBefore(button, container.firstChild);
        }
        clearInterval(downloadWatcher);
        downloadWatcher = null;
      }
      if (attempts > 240) { clearInterval(downloadWatcher); downloadWatcher = null; }
    }, 500);
  }

  function balancePricingTags() {
    qsa('.pcard').forEach(function (card) {
      if (card.dataset.dbTagsBalanced === 'true') return;
      var candidates = qsa('*', card).filter(function (el) {
        if (el.children.length < 3 || el.children.length > 8) return false;
        var children = Array.prototype.slice.call(el.children);
        if (!children.every(function (child) {
          var text = normalise(child.textContent);
          return text.length >= 2 && text.length <= 42 && !child.querySelector('button,a,input,select,textarea');
        })) return false;
        var total = normalise(el.textContent);
        return /ruling|destiny|career|remedy|report|chart|dasha|consultation|call|video|numerology|astrology|relationship|money|guidance/.test(total);
      });
      if (candidates.length) {
        candidates.sort(function (a,b) { return a.children.length - b.children.length; });
        candidates[0].classList.add('pricing-tags-balanced');
        card.dataset.dbTagsBalanced = 'true';
      }
    });
    qsa('.pcard-tags,.pricing-tags,.price-tags,.feature-tags').forEach(function (el) { el.classList.add('pricing-tags-balanced'); });
  }

  function resetFreeDisplayOnClear(target) {
    if (!/clear all fields|clear fields/.test(normalise(target.textContent))) return;
    var container = findFreeContainer();
    if (!container || !container.contains(target)) return;
    setTimeout(function () {
      qsa('.db-dob-display', container).forEach(function (el) { el.value = ''; clearError(el); });
      qsa('.db-invalid', container).forEach(clearError);
    }, 0);
  }

  function runEnhancements() {
    injectStyles();
    enhanceFreeForm();
    balancePricingTags();
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;
    var label = normalise(target.textContent);

    if (/free report|read my numbers free/.test(label)) {
      setTimeout(enhanceFreeForm, 30);
      setTimeout(enhanceFreeForm, 250);
    }

    if (/generate my free report|generate free report|create my free report/.test(label)) {
      var valid = validateFreeForm(target);
      if (!valid) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      var container = findFreeContainer();
      if (container) watchForFreeDownload(container);
    }

    resetFreeDisplayOnClear(target);
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    runEnhancements();
    setTimeout(runEnhancements, 350);
    setTimeout(runEnhancements, 1200);
  });
  if (document.readyState !== 'loading') {
    runEnhancements();
    setTimeout(runEnhancements, 350);
  }
})();
