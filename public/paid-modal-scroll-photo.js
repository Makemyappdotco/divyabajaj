(function () {
  'use strict';

  if (window.__divyaPaidModalScrollPhotoFixV3) return;
  window.__divyaPaidModalScrollPhotoFixV3 = true;

  var IMAGE_URL = '/divya-profile.png?v=3';

  function injectStyles() {
    if (document.getElementById('dbPaidModalScrollPhotoStylesV3')) return;

    ['dbPaidModalScrollPhotoStyles', 'dbPaidModalScrollPhotoStylesV2'].forEach(function (id) {
      var oldStyle = document.getElementById(id);
      if (oldStyle) oldStyle.remove();
    });

    var style = document.createElement('style');
    style.id = 'dbPaidModalScrollPhotoStylesV3';
    style.textContent = `
      #dbpOverlay{overflow:auto!important;overscroll-behavior:contain!important}
      #dbpOverlay .dbp-shell{max-height:min(92vh,900px)!important;overflow:hidden!important}
      #dbpOverlay .dbp-layout{max-height:min(92vh,900px)!important;min-height:0!important}
      #dbpOverlay .dbp-main{min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important}
      @media(max-width:820px){
        #dbpOverlay{overflow:hidden!important}
        #dbpOverlay .dbp-shell{height:100dvh!important;max-height:none!important;overflow:hidden!important}
        #dbpOverlay .dbp-layout{height:100%!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important}
        #dbpOverlay .dbp-main{overflow:visible!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFixedPhoto() {
    var image = document.querySelector('#dbpOverlay .dbp-profile img');
    if (!image) return false;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.onerror = function () { image.style.visibility = 'hidden'; };
    image.onload = function () { image.style.visibility = 'visible'; };
    if (image.getAttribute('src') !== IMAGE_URL) image.setAttribute('src', IMAGE_URL);
    return true;
  }

  function applyFixes() {
    injectStyles();
    ensureFixedPhoto();
  }

  function scheduleFixes() {
    [0, 100, 300].forEach(function (delay) {
      window.setTimeout(applyFixes, delay);
    });
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!trigger) return;
    var label = String(trigger.textContent || '').trim().toLowerCase();
    if (/get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label)) scheduleFixes();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFixes, { once: true });
  } else {
    applyFixes();
  }
})();
