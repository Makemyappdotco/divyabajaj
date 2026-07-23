(function () {
  'use strict';

  if (window.__divyaPaidProfileRepairV5) return;
  window.__divyaPaidProfileRepairV5 = true;

  var IMAGE_URL = '/divya-profile.png?v=3';

  function injectStyles() {
    if (document.getElementById('dbPaidProfileRepairStylesV5')) return;

    ['dbPaidProfileRepairStylesV2', 'dbPaidProfileRepairStylesV3', 'dbPaidProfileRepairStylesV4'].forEach(function (id) {
      var previous = document.getElementById(id);
      if (previous) previous.remove();
    });

    var style = document.createElement('style');
    style.id = 'dbPaidProfileRepairStylesV5';
    style.textContent = `
      #dbpOverlay .dbp-profile-row{display:flex!important;align-items:center!important;gap:16px!important;margin:0 0 14px!important}
      #dbpOverlay .dbp-profile{width:92px!important;height:92px!important;flex:0 0 92px!important;border-radius:50%!important;overflow:hidden!important;padding:3px!important;border:1px solid rgba(201,169,110,.78)!important;background:#151117!important;box-shadow:0 12px 30px rgba(0,0,0,.34),0 0 0 6px rgba(201,169,110,.045)!important}
      #dbpOverlay .dbp-profile img{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center!important;border-radius:50%!important;transform:none!important}
      #dbpOverlay .dbp-brand{display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;gap:7px!important;margin:0!important;max-width:none!important;min-width:0!important;line-height:1!important}
      #dbpOverlay .dbp-brand-name{display:block!important;color:#d8b36e!important;font-size:24px!important;line-height:1!important;font-weight:900!important;letter-spacing:2.2px!important;white-space:nowrap!important}
      #dbpOverlay .dbp-brand-title{display:block!important;color:#d8b36e!important;font-size:12px!important;line-height:1.15!important;font-weight:800!important;letter-spacing:1.8px!important;white-space:nowrap!important}
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

  function ensureProfile() {
    injectStyles();

    var overlay = document.getElementById('dbpOverlay');
    if (!overlay) return false;

    var aside = overlay.querySelector('.dbp-aside');
    var brand = overlay.querySelector('.dbp-brand');
    var priceTag = overlay.querySelector('.dbp-price-tag');
    if (!aside || !brand) return false;

    brand.innerHTML = '<span class="dbp-brand-name">DIVYA BAJAJ</span><span class="dbp-brand-title">ASTRO-NUMEROLOGIST</span>';

    var row = aside.querySelector('.dbp-profile-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'dbp-profile-row';
      if (priceTag && priceTag.parentNode === aside) aside.insertBefore(row, priceTag);
      else aside.insertBefore(row, aside.firstChild);
    }

    var profile = row.querySelector('.dbp-profile');
    if (!profile) {
      profile = document.createElement('div');
      profile.className = 'dbp-profile';
      profile.setAttribute('role', 'img');
      profile.setAttribute('aria-label', 'Divya Bajaj');
      row.insertBefore(profile, row.firstChild);
    }

    var image = profile.querySelector('img');
    if (!image) {
      image = document.createElement('img');
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      profile.appendChild(image);
    }

    image.onerror = function () {
      image.style.visibility = 'hidden';
    };
    image.onload = function () {
      image.style.visibility = 'visible';
    };
    if (image.getAttribute('src') !== IMAGE_URL) image.setAttribute('src', IMAGE_URL);

    if (!row.contains(brand)) row.appendChild(brand);
    if (priceTag && row.nextSibling !== priceTag) aside.insertBefore(priceTag, row.nextSibling);

    return true;
  }

  function scheduleRepair() {
    [0, 80, 240].forEach(function (delay) {
      window.setTimeout(ensureProfile, delay);
    });
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!trigger) return;
    var label = String(trigger.textContent || '').trim().toLowerCase();
    if (/get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label)) scheduleRepair();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureProfile, { once: true });
  } else {
    ensureProfile();
  }
})();
