(function () {
  'use strict';

  if (window.__divyaPaidDirectLink) return;
  window.__divyaPaidDirectLink = true;

  var nativeFetch = window.fetch.bind(window);
  var lastReportJson = null;

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

  async function rememberStructuredReport(input, response) {
    if (requestPath(input) !== '/api/reports/paid-test-v2' || !response || !response.ok) return response;
    try {
      var clone = response.clone();
      var data = await clone.json();
      if (data && data.report_json && typeof data.report_json === 'object') {
        lastReportJson = data.report_json;
        window.__divyaPaidReportJson = data.report_json;
      }
    } catch (error) {}
    return response;
  }

  function withStructuredReport(input, init) {
    if (requestPath(input) !== '/api/reports/pdf-direct') return init;
    var reportJson = lastReportJson || window.__divyaPaidReportJson;
    if (!reportJson || !init || typeof init.body !== 'string') return init;

    try {
      var body = JSON.parse(init.body || '{}');
      if (!body.report_json) body.report_json = reportJson;
      var next = {};
      Object.keys(init).forEach(function (key) { next[key] = init[key]; });
      next.body = JSON.stringify(body);
      return next;
    } catch (error) {
      return init;
    }
  }

  window.fetch = async function (input, init) {
    var nextInit = withStructuredReport(input, init);

    if (!shouldRetryNetworkRequest(input)) {
      return rememberStructuredReport(input, await nativeFetch(input, nextInit));
    }

    try {
      return rememberStructuredReport(input, await nativeFetch(input, nextInit));
    } catch (firstError) {
      if (firstError && firstError.name === 'AbortError') throw firstError;
      await new Promise(function (resolve) { setTimeout(resolve, 900); });
      try {
        return rememberStructuredReport(input, await nativeFetch(input, nextInit));
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
    if (typeof window.openPaidBlueprint === 'function') window.openPaidBlueprint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openDirectPaidLink, { once: true });
  } else {
    openDirectPaidLink();
  }
})();
