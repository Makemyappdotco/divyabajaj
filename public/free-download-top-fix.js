(function () {
  'use strict';

  if (window.__divyaFreeDownloadTopFixV4) return;
  window.__divyaFreeDownloadTopFixV4 = true;

  var observedBox = null;
  var resultObserver = null;
  var placing = false;

  function injectStyles() {
    if (document.getElementById('dbFreeDownloadTopStylesV4')) return;

    ['dbFreeDownloadTopStyles', 'dbFreeDownloadTopStylesV2', 'dbFreeDownloadTopStylesV3'].forEach(function (id) {
      var oldStyle = document.getElementById(id);
      if (oldStyle) oldStyle.remove();
    });

    var style = document.createElement('style');
    style.id = 'dbFreeDownloadTopStylesV4';
    style.textContent = `
      #generatedReportBox .db-free-download-slot{display:block!important;width:100%!important;margin:18px 0 22px!important;padding:0!important;position:relative!important}
      #generatedReportBox .db-free-download-slot>.pdf-download-btn,
      #generatedReportBox .db-free-download-primary{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:54px!important;margin:0!important;padding:15px 18px!important;border:1px solid rgba(234,211,156,.55)!important;background:linear-gradient(135deg,#c9a96e,#ead39c)!important;color:#09070a!important;font-weight:900!important;font-size:11px!important;line-height:1.25!important;letter-spacing:1.5px!important;text-align:center!important;text-decoration:none!important;text-transform:uppercase!important;cursor:pointer!important;box-shadow:0 14px 38px rgba(201,169,110,.18)!important}
      body.light #generatedReportBox .db-free-download-slot>.pdf-download-btn,
      body.light #generatedReportBox .db-free-download-primary{background:linear-gradient(135deg,#b78a43,#dfc17f)!important;color:#191107!important;border-color:rgba(145,108,49,.38)!important;box-shadow:0 12px 28px rgba(145,108,49,.16)!important}
      @media(max-width:600px){
        #generatedReportBox .db-free-download-slot{margin:16px 0 20px!important}
        #generatedReportBox .db-free-download-slot>.pdf-download-btn,
        #generatedReportBox .db-free-download-primary{min-height:52px!important;padding:14px 12px!important;font-size:10px!important;letter-spacing:1.25px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function placeDownloadAtReportStart() {
    if (placing) return false;
    placing = true;
    try {
      injectStyles();

      var resultBox = document.getElementById('generatedReportBox');
      if (!resultBox) return false;

      var button = resultBox.querySelector('.pdf-download-btn');
      var reportContent = resultBox.querySelector('.report-content');
      if (!button || !reportContent || !reportContent.parentNode) return false;

      var slot = resultBox.querySelector('.db-free-download-slot');
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'db-free-download-slot';
        slot.setAttribute('data-free-download-position', 'report-start');
      }

      button.classList.remove('free-download-top');
      button.classList.add('db-free-download-primary');

      // The button must sit immediately before the report body. This keeps the
      // result heading / delivery confirmation visible first, followed by the PDF CTA,
      // and only then the long reading itself.
      if (slot.parentNode !== resultBox || slot.nextSibling !== reportContent) {
        resultBox.insertBefore(slot, reportContent);
      }
      if (button.parentNode !== slot) slot.appendChild(button);

      return slot.nextSibling === reportContent && slot.contains(button);
    } finally {
      placing = false;
    }
  }

  function attachResultObserver() {
    var resultBox = document.getElementById('generatedReportBox');
    if (!resultBox) return false;
    if (observedBox === resultBox && resultObserver) {
      placeDownloadAtReportStart();
      return true;
    }

    if (resultObserver) resultObserver.disconnect();
    observedBox = resultBox;
    resultObserver = new MutationObserver(function () {
      // Observe only the free-report result container. The report renderer can
      // replace its children after the API returns, so placement must follow the
      // actual render lifecycle instead of racing it with multi-second timers.
      window.requestAnimationFrame(placeDownloadAtReportStart);
    });
    resultObserver.observe(resultBox, { childList: true, subtree: true });
    placeDownloadAtReportStart();
    return true;
  }

  function hookResultBoxSoon() {
    if (attachResultObserver()) return;
    // The result container normally exists from page load. These two bounded checks
    // only cover late modal mounting; there is no long polling loop.
    window.setTimeout(attachResultObserver, 120);
    window.setTimeout(attachResultObserver, 600);
  }

  document.addEventListener('click', function (event) {
    var submit = event.target && event.target.closest ? event.target.closest('#popupSubmitBtn') : null;
    if (!submit) return;
    hookResultBoxSoon();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyles();
      hookResultBoxSoon();
    }, { once: true });
  } else {
    injectStyles();
    hookResultBoxSoon();
  }
})();
