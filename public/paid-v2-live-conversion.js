(function () {
  if (window.__divyaPaidV2ConversionSafe) return;
  window.__divyaPaidV2ConversionSafe = true;

  var BOOKING_URL = '/consultation';
  var WHATSAPP_URL = 'https://wa.me/919545136766?text=' + encodeURIComponent(
    'Hello Divya, I have checked my Full Blueprint and want to book a one-to-one consultation.'
  );

  function addStyles() {
    if (document.getElementById('divyaPaidV2ConversionStyle')) return;
    var style = document.createElement('style');
    style.id = 'divyaPaidV2ConversionStyle';
    style.textContent = `
      .pb4-conversion{margin-top:18px;padding:22px;border:1px solid rgba(201,169,110,.34);background:linear-gradient(145deg,rgba(201,169,110,.12),rgba(201,169,110,.035));text-align:center}
      .pb4-conversion-kicker{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a96e;font-weight:900}
      .pb4-conversion h4{font-family:Georgia,serif;font-size:25px;line-height:1.16;color:#fff7ec;margin:9px 0 8px}
      .pb4-conversion p{font-size:13px;line-height:1.65;color:#c9bdaf;margin:0 auto 14px;max-width:600px}
      .pb4-conversion-meta{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:13px 0 16px}
      .pb4-conversion-meta span{border:1px solid rgba(201,169,110,.24);padding:7px 10px;color:#e9d8b2;font-size:11px}
      .pb4-conversion-primary,.pb4-conversion-secondary{display:block;text-decoration:none;text-align:center;padding:15px 18px;font-size:11px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase;margin-top:9px}
      .pb4-conversion-primary{background:linear-gradient(135deg,#c9a96e,#ead39c);color:#09070a}
      .pb4-conversion-secondary{border:1px solid rgba(201,169,110,.35);color:#ead39c;background:rgba(255,255,255,.02)}
      .pb4-review-note{margin-top:10px;font-size:11px;color:#8f867b;line-height:1.5}
    `;
    document.head.appendChild(style);
  }

  function enhanceModalOnce() {
    var modal = document.getElementById('paidBlueprintModalV4');
    if (!modal || modal.dataset.conversionEnhanced === 'true') return;

    modal.dataset.conversionEnhanced = 'true';

    var kicker = modal.querySelector('.pb4-kicker');
    var sub = modal.querySelector('.pb4-sub');
    var note = modal.querySelector('.pb4-note');
    var result = modal.querySelector('#pb4Result');

    if (kicker) kicker.textContent = 'Client Review Version';
    if (sub) sub.textContent = 'Generate the current working Full Blueprint using verified astrology, Dasha, location and numerology data. This version is live for client review before the final redesign.';
    if (note) note.textContent = 'No payment is collected in this client-review version. Report generation may take 1 to 3 minutes.';

    if (result) {
      var block = document.createElement('div');
      block.className = 'pb4-conversion';
      block.innerHTML = `
        <div class="pb4-conversion-kicker">Your next step</div>
        <h4>Discuss your exact question with Divya Bajaj</h4>
        <p>Your report shows the main patterns. A personal session helps apply them to your actual choices, timing and present situation.</p>
        <div class="pb4-conversion-meta">
          <span>₹4,999</span>
          <span>60 minutes</span>
          <span>Phone or video</span>
        </div>
        <a class="pb4-conversion-primary" href="${BOOKING_URL}" target="_blank" rel="noopener">Book One-to-One Consultation</a>
        <a class="pb4-conversion-secondary" href="${WHATSAPP_URL}" target="_blank" rel="noopener">Ask on WhatsApp</a>
        <div class="pb4-review-note">For exact timing, choice comparison, compatibility, business-name guidance or a deeper personal question.</div>
      `;
      result.appendChild(block);
    }
  }

  addStyles();

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,a') : null;
    if (!target) return;

    var label = String(target.textContent || '').toLowerCase();
    var href = String(target.getAttribute('href') || '').toLowerCase();
    var isBlueprintTrigger = /get blueprint|full blueprint|advanced report|paid report|go deeper|detailed report/.test(label + ' ' + href);

    if (isBlueprintTrigger || target.closest('#paidBlueprintModalV4')) {
      setTimeout(enhanceModalOnce, 0);
    }
  }, false);
})();
