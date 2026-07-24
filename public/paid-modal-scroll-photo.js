(function () {
  'use strict';

  if (window.__divyaPaidModalScrollPhotoFixV4) return;
  window.__divyaPaidModalScrollPhotoFixV4 = true;

  var IMAGE_URL = '/divya-profile.png?v=3';

  function injectStyles() {
    if (document.getElementById('dbPaidModalScrollPhotoStylesV4')) return;

    ['dbPaidModalScrollPhotoStyles', 'dbPaidModalScrollPhotoStylesV2', 'dbPaidModalScrollPhotoStylesV3'].forEach(function (id) {
      var oldStyle = document.getElementById(id);
      if (oldStyle) oldStyle.remove();
    });

    var style = document.createElement('style');
    style.id = 'dbPaidModalScrollPhotoStylesV4';
    style.textContent = `
      #dbpOverlay{overscroll-behavior:contain!important}

      @media(min-width:821px){
        #dbpOverlay{overflow:hidden!important;padding:20px!important}
        #dbpOverlay .dbp-shell{
          height:min(92vh,900px)!important;
          max-height:min(92vh,900px)!important;
          overflow-y:auto!important;
          overflow-x:hidden!important;
          overscroll-behavior:contain!important;
          -webkit-overflow-scrolling:touch!important;
          scrollbar-gutter:stable!important;
        }
        #dbpOverlay .dbp-layout{
          height:auto!important;
          min-height:100%!important;
          max-height:none!important;
        }
        #dbpOverlay .dbp-aside{min-height:100%!important}
        #dbpOverlay .dbp-main{
          min-height:0!important;
          overflow:visible!important;
        }
      }

      @media(max-width:820px){
        #dbpOverlay{overflow:hidden!important;padding:0!important}
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