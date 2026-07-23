(function () {
  'use strict';

  if (window.__divyaFreeDownloadTopFixV2) return;
  window.__divyaFreeDownloadTopFixV2 = true;

  var watcher = null;
  var watcherStartedAt = 0;
  var firstPlacedAt = 0;

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

  function comesAfter(reference, element) {
    if (!reference || !element || reference === element) return false;
    return Boolean(reference.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function injectStyles() {
    if (document.getElementById('dbFreeDownloadTopStylesV2')) return;
    var oldStyle = document.getElementById('dbFreeDownloadTopStyles');
    if (oldStyle) oldStyle.remove();

    var style = document.createElement('style');
    style.id = 'dbFreeDownloadTopStylesV2';
    style.textContent = `
      .db-free-download-slot{
        display:block!important;
        width:100%!important;
        margin:0 0 22px!important;
        padding:16px 0 4px!important;
        position:sticky!important;
        top:0!important;
        z-index:20!important;
        background:linear-gradient(180deg,#111015 0%,#111015 82%,rgba(17,16,21,0) 100%)!important;
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
        border:1px solid rgba(234,211,156,.55)!important;
        background:linear-gradient(135deg,#c9a96e,#ead39c)!important;
        color:#09070a!important;
        font-weight:900!important;
        font-size:11px!important;
        line-height:1.25!important;
        letter-spacing:1.5px!important;
        text-align:center!important;
        text-decoration:none!important;
        text-transform:uppercase!important;
        cursor:pointer!important;
        box-shadow:0 14px 38px rgba(201,169,110,.18)!important;
      }
      @media(max-width:600px){
        .db-free-download-slot{margin-bottom:19px!important;padding-top:14px!important}
        .db-free-download-slot>button,.db-free-download-slot>a,.db-free-download-primary{
          min-height:52px!important;padding:14px 12px!important;font-size:10px!important;letter-spacing:1.25px!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  function smallestMatchingElement(root, selector, pattern) {
    var matches = qsa(selector, root).filter(function (element) {
      return visible(element) && pattern.test(normalise(element.textContent));
    });
    matches.sort(function (a, b) {
      return normalise(a.textContent).length - normalise(b.textContent).length;
    });
    return matches[0] || null;
  }

  function findReadyHeading() {
    return smallestMatchingElement(document, 'h1,h2,h3,h4,h5,h6,div,p,strong', /^(your )?free report is ready$/);
  }

  function findDeliveryBox(heading) {
    if (!heading) return null;
    var pattern = /copy of your report.*(sent|delivered).*(email|whatsapp)|copy.*sent instantly.*email.*whatsapp|sent securely.*email.*whatsapp/;
    var candidates = qsa('div,section,aside,p', document).filter(function (element) {
      return visible(element) && comesAfter(heading, element) && pattern.test(normalise(element.textContent));
    });

    candidates.sort(function (a, b) {
      var aText = normalise(a.textContent);
      var bText = normalise(b.textContent);
      var aChildren = a.children.length;
      var bChildren = b.children.length;
      if (aChildren !== bChildren) return aChildren - bChildren;
      return aText.length - bText.length;
    });

    var box = candidates[0] || null;
    if (!box) return null;

    var messageText = normalise(box.textContent);
    var node = box;
    for (var i = 0; i < 3 && node.parentElement; i += 1) {
      var parent = node.parentElement;
      var parentText = normalise(parent.textContent);
      if (parentText.length > messageText.length + 90) break;
      var style = window.getComputedStyle(parent);
      var hasVisualBox = style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        parseFloat(style.borderTopWidth || '0') > 0 || parseFloat(style.borderLeftWidth || '0') > 0;
      if (hasVisualBox) box = parent;
      node = parent;
    }
    return box;
  }

  function findDownloadButton() {
    var candidates = qsa('button,a', document).filter(function (element) {
      var text = normalise(element.textContent);
      return visible(element) && /download pdf copy|download.*pdf|download.*report/.test(text);
    });
    candidates.sort(function (a, b) {
      var aText = normalise(a.textContent);
      var bText = normalise(b.textContent);
      return (/download pdf copy/.test(aText) ? 0 : 1) - (/download pdf copy/.test(bText) ? 0 : 1);
    });
    return candidates[0] || null;
  }

  function isCorrectlyPlaced(slot, deliveryBox, button) {
    return Boolean(
      slot && deliveryBox && button &&
      slot.parentNode === deliveryBox.parentNode &&
      deliveryBox.nextSibling === slot &&
      slot.contains(button)
    );
  }

  function placeDownloadBelowDelivery() {
    injectStyles();

    var heading = findReadyHeading();
    if (!heading) return false;

    var deliveryBox = findDeliveryBox(heading);
    if (!deliveryBox || !deliveryBox.parentNode) return false;

    var button = findDownloadButton();
    if (!button) return false;

    qsa('.db-free-download-slot', document).forEach(function (slot) {
      if (!slot.contains(button)) slot.remove();
    });

    var slot = button.closest('.db-free-download-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'db-free-download-slot';
      slot.setAttribute('data-free-download-position', 'below-delivery-confirmation');
    }

    button.classList.remove('free-download-top');
    button.classList.add('db-free-download-primary');

    if (!isCorrectlyPlaced(slot, deliveryBox, button)) {
      deliveryBox.parentNode.insertBefore(slot, deliveryBox.nextSibling);
      slot.appendChild(button);
    }

    return isCorrectlyPlaced(slot, deliveryBox, button);
  }

  function stopWatcher() {
    if (watcher) window.clearInterval(watcher);
    watcher = null;
  }

  function startWatcher() {
    stopWatcher();
    watcherStartedAt = Date.now();
    firstPlacedAt = 0;

    watcher = window.setInterval(function () {
      var placed = placeDownloadBelowDelivery();
      if (placed && !firstPlacedAt) firstPlacedAt = Date.now();

      // Keep verifying briefly because the older free-report renderer may move the button once after it appears.
      if (firstPlacedAt && Date.now() - firstPlacedAt > 8000) {
        stopWatcher();
        return;
      }
      if (Date.now() - watcherStartedAt > 6 * 60 * 1000) stopWatcher();
    }, 200);
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;
    var label = normalise(target.textContent);

    if (/generate my free report|generate free report|create my free report/.test(label)) {
      window.setTimeout(startWatcher, 0);
    }

    if (/free report|read my numbers free/.test(label)) {
      window.setTimeout(startWatcher, 100);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    window.setTimeout(startWatcher, 150);
  });

  if (document.readyState !== 'loading') {
    injectStyles();
    window.setTimeout(startWatcher, 0);
  }
})();
