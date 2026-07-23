(function () {
  'use strict';

  if (window.__divyaPaidProfileRepairV3) return;
  window.__divyaPaidProfileRepairV3 = true;

  function normalise(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function injectStyles() {
    if (document.getElementById('dbPaidProfileRepairStylesV3')) return;
    var old = document.getElementById('dbPaidProfileRepairStylesV2');
    if (old) old.remove();

    var style = document.createElement('style');
    style.id = 'dbPaidProfileRepairStylesV3';
    style.textContent = `
      #dbpOverlay .dbp-profile-row{
        display:flex!important;
        align-items:center!important;
        gap:16px!important;
        margin:0 0 14px!important;
      }
      #dbpOverlay .dbp-profile{
        width:92px!important;
        height:92px!important;
        flex:0 0 92px!important;
        border-radius:50%!important;
        overflow:hidden!important;
        padding:3px!important;
        border:1px solid rgba(201,169,110,.78)!important;
        background:#151117!important;
        box-shadow:0 12px 30px rgba(0,0,0,.34),0 0 0 6px rgba(201,169,110,.045)!important;
      }
      #dbpOverlay .dbp-profile img{
        width:100%!important;
        height:100%!important;
        display:block!important;
        object-fit:cover!important;
        object-position:center center!important;
        border-radius:50%!important;
        transform:scale(2.08) translateY(16%)!important;
        transform-origin:center center!important;
      }
      #dbpOverlay .dbp-brand{
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:center!important;
        gap:7px!important;
        margin:0!important;
        max-width:none!important;
        min-width:0!important;
        line-height:1!important;
      }
      #dbpOverlay .dbp-brand-name{
        display:block!important;
        color:#d8b36e!important;
        font-size:24px!important;
        line-height:1!important;
        font-weight:900!important;
        letter-spacing:2.2px!important;
        white-space:nowrap!important;
      }
      #dbpOverlay .dbp-brand-title{
        display:block!important;
        color:#d8b36e!important;
        font-size:12px!important;
        line-height:1.15!important;
        font-weight:750!important;
        letter-spacing:1.8px!important;
        white-space:nowrap!important;
      }
      #dbpOverlay .dbp-price-tag{margin-top:0!important}
      @media(max-width:430px){
        #dbpOverlay .dbp-profile-row{gap:14px!important;margin-bottom:14px!important}
        #dbpOverlay .dbp-profile{width:88px!important;height:88px!important;flex-basis:88px!important}
        #dbpOverlay .dbp-brand-name{font-size:21px!important;letter-spacing:1.8px!important}
        #dbpOverlay .dbp-brand-title{font-size:10.5px!important;letter-spacing:1.35px!important}
      }
      @media(max-width:370px){
        #dbpOverlay .dbp-profile{width:80px!important;height:80px!important;flex-basis:80px!important}
        #dbpOverlay .dbp-profile-row{gap:12px!important}
        #dbpOverlay .dbp-brand-name{font-size:18px!important;letter-spacing:1.35px!important}
        #dbpOverlay .dbp-brand-title{font-size:9px!important;letter-spacing:.95px!important}
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
    brand.innerHTML = '<span class="dbp-brand-name">DIVYA BAJAJ</span><span class="dbp-brand-title">ASTRO-NUMEROLOGIST</span>';
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
