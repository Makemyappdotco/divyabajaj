(function () {
  'use strict';

  if (window.__divyaFreeDownloadTopFix) return;
  window.__divyaFreeDownloadTopFix = true;

  var watcher = null;
  var watcherStartedAt = 0;

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function normalise(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function visible(element) {
    if (!element || !element.isConnected) return false;
    var style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }

  function injectStyles() {
    if (document.getElementById('dbFreeDownloadTopStyles')) return;
    var style = document.createElement('style');
    style.id = 'dbFreeDownloadTopStyles';
    style.textContent = `
      .db-free-download-slot{
        display:block!important;
        width:100%!important;
        margin:18px 0 22px!important;
        position:relative!important;
        z-index:3!important;
      }
      .db-free-download-slot>button,
      .db-free-download-slot>a,
      .db-free-download-primary{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:100%!important;
        min-height:54px!important;
        margin:0!important;
        padding:15px 18px!important;
        border:0!important;
        background:linear-gradient(135deg,#c9a96e,#ead39c)!important;
        color:#09070a!important;
        font-weight:800!important;
        font-size:11px!important;
        line-height:1.25!important;
        letter-spacing:1.5px!important;
        text-align:center!important;
        text-decoration:none!important;
        text-transform:uppercase!important;
        cursor:pointer!important;
        box-shadow:0 14px 38px rgba(201,169,110,.16)!important;
      }
      @media(max-width:600px){
        .db-free-download-slot{margin:15px 0 19px!important}
        .db-free-download-slot>button,.db-free-download-slot>a,.db-free-download-primary{min-height:52px!important;padding:14px 12px!important;font-size:10px!important;letter-spacing:1.25px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function smallestMatchingElement(root, pattern) {
    var matches = qsa('h1,h2,h3,h4,h5,h6,p,div,span,strong', root).filter(function (element) {
      var text = normalise(element.textContent);
      return visible(element) && pattern.test(text);
    });
    matches.sort(function (a, b) {
      return normalise(a.textContent).length - normalise(b.textContent).length;
    });
    return matches[0] || null;
  }

  function findReadyHeading() {
    return smallestMatchingElement(document, /your free report is ready|free report is ready/);
  }

  function findResultRoot(heading) {
    if (!heading) return null;

    var preferred = heading.closest('[role="dialog"],[class*="popup" i],[id*="popup" i],[class*="modal" i],[id*="modal" i]');
    if (preferred) return preferred;

    var node = heading.parentElement;
    for (var i = 0; i < 12 && node && node !== document.body; i += 1, node = node.parentElement) {
      var text = normalise(node.textContent);
      var hasDownload = qsa('button,a', node).some(function (element) {
        return /download pdf copy|download.*pdf|download.*report/.test(normalise(element.textContent));
      });
      if (hasDownload && /free report is ready/.test(text)) return node;
    }

    return heading.parentElement;
  }

  function findDownloadButton(root) {
    var candidates = qsa('button,a', root || document).filter(function (element) {
      var text = normalise(element.textContent);
      return visible(element) && /download pdf copy|download.*pdf|download.*report/.test(text);
    });

    candidates.sort(function (a, b) {
      var aText = normalise(a.textContent);
      var bText = normalise(b.textContent);
      var aScore = /download pdf copy/.test(aText) ? 0 : 1;
      var bScore = /download pdf copy/.test(bText) ? 0 : 1;
      return aScore - bScore;
    });

    return candidates[0] || null;
  }

  function findDeliveryMessage(root) {
    return smallestMatchingElement(root, /copy.*(sent|delivered).*(email|whatsapp)|sent instantly.*(email|whatsapp)|email and whatsapp/);
  }

  function placeDownloadAtTop() {
    injectStyles();

    var heading = findReadyHeading();
    if (!heading) return false;

    var root = findResultRoot(heading);
    var button = findDownloadButton(root);
    if (!button) button = findDownloadButton(document);
    if (!button) return false;

    var existingSlot = root && root.querySelector('.db-free-download-slot');
    if (existingSlot && existingSlot.contains(button)) return true;

    var slot = existingSlot || document.createElement('div');
    slot.className = 'db-free-download-slot';
    slot.setAttribute('data-free-download-position', 'top');

    var deliveryMessage = findDeliveryMessage(root || document);
    var anchor = deliveryMessage || heading;

    if (!slot.isConnected) {
      if (anchor.parentNode) anchor.parentNode.insertBefore(slot, anchor.nextSibling);
      else return false;
    }

    button.classList.add('db-free-download-primary');
    slot.appendChild(button);
    return true;
  }

  function stopWatcher() {
    if (watcher) window.clearInterval(watcher);
    watcher = null;
  }

  function startWatcher() {
    stopWatcher();
    watcherStartedAt = Date.now();

    if (placeDownloadAtTop()) return;

    watcher = window.setInterval(function () {
      if (placeDownloadAtTop()) {
        stopWatcher();
        return;
      }
      if (Date.now() - watcherStartedAt > 6 * 60 * 1000) stopWatcher();
    }, 250);
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;
    var label = normalise(target.textContent);

    if (/generate my free report|generate free report|create my free report/.test(label)) {
      window.setTimeout(startWatcher, 0);
    }

    if (/free report|read my numbers free/.test(label)) {
      window.setTimeout(placeDownloadAtTop, 100);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    window.setTimeout(placeDownloadAtTop, 100);
    window.setTimeout(placeDownloadAtTop, 600);
  });

  if (document.readyState !== 'loading') {
    injectStyles();
    window.setTimeout(placeDownloadAtTop, 0);
  }
})();
