(function () {
  'use strict';

  if (window.__divyaRevealFailsafe) return;
  window.__divyaRevealFailsafe = true;

  function revealEverything() {
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (element) {
      element.classList.add('vis');
      element.style.opacity = '';
      element.style.transform = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.setTimeout(revealEverything, 1800);
    }, { once: true });
  } else {
    window.setTimeout(revealEverything, 1800);
  }

  window.addEventListener('load', function () {
    window.setTimeout(revealEverything, 600);
  }, { once: true });
})();
