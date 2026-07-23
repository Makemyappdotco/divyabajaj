(function () {
  'use strict';

  if (window.__divyaPaidModalScrollPhotoFixV2) return;
  window.__divyaPaidModalScrollPhotoFixV2 = true;

  var DIVYA_PROFILE_IMAGE = 'data:image/webp;base64,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';

  function injectStyles() {
    if (document.getElementById('dbPaidModalScrollPhotoStylesV2')) return;
    var oldStyle = document.getElementById('dbPaidModalScrollPhotoStyles');
    if (oldStyle) oldStyle.remove();

    var style = document.createElement('style');
    style.id = 'dbPaidModalScrollPhotoStylesV2';
    style.textContent = `
      .dbp-profile-row{
        display:flex!important;
        align-items:center!important;
        gap:14px!important;
        margin:0 0 14px!important;
        position:relative!important;
        z-index:2!important;
      }
      .dbp-profile{
        width:72px!important;
        height:72px!important;
        flex:0 0 72px!important;
        margin:0!important;
        padding:3px!important;
        border:1px solid rgba(201,169,110,.48)!important;
        border-radius:50%!important;
        background:radial-gradient(circle,rgba(201,169,110,.12),rgba(201,169,110,.035))!important;
        box-shadow:0 12px 30px rgba(0,0,0,.3),0 0 0 6px rgba(201,169,110,.035)!important;
        overflow:hidden!important;
      }
      .dbp-profile img{
        width:100%!important;
        height:100%!important;
        display:block!important;
        object-fit:cover!important;
        object-position:center 12%!important;
        border-radius:50%!important;
      }
      .dbp-profile-row .dbp-brand{
  margin:0!important;
  max-width:none!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  gap:7px!important;
  line-height:1!important;
}

.dbp-brand-name{
  display:block!important;
  color:#d8b66f!important;
  font-size:22px!important;
  font-weight:900!important;
  line-height:1!important;
  letter-spacing:1.2px!important;
  white-space:nowrap!important;
}

.dbp-brand-title{
  display:block!important;
  color:#d8b66f!important;
  font-size:10px!important;
  font-weight:800!important;
  line-height:1.1!important;
  letter-spacing:1.5px!important;
  white-space:nowrap!important;
}
      .dbp-aside.has-profile .dbp-price-tag{margin-top:0!important}

      @media(min-width:821px){
        .dbp-overlay{overflow:hidden!important;overscroll-behavior:contain}
        .dbp-shell{height:min(92dvh,900px)!important;max-height:min(92dvh,900px)!important;min-height:0!important;overflow:hidden!important}
        .dbp-layout{height:100%!important;max-height:none!important;min-height:0!important;overflow:hidden!important}
        .dbp-aside{height:100%!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(201,169,110,.35) transparent}
        .dbp-main{height:100%!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:rgba(201,169,110,.42) transparent}
        .dbp-main::-webkit-scrollbar,.dbp-aside::-webkit-scrollbar{width:8px}
        .dbp-main::-webkit-scrollbar-track,.dbp-aside::-webkit-scrollbar-track{background:transparent}
        .dbp-main::-webkit-scrollbar-thumb,.dbp-aside::-webkit-scrollbar-thumb{background:rgba(201,169,110,.34);border-radius:999px;border:2px solid transparent;background-clip:padding-box}
      }

      @media(max-width:820px){
        .dbp-profile-row{gap:12px!important;margin-bottom:12px!important}
        .dbp-profile{width:62px!important;height:62px!important;flex-basis:62px!important}
        .dbp-profile-row .dbp-brand{max-width:190px!important;font-size:9px!important;letter-spacing:2px!important}
        .dbp-layout{overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceModal() {
    injectStyles();

    var overlay = document.getElementById('dbpOverlay');
    if (!overlay) return false;

    var aside = overlay.querySelector('.dbp-aside');
    var brand = overlay.querySelector('.dbp-brand');
    if (!aside || !brand) return false;

    aside.classList.add('has-profile');

    var row = aside.querySelector('.dbp-profile-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'dbp-profile-row';
      aside.insertBefore(row, brand);
    }

    var profile = row.querySelector('.dbp-profile');
    if (!profile) {
      profile = document.createElement('div');
      profile.className = 'dbp-profile';
      profile.innerHTML = '<img src="' + DIVYA_PROFILE_IMAGE + '" alt="Divya Bajaj, Astro-Numerologist" width="96" height="96">';
      row.appendChild(profile);
    }

    if (brand.parentNode !== row) row.appendChild(brand);

    var priceTag = aside.querySelector('.dbp-price-tag');
    if (priceTag && row.nextSibling !== priceTag) aside.insertBefore(priceTag, row.nextSibling);

    var main = overlay.querySelector('.dbp-main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.style.scrollBehavior = 'smooth';
    }

    return true;
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;

    var label = String(target.textContent || '').toLowerCase();
    var href = String(target.getAttribute('href') || '').toLowerCase();
    if (/get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label + ' ' + href)) {
      setTimeout(enhanceModal, 0);
      setTimeout(enhanceModal, 100);
    }
  }, true);

  var observer = new MutationObserver(function () {
    if (enhanceModal()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  injectStyles();
  enhanceModal();
})();
