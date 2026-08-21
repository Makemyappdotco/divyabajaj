(function () {
  'use strict';

  if (window.__divyaPaidDirectLink) return;
  window.__divyaPaidDirectLink = true;

  var nativeFetch = window.fetch.bind(window);

  function requestPath(input) {
    try {
      var value = typeof input === 'string' ? input : (input && input.url) || '';
      return new URL(value, window.location.origin).pathname;
    } catch (error) {
      return '';
    }
  }

  function shouldRetryNetworkRequest(input) {
    var path = requestPath(input);
    return path === '/api/reports/paid-test-v2' || path === '/api/locations/search';
  }

  function retryMessage(input) {
    return requestPath(input) === '/api/reports/paid-test-v2'
      ? 'The connection was interrupted while your report was being prepared. Please try once more. Your entered details are still here.'
      : 'The location search connection was interrupted. Please type the place again.';
  }

  window.fetch = async function (input, init) {
    if (!shouldRetryNetworkRequest(input)) return nativeFetch(input, init);

    try {
      return await nativeFetch(input, init);
    } catch (firstError) {
      if (firstError && firstError.name === 'AbortError') throw firstError;
      await new Promise(function (resolve) { setTimeout(resolve, 900); });
      try {
        return await nativeFetch(input, init);
      } catch (secondError) {
        if (secondError && secondError.name === 'AbortError') throw secondError;
        var friendlyError = new Error(retryMessage(input));
        friendlyError.cause = secondError;
        throw friendlyError;
      }
    }
  };

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
