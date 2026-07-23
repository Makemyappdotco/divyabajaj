(function () {
  'use strict';

  if (window.__divyaPaidModalScrollPhotoFix) return;
  window.__divyaPaidModalScrollPhotoFix = true;

  function injectStyles() {
    if (document.getElementById('dbPaidModalScrollPhotoStyles')) return;

    var style = document.createElement('style');
    style.id = 'dbPaidModalScrollPhotoStyles';
    style.textContent = `
      .dbp-profile{
        width:82px;
        height:82px;
        margin:0 0 18px;
        padding:4px;
        border:1px solid rgba(201,169,110,.42);
        border-radius:50%;
        background:rgba(201,169,110,.07);
        box-shadow:0 12px 34px rgba(0,0,0,.28),0 0 0 7px rgba(201,169,110,.035);
        overflow:hidden;
        position:relative;
        z-index:2;
      }
      .dbp-profile img{
        width:100%;
        height:100%;
        display:block;
        object-fit:cover;
        object-position:50% 22%;
        border-radius:50%;
      }
      .dbp-aside.has-profile .dbp-brand{margin-bottom:24px}

      @media(min-width:821px){
        .dbp-overlay{
          overflow:hidden!important;
          overscroll-behavior:contain;
        }
        .dbp-shell{
          height:min(92dvh,900px)!important;
          max-height:min(92dvh,900px)!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        .dbp-layout{
          height:100%!important;
          max-height:none!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        .dbp-aside{
          height:100%!important;
          min-height:0!important;
          overflow-y:auto!important;
          overflow-x:hidden!important;
          overscroll-behavior:contain;
          scrollbar-width:thin;
          scrollbar-color:rgba(201,169,110,.35) transparent;
        }
        .dbp-main{
          height:100%!important;
          min-height:0!important;
          overflow-y:auto!important;
          overflow-x:hidden!important;
          overscroll-behavior:contain;
          -webkit-overflow-scrolling:touch;
          scrollbar-gutter:stable;
          scrollbar-width:thin;
          scrollbar-color:rgba(201,169,110,.42) transparent;
        }
        .dbp-main::-webkit-scrollbar,.dbp-aside::-webkit-scrollbar{width:8px}
        .dbp-main::-webkit-scrollbar-track,.dbp-aside::-webkit-scrollbar-track{background:transparent}
        .dbp-main::-webkit-scrollbar-thumb,.dbp-aside::-webkit-scrollbar-thumb{
          background:rgba(201,169,110,.34);
          border-radius:999px;
          border:2px solid transparent;
          background-clip:padding-box;
        }
      }

      @media(max-width:820px){
        .dbp-profile{width:70px;height:70px;margin-bottom:15px}
        .dbp-layout{
          overflow-y:auto!important;
          overflow-x:hidden!important;
          overscroll-behavior:contain;
          -webkit-overflow-scrolling:touch;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findDivyaPhoto() {
    var selectors = [
      '.hero-portrait img',
      '.about-visual img',
      '.free-popup img',
      '.popup-photo img',
      'img[alt*="Divya Bajaj" i]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var image = document.querySelector(selectors[i]);
      if (!image) continue;
      var source = image.currentSrc || image.src;
      if (source && !/logo/i.test(source)) return source;
    }
    return '';
  }

  function enhanceModal() {
    injectStyles();

    var overlay = document.getElementById('dbpOverlay');
    if (!overlay) return false;

    var aside = overlay.querySelector('.dbp-aside');
    var brand = overlay.querySelector('.dbp-brand');
    if (!aside || !brand) return false;

    aside.classList.add('has-profile');

    if (!aside.querySelector('.dbp-profile')) {
      var source = findDivyaPhoto();
      if (source) {
        var profile = document.createElement('div');
        profile.className = 'dbp-profile';
        profile.innerHTML = '<img src="' + source.replace(/"/g, '&quot;') + '" alt="Divya Bajaj, Astro-Numerologist">';
        aside.insertBefore(profile, brand);
      }
    }

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
