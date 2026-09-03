(function () {
  'use strict';

  if (window.__divyaPaidDirectLink) return;
  window.__divyaPaidDirectLink = true;

  var nativeFetch = window.fetch.bind(window);
  var reportAccess = null;
  var latestIds = null;
  var accessPromise = null;

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

  async function fetchWithRetry(input, init) {
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
  }

  function setPaidStatus(message, type) {
    var box = document.getElementById('dbpStatus');
    if (!box) return;
    box.className = 'dbp-status show' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  async function issueReportAccess(ids) {
    if (!ids || !ids.report_id || !ids.lead_id) throw new Error('The generated report is missing its private access IDs.');
    if (reportAccess && reportAccess.report_id === ids.report_id) return reportAccess;
    if (accessPromise) return accessPromise;

    accessPromise = nativeFetch('/report-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ report_id: ids.report_id, lead_id: ids.lead_id })
    }).then(async function (response) {
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.success === false) throw new Error(data.error || 'Could not prepare the private report link.');
      reportAccess = data;
      window.__divyaHtmlReportAccess = data;
      updatePaidResultUi();
      return data;
    }).finally(function () {
      accessPromise = null;
    });

    return accessPromise;
  }

  async function capturePaidReport(response) {
    if (!response || !response.ok) return response;
    try {
      var data = await response.clone().json();
      if (data && data.success && data.report_id && data.lead_id) {
        latestIds = { report_id: data.report_id, lead_id: data.lead_id };
        issueReportAccess(latestIds).catch(function (error) {
          console.error('[HTML report access]', error);
        });
      }
    } catch (error) {
      console.error('[Paid report response capture]', error);
    }
    return response;
  }

  window.fetch = async function (input, init) {
    var response = await fetchWithRetry(input, init);
    if (requestPath(input) === '/api/reports/paid-test-v2') return capturePaidReport(response);
    return response;
  };

  function updatePaidResultUi() {
    if (!reportAccess) return;
    var result = document.getElementById('dbpResult');
    var download = document.getElementById('dbpDownload');
    if (!result || !download) return;

    var lead = result.querySelector('.dbp-result-lead');
    if (lead) lead.textContent = 'Read your complete designed report online, or download that same report as a PDF.';

    var view = document.getElementById('dbpViewReport');
    if (!view) {
      view = document.createElement('a');
      view.id = 'dbpViewReport';
      view.className = 'dbp-download dbp-view-report';
      view.target = '_blank';
      view.rel = 'noopener';
      view.textContent = 'Open Full Blueprint';
      download.parentNode.insertBefore(view, download);
    }
    view.href = reportAccess.view_url;
    download.dataset.htmlPdfReady = 'true';

    var raw = document.getElementById('dbpReport');
    if (raw) raw.style.display = 'none';
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('#dbpDownload') : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    var original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing Your PDF...';
    setPaidStatus('Preparing the same designed report as a PDF...', '');

    Promise.resolve(reportAccess || issueReportAccess(latestIds)).then(function (access) {
      if (!access || !access.pdf_url) throw new Error('The private PDF link is not ready.');
      var link = document.createElement('a');
      link.href = access.pdf_url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setPaidStatus('Your Full Blueprint PDF is being downloaded.', 'success');
    }).catch(function (error) {
      setPaidStatus(error.message || 'Could not prepare the designed PDF.', 'error');
    }).finally(function () {
      button.disabled = false;
      button.textContent = original;
    });
  }, true);

  var observer = new MutationObserver(function () { updatePaidResultUi(); });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  var style = document.createElement('style');
  style.textContent = '.dbp-view-report{background:transparent!important;color:#ead39c!important;border:1px solid rgba(201,169,110,.5)!important;box-shadow:none!important;margin-bottom:9px!important}';
  document.head.appendChild(style);

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
