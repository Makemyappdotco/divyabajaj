(function () {
  'use strict';

  if (window.__divyaFreeDownloadTopFixV3) return;
  window.__divyaFreeDownloadTopFixV3 = true;

  function injectStyles() {
    if (document.getElementById('dbFreeDownloadTopStylesV3')) return;

    ['dbFreeDownloadTopStyles', 'dbFreeDownloadTopStylesV2'].forEach(function (id) {
      var oldStyle = document.getElementById(id);
      if (oldStyle) oldStyle.remove();
    });

    var style = document.createElement('style');
    style.id = 'dbFreeDownloadTopStylesV3';
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

  function placeDownloadBelowConfirmation() {
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
      slot.setAttribute('data-free-download-position', 'below-delivery-confirmation');
    }

    button.classList.remove('free-download-top');
    button.classList.add('db-free-download-primary');

    if (slot.parentNode !== resultBox || slot.nextSibling !== reportContent) {
      resultBox.insertBefore(slot, reportContent);
    }
    if (button.parentNode !== slot) slot.appendChild(button);

    return slot.nextSibling === reportContent && slot.contains(button);
  }

  function schedulePlacement() {
    [50, 180, 450, 900, 1600, 3000, 5000].forEach(function (delay) {
      window.setTimeout(placeDownloadBelowConfirmation, delay);
    });
  }

  document.addEventListener('click', function (event) {
    var submit = event.target && event.target.closest ? event.target.closest('#popupSubmitBtn') : null;
    if (submit) schedulePlacement();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyles();
      placeDownloadBelowConfirmation();
    }, { once: true });
  } else {
    injectStyles();
    placeDownloadBelowConfirmation();
  }
})();
