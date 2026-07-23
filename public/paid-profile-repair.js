(function () {
  'use strict';

  if (window.__divyaPaidProfileRepairV2) return;
  window.__divyaPaidProfileRepairV2 = true;

  function normalise(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function injectStyles() {
    if (document.getElementById('dbPaidProfileRepairStylesV2')) return;
    var style = document.createElement('style');
    style.id = 'dbPaidProfileRepairStylesV2';
    style.textContent = `
      #dbpOverlay .dbp-profile-row{
        display:flex!important;
        align-items:center!important;
        gap:16px!important;
        margin:0 0 18px!important;
      }
      #dbpOverlay .dbp-profile{
        width:88px!important;
        height:88px!important;
        flex:0 0 88px!important;
        border-radius:50%!important;
        overflow:hidden!important;
        padding:3px!important;
        border:1px solid rgba(201,169,110,.72)!important;
        background:#151117!important;
        box-shadow:0 12px 30px rgba(0,0,0,.34),0 0 0 6px rgba(201,169,110,.045)!important;
      }
      #dbpOverlay .dbp-profile img{
        width:100%!important;
        height:100%!important;
        display:block!important;
        object-fit:cover!important;
        object-position:center 14%!important;
        border-radius:50%!important;
        transform:none!important;
      }
      #dbpOverlay .dbp-brand{
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:center!important;
        gap:5px!important;
        margin:0!important;
        max-width:none!important;
        min-width:0!important;
        line-height:1!important;
      }
      #dbpOverlay .dbp-brand-name{
        display:block!important;
        color:#d8b36e!important;
        font-size:21px!important;
        line-height:1.05!important;
        font-weight:800!important;
        letter-spacing:2.4px!important;
        white-space:nowrap!important;
      }
      #dbpOverlay .dbp-brand-title{
        display:block!important;
        color:#d8b36e!important;
        font-size:11px!important;
        line-height:1.2!important;
        font-weight:700!important;
        letter-spacing:2px!important;
        white-space:nowrap!important;
      }
      #dbpOverlay .dbp-price-tag{margin-top:0!important}
      @media(max-width:430px){
        #dbpOverlay .dbp-profile-row{gap:14px!important;margin-bottom:16px!important}
        #dbpOverlay .dbp-profile{width:82px!important;height:82px!important;flex-basis:82px!important}
        #dbpOverlay .dbp-brand-name{font-size:19px!important;letter-spacing:2px!important}
        #dbpOverlay .dbp-brand-title{font-size:10px!important;letter-spacing:1.55px!important}
      }
      @media(max-width:360px){
        #dbpOverlay .dbp-profile{width:74px!important;height:74px!important;flex-basis:74px!important}
        #dbpOverlay .dbp-brand-name{font-size:17px!important;letter-spacing:1.55px!important}
        #dbpOverlay .dbp-brand-title{font-size:9px!important;letter-spacing:1.15px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function isUsableImage(image) {
    if (!image || !image.isConnected || image.closest('#dbpOverlay')) return false;
    var source = image.currentSrc || image.src || '';
    var context = normalise([
      source,
      image.alt,
      image.className,
      image.id,
      image.parentElement && image.parentElement.className
    ].join(' '));

    if (!source || !image.complete || image.naturalWidth < 70 || image.naturalHeight < 70) return false;
    if (/logo|golden logo|normal logo|brand mark|monogram/.test(context)) return false;
    return true;
  }

  function scoreImage(image) {
    var source = normalise(image.currentSrc || image.src);
    var context = normalise([
      image.alt,
      image.className,
      image.id,
      image.parentElement && image.parentElement.className,
      image.parentElement && image.parentElement.parentElement && image.parentElement.parentElement.className
    ].join(' '));
    var score = 0;

    if (/_abt|portrait|profile|photo/.test(source)) score += 220;
    if (/divya/.test(source)) score += 120;
    if (/divya/.test(context)) score += 80;
    if (image.closest('.popup-photo,.hero-portrait,.about-visual,[class*="portrait"],[class*="photo"]')) score += 260;
    if (image.closest('[class*="free"][class*="popup"],[id*="free"][id*="popup"],.free-popup')) score += 160;
    if (image.naturalHeight >= image.naturalWidth) score += 25;

    return score;
  }

  function findBestPortrait() {
    var candidates = Array.prototype.slice.call(document.images).filter(isUsableImage);
    candidates.sort(function (a, b) { return scoreImage(b) - scoreImage(a); });
    return candidates[0] || null;
  }

  function formatBrand(brand) {
    if (!brand) return;
    if (!brand.querySelector('.dbp-brand-name')) {
      brand.innerHTML = '<span class="dbp-brand-name">DIVYA BAJAJ</span><span class="dbp-brand-title">ASTRO-NUMEROLOGIST</span>';
    }
  }

  function ensureLayout(overlay) {
    var aside = overlay && overlay.querySelector('.dbp-aside');
    var brand = overlay && overlay.querySelector('.dbp-brand');
    var price = overlay && overlay.querySelector('.dbp-price-tag');
    if (!aside || !brand) return null;

    formatBrand(brand);

    var row = aside.querySelector('.dbp-profile-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'dbp-profile-row';
      if (price && price.parentNode === aside) aside.insertBefore(row, price);
      else aside.insertBefore(row, aside.firstChild);
    }

    var profile = row.querySelector('.dbp-profile');
    if (!profile) {
      profile = document.createElement('div');
      profile.className = 'dbp-profile';
      row.appendChild(profile);
    }

    var image = profile.querySelector('img');
    if (!image) {
      image = document.createElement('img');
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      profile.appendChild(image);
    }

    if (!row.contains(brand)) row.appendChild(brand);
    return image;
  }

  function applyPortrait() {
    injectStyles();
    var overlay = document.getElementById('dbpOverlay');
    if (!overlay) return false;

    var target = ensureLayout(overlay);
    if (!target) return false;

    var portrait = findBestPortrait();
    if (!portrait) {
      target.removeAttribute('src');
      target.style.display = 'none';
      var hiddenProfile = target.closest('.dbp-profile');
      if (hiddenProfile) hiddenProfile.style.display = 'none';
      return false;
    }

    var source = portrait.currentSrc || portrait.src;
    var preloader = new Image();
    preloader.onload = function () {
      target.alt = 'Divya Bajaj';
      target.removeAttribute('aria-hidden');
      target.style.display = 'block';
      target.style.objectPosition = 'center 14%';
      var profile = target.closest('.dbp-profile');
      if (profile) profile.style.display = '';
      target.src = source;
    };
    preloader.onerror = function () {
      target.removeAttribute('src');
      target.alt = '';
      target.style.display = 'none';
      var profile = target.closest('.dbp-profile');
      if (profile) profile.style.display = 'none';
    };
    preloader.src = source;
    return true;
  }

  function repairForFiveSeconds() {
    var started = Date.now();
    applyPortrait();
    var timer = window.setInterval(function () {
      applyPortrait();
      if (Date.now() - started > 5000) window.clearInterval(timer);
    }, 250);
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!trigger) return;
    var text = normalise((trigger.textContent || '') + ' ' + (trigger.getAttribute('href') || ''));
    if (/get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(text)) {
      window.setTimeout(repairForFiveSeconds, 0);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    window.setTimeout(applyPortrait, 300);
  });

  injectStyles();
  if (document.readyState !== 'loading') window.setTimeout(applyPortrait, 0);
})();
