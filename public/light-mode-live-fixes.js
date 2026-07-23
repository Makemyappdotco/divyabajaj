(function () {
  'use strict';

  if (window.__divyaLightModeLiveFixes) return;
  window.__divyaLightModeLiveFixes = true;

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function normalise(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function colourIsLight(value) {
    var match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return false;
    var r = Number(match[1]);
    var g = Number(match[2]);
    var b = Number(match[3]);
    return ((r * 299 + g * 587 + b * 114) / 1000) > 170;
  }

  function pageIsLight() {
    var html = document.documentElement;
    var body = document.body;
    var classes = normalise((html && html.className) + ' ' + (body && body.className));

    if (/(^|\s)(light|light-mode|theme-light)(\s|$)/.test(classes)) return true;
    if (/(^|\s)(dark|dark-mode|theme-dark)(\s|$)/.test(classes)) return false;

    var nodes = [body, document.querySelector('main'), document.querySelector('.page'), document.querySelector('.site')].filter(Boolean);
    for (var i = 0; i < nodes.length; i += 1) {
      var background = window.getComputedStyle(nodes[i]).backgroundColor;
      if (background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
        return colourIsLight(background);
      }
    }
    return false;
  }

  function injectStyles() {
    if (document.getElementById('dbLightModeLiveFixStyles')) return;

    var style = document.createElement('style');
    style.id = 'dbLightModeLiveFixStyles';
    style.textContent = `
      .db-faq-clean{
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
        outline:0!important;
        border-radius:0!important;
        padding-left:0!important;
        padding-right:0!important;
      }
      .db-faq-clean::before,.db-faq-clean::after{display:none!important;content:none!important}

      body.db-page-light .db-vip-availability{
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        width:max-content!important;
        max-width:100%!important;
        margin-top:16px!important;
        padding:8px 11px!important;
        border:1px solid rgba(156,71,55,.28)!important;
        background:rgba(255,244,237,.92)!important;
        color:#963f34!important;
        opacity:1!important;
        visibility:visible!important;
        font-weight:800!important;
        line-height:1.35!important;
        text-shadow:none!important;
      }
      body.db-page-light .db-vip-availability::before{
        content:'';
        width:7px;
        height:7px;
        flex:0 0 7px;
        border-radius:50%;
        background:#cf6c5d;
        box-shadow:0 0 0 4px rgba(207,108,93,.12);
      }

      body.db-page-light .db-save-visibility{
        display:flex!important;
        align-items:center!important;
        min-height:34px!important;
        padding:8px 12px!important;
        border:1px solid #b9dfc5!important;
        background:#e7f6eb!important;
        color:#26764b!important;
        opacity:1!important;
        visibility:visible!important;
        font-weight:900!important;
        letter-spacing:1.25px!important;
        text-shadow:none!important;
      }

      .dbp-overlay.dbp-light-mode{
        background:rgba(236,225,207,.78)!important;
        backdrop-filter:blur(18px)!important;
        -webkit-backdrop-filter:blur(18px)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-shell{
        border-color:rgba(151,109,51,.34)!important;
        background:#fffaf2!important;
        color:#211a15!important;
        box-shadow:0 40px 110px rgba(76,52,25,.28)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-aside{
        background:radial-gradient(circle at 14% 4%,rgba(181,132,64,.16),transparent 34%),linear-gradient(165deg,#fff8ec,#f3e5cf 76%)!important;
        border-color:rgba(151,109,51,.2)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-aside::after{
        border-color:rgba(151,109,51,.11)!important;
        box-shadow:0 0 0 35px rgba(151,109,51,.035),0 0 0 70px rgba(151,109,51,.022)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-close{
        border-color:rgba(151,109,51,.32)!important;
        background:rgba(255,255,255,.72)!important;
        color:#7e5725!important;
        box-shadow:0 8px 25px rgba(84,57,26,.1)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-close:hover{background:#fff!important}
      .dbp-overlay.dbp-light-mode .dbp-brand-name,
      .dbp-overlay.dbp-light-mode .dbp-brand-title,
      .dbp-overlay.dbp-light-mode .dbp-brand,
      .dbp-overlay.dbp-light-mode .dbp-eyebrow,
      .dbp-overlay.dbp-light-mode .dbp-label{color:#8d642c!important}
      .dbp-overlay.dbp-light-mode .dbp-profile{
        border-color:rgba(151,109,51,.66)!important;
        background:#f1e4d1!important;
        box-shadow:0 12px 30px rgba(84,57,26,.16),0 0 0 6px rgba(151,109,51,.045)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-price-tag{
        border-color:rgba(151,109,51,.3)!important;
        background:rgba(181,132,64,.09)!important;
        color:#73501f!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-aside h2,
      .dbp-overlay.dbp-light-mode .dbp-main h3,
      .dbp-overlay.dbp-light-mode .dbp-result h4,
      .dbp-overlay.dbp-light-mode .dbp-upsell strong{color:#211912!important}
      .dbp-overlay.dbp-light-mode .dbp-aside-copy,
      .dbp-overlay.dbp-light-mode .dbp-main-head p,
      .dbp-overlay.dbp-light-mode .dbp-result-lead,
      .dbp-overlay.dbp-light-mode .dbp-upsell p{color:#6f6255!important}
      .dbp-overlay.dbp-light-mode .dbp-benefit{color:#332920!important}
      .dbp-overlay.dbp-light-mode .dbp-benefit i{
        background:rgba(151,109,51,.11)!important;
        color:#8d642c!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-trust{
        border-color:rgba(151,109,51,.15)!important;
        color:#7b6e60!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-main{
        background:radial-gradient(circle at 100% 0,rgba(181,132,64,.07),transparent 26%),#fffaf3!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-input,
      .dbp-overlay.dbp-light-mode .dbp-select,
      .dbp-overlay.dbp-light-mode .dbp-textarea{
        border-color:rgba(151,109,51,.3)!important;
        background:rgba(255,255,255,.78)!important;
        color:#241c15!important;
        box-shadow:none!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-select{color-scheme:light!important}
      .dbp-overlay.dbp-light-mode .dbp-select option{background:#fffaf3!important;color:#241c15!important}
      .dbp-overlay.dbp-light-mode .dbp-input::placeholder,
      .dbp-overlay.dbp-light-mode .dbp-textarea::placeholder{color:#938577!important;opacity:1!important}
      .dbp-overlay.dbp-light-mode .dbp-input:focus,
      .dbp-overlay.dbp-light-mode .dbp-select:focus,
      .dbp-overlay.dbp-light-mode .dbp-textarea:focus{
        border-color:#9b6d2f!important;
        background:#fff!important;
        box-shadow:0 0 0 3px rgba(155,109,47,.1)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-help,
      .dbp-overlay.dbp-light-mode .dbp-location-status,
      .dbp-overlay.dbp-light-mode .dbp-optional{color:#75695d!important}
      .dbp-overlay.dbp-light-mode .dbp-suggestions{
        border-color:rgba(151,109,51,.34)!important;
        background:#fffaf3!important;
        box-shadow:0 20px 55px rgba(84,57,26,.2)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-suggestion{
        border-color:rgba(151,109,51,.12)!important;
        color:#2d241c!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-suggestion:hover,
      .dbp-overlay.dbp-light-mode .dbp-suggestion:focus{background:rgba(181,132,64,.1)!important}
      .dbp-overlay.dbp-light-mode .dbp-suggestion small{color:#776a5d!important}
      .dbp-overlay.dbp-light-mode .dbp-actions,
      .dbp-overlay.dbp-light-mode .dbp-result{border-color:rgba(151,109,51,.16)!important}
      .dbp-overlay.dbp-light-mode .dbp-status{
        border-color:rgba(151,109,51,.22)!important;
        background:rgba(181,132,64,.06)!important;
        color:#5f5348!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-report{
        border-color:rgba(151,109,51,.18)!important;
        background:rgba(255,255,255,.7)!important;
        color:#4e4339!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-upsell{
        border-color:rgba(151,109,51,.28)!important;
        background:linear-gradient(145deg,rgba(181,132,64,.12),rgba(255,255,255,.58))!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-meta span{
        border-color:rgba(151,109,51,.26)!important;
        color:#76511f!important;
        background:rgba(255,255,255,.55)!important;
      }
      .dbp-overlay.dbp-light-mode .dbp-submit,
      .dbp-overlay.dbp-light-mode .dbp-download,
      .dbp-overlay.dbp-light-mode .dbp-consult{
        background:linear-gradient(135deg,#a97732,#d6ad69)!important;
        color:#fffdf8!important;
        box-shadow:0 14px 34px rgba(145,98,38,.2)!important;
      }

      @media(max-width:820px){
        .dbp-overlay.dbp-light-mode .dbp-aside{border-bottom-color:rgba(151,109,51,.19)!important}
        .dbp-overlay.dbp-light-mode .dbp-close{background:#fff8ee!important}
      }
    `;
    document.head.appendChild(style);
  }

  function replaceTextNodes(root, pattern, replacement) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (pattern.test(node.nodeValue || '')) node.nodeValue = String(node.nodeValue || '').replace(pattern, replacement);
    });
  }

  function improveVipAvailability() {
    qsa('body *').forEach(function (element) {
      if (element.children.length > 3) return;
      var text = normalise(element.textContent);
      if (!/only\s*5\s*private\s*sessions?\s*per\s*(month|week)/.test(text)) return;
      replaceTextNodes(element, /per\s*month/ig, 'per week');
      element.classList.add('db-vip-availability');
    });
  }

  function improveSaveVisibility() {
    qsa('body *').forEach(function (element) {
      if (element.children.length > 1) return;
      if (/^save\s*80%$/.test(normalise(element.textContent))) element.classList.add('db-save-visibility');
    });
  }

  function cleanFaqWrapper() {
    var pattern = /exact birth time|astrotalk|free horoscopes|paid report|follow-up questions|does not resonate|astrology before|vague/;
    var questions = qsa('button,summary,h2,h3,h4,[class*="faq"],[class*="question"]').filter(function (element) {
      return pattern.test(normalise(element.textContent));
    });

    if (questions.length < 3) return;

    var root = questions[0].parentElement;
    while (root && root !== document.body) {
      var count = questions.filter(function (question) { return root.contains(question); }).length;
      if (count >= Math.min(questions.length, 4)) break;
      root = root.parentElement;
    }

    if (!root || root === document.body) return;
    root.classList.add('db-faq-clean');
  }

  function syncTheme() {
    var light = pageIsLight();
    if (document.body) document.body.classList.toggle('db-page-light', light);
    var overlay = document.getElementById('dbpOverlay');
    if (overlay) overlay.classList.toggle('dbp-light-mode', light);
  }

  function runFixes() {
    injectStyles();
    improveVipAvailability();
    improveSaveVisibility();
    cleanFaqWrapper();
    syncTheme();
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!trigger) return;
    var label = normalise((trigger.textContent || '') + ' ' + (trigger.getAttribute('href') || ''));
    if (/get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label)) {
      window.setTimeout(syncTheme, 0);
      window.setTimeout(syncTheme, 80);
      window.setTimeout(syncTheme, 300);
    }
  }, true);

  var observer = new MutationObserver(function () {
    window.clearTimeout(observer._timer);
    observer._timer = window.setTimeout(runFixes, 40);
  });

  if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      runFixes();
      window.setTimeout(runFixes, 400);
      window.setTimeout(runFixes, 1200);
    }, { once:true });
  } else {
    runFixes();
    window.setTimeout(runFixes, 400);
  }
})();
