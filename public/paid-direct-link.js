(function () {
  'use strict';

  if (window.__divyaPaidDirectLink) return;
  window.__divyaPaidDirectLink = true;

  function shouldOpenPaidBlueprint() {
    var path = String(window.location.pathname || '').replace(/\/+$/, '') || '/';
    var params = new URLSearchParams(window.location.search || '');
    return path === '/full-blueprint' || path === '/paid-report' || params.get('open') === 'full-blueprint';
  }

  function openDirectPaidLink() {
    if (!shouldOpenPaidBlueprint()) return;
    if (typeof window.openPaidBlueprint === 'function') {
      window.openPaidBlueprint();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openDirectPaidLink, { once: true });
  } else {
    openDirectPaidLink();
  }
})();
