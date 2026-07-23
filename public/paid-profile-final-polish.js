(function () {
  'use strict';

  if (window.__divyaPaidProfileFinalPolish) return;
  window.__divyaPaidProfileFinalPolish = true;

  function injectStyles() {
    if (document.getElementById('dbPaidProfileFinalPolishStyles')) return;
    var style = document.createElement('style');
    style.id = 'dbPaidProfileFinalPolishStyles';
    style.textContent = `
      #dbpOverlay .dbp-profile-row{
        display:flex!important;
        align-items:center!important;
        gap:17px!important;
        margin:0 0 16px!important;
      }
      #dbpOverlay .dbp-profile{
        width:92px!important;
        height:92px!important;
        flex:0 0 92px!important;
        overflow:hidden!important;
        border-radius:50%!important;
      }
      #dbpOverlay .dbp-profile img{
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        object-position:center center!important;
        transform:scale(1.72)!important;
        transform-origin:center 24%!important;
        border-radius:50%!important;
      }
      #dbpOverlay .dbp-brand{
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:center!important;
        gap:0!important;
        margin:0!important;
        max-width:none!important;
        min-width:0!important;
      }
      #dbpOverlay .dbp-brand-name{
        display:block!important;
        color:#d9b46f!important;
        font-size:22px!important;
        line-height:1.05!important;
        font-weight:900!important;
        letter-spacing:2.5px!important;
        white-space:nowrap!important;
      }
      #dbpOverlay .dbp-brand-title{
        display:block!important;
        margin-top:9px!important;
        color:#d9b46f!important;
        font-size:10.5px!important;
        line-height:1!important;
        font-weight:800!important;
        letter-spacing:1.75px!important;
        white-space:nowrap!important;
      }
      @media(max-width:430px){
        #dbpOverlay .dbp-profile{width:88px!important;height:88px!important;flex-basis:88px!important}
        #dbpOverlay .dbp-brand-name{font-size:19px!important;letter-spacing:2px!important}
        #dbpOverlay .dbp-brand-title{font-size:9.5px!important;letter-spacing:1.35px!important;margin-top:8px!important}
      }
      @media(max-width:365px){
        #dbpOverlay .dbp-profile-row{gap:12px!important}
        #dbpOverlay .dbp-profile{width:80px!important;height:80px!important;flex-basis:80px!important}
        #dbpOverlay .dbp-brand-name{font-size:17px!important;letter-spacing:1.55px!important}
        #dbpOverlay .dbp-brand-title{font-size:8.5px!important;letter-spacing:1.05px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function formatBrand() {
    var overlay = document.getElementById('dbpOverlay');
    if (!overlay) return;
    var brand = overlay.querySelector('.dbp-brand');
    if (!brand) return;
    brand.innerHTML = '<span class="dbp-brand-name">DIVYA BAJAJ</span><span class="dbp-brand-title">ASTRO-NUMEROLOGIST</span>';
  }

  function apply() {
    injectStyles();
    formatBrand();
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;
    var label = String((target.textContent || '') + ' ' + (target.getAttribute('href') || '')).toLowerCase();
    if (/get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label)) {
      window.setTimeout(apply, 0);
      window.setTimeout(apply, 300);
      window.setTimeout(apply, 1000);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', apply);
  if (document.readyState !== 'loading') apply();
})();
