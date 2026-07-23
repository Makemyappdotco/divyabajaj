(function () {
  'use strict';

  if (window.__divyaPaidProfileRepair) return;
  window.__divyaPaidProfileRepair = true;

  function normalise(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
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

  function ensureLayout(overlay) {
    var aside = overlay && overlay.querySelector('.dbp-aside');
    var brand = overlay && overlay.querySelector('.dbp-brand');
    var price = overlay && overlay.querySelector('.dbp-price-tag');
    if (!aside || !brand) return null;

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
    var overlay = document.getElementById('dbpOverlay');
    if (!overlay) return false;

    var target = ensureLayout(overlay);
    if (!target) return false;

    var portrait = findBestPortrait();
    if (!portrait) {
      target.removeAttribute('src');
      target.style.display = 'none';
      var profile = target.closest('.dbp-profile');
      if (profile) profile.style.display = 'none';
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
    window.setTimeout(applyPortrait, 300);
  });

  if (document.readyState !== 'loading') window.setTimeout(applyPortrait, 0);
})();
