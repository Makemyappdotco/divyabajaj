/**
 * Consultation booking, as a modal on the landing page.
 *
 * Injected before </body> by sendLandingWithPatches, the same way the other
 * live patches are, so the 5.6MB landing.html is never edited.
 *
 * Theming is free: every colour below is one of the landing page's own custom
 * properties (--bg2, --gold, --text ...), which body.light already redefines.
 * The modal therefore follows whatever mode the visitor chose, with no theme
 * code of its own and nothing to keep in sync.
 *
 * /consultation stays exactly as it is - same API, same flow - for anyone
 * arriving on the link directly.
 */
(function () {
  'use strict';
  if (window.__dbBookingModal) return;
  window.__dbBookingModal = true;

  var API = '/api/booking';
  var IST = 'Asia/Kolkata';
  var state = { days: [], slot: null, hold: null, tick: null, loaded: false };

  // ---------------------------------------------------------------- styles

  var CSS = [
    '.dbm-veil{position:fixed;inset:0;z-index:10000;background:rgba(6,5,8,.72);',
    '  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
    '  display:flex;align-items:center;justify-content:center;padding:24px;',
    '  opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s}',
    '.dbm-veil.on{opacity:1;visibility:visible}',
    'body.light .dbm-veil{background:rgba(42,37,32,.42)}',

    '.dbm{position:relative;width:100%;max-width:620px;max-height:88vh;overflow-y:auto;',
    '  background:var(--bg2);border:1px solid var(--sl);border-radius:18px;',
    '  box-shadow:0 30px 90px rgba(0,0,0,.5);padding:30px 30px 26px;',
    '  transform:translateY(18px) scale(.985);opacity:0;transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .3s}',
    '.dbm-veil.on .dbm{transform:none;opacity:1}',
    'body.light .dbm{box-shadow:0 30px 80px rgba(42,37,32,.16)}',

    '.dbm-x{position:absolute;right:16px;top:14px;width:34px;height:34px;border:0;background:none;',
    '  color:var(--text-m);font-size:24px;line-height:1;cursor:pointer;border-radius:50%;transition:color .15s,background .15s}',
    '.dbm-x:hover{color:var(--text);background:var(--sl)}',

    '.dbm-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:600}',
    '.dbm h2{font-family:var(--serif);font-size:26px;font-weight:600;color:var(--ivory);margin:9px 0 0;line-height:1.15;letter-spacing:-.01em}',
    '.dbm-sub{color:var(--text-m);font-size:14px;margin-top:7px;line-height:1.55}',
    '.dbm-facts{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}',
    '.dbm-fact{font-size:12px;color:var(--gold);border:1px solid var(--sl);border-radius:30px;padding:4px 12px;white-space:nowrap}',
    '.dbm-hr{height:1px;background:linear-gradient(90deg,var(--gold),transparent);opacity:.4;margin:20px 0}',

    '.dbm-lbl{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-s);font-weight:600;margin-bottom:11px}',
    // The native horizontal scrollbar under the day strip looked like a bug.
    // It is hidden and replaced with arrows plus a fade at each edge, which is
    // also the only affordance that reads on a desktop trackpad.
    '.dbm-strip{position:relative;margin:0 -4px}',
    '.dbm-days{display:flex;gap:8px;overflow-x:auto;padding:2px 4px 4px;scroll-behavior:smooth;',
    '  scrollbar-width:none;-ms-overflow-style:none}',
    '.dbm-days::-webkit-scrollbar{display:none}',
    '.dbm-arrow{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;z-index:2;',
    '  border-radius:50%;border:1px solid var(--sl);background:var(--bg2);color:var(--text-m);',
    '  cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;',
    '  transition:opacity .2s,color .16s,border-color .16s}',
    '.dbm-arrow:hover{color:var(--gold);border-color:var(--gold-d)}',
    '.dbm-arrow.l{left:-6px}.dbm-arrow.r{right:-6px}',
    '.dbm-arrow[hidden]{opacity:0;pointer-events:none}',

    '.dbm-day{flex:none;min-width:82px;text-align:center;border:1px solid var(--sl);background:transparent;',
    '  border-radius:14px;padding:12px 10px 11px;cursor:pointer;color:var(--text);position:relative;',
    '  transition:border-color .18s,background .18s,transform .18s}',
    '.dbm-day:hover{border-color:var(--gold-d);transform:translateY(-1px)}',
    '.dbm-day[aria-pressed="true"]{border-color:var(--gold);background:var(--gold-glow)}',
    '.dbm-day[aria-pressed="true"] .dbm-dn{color:var(--gold)}',
    '.dbm-wd{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-s)}',
    '.dbm-dn{font-family:var(--serif);font-size:23px;font-weight:600;color:var(--ivory);line-height:1;margin-top:4px;transition:color .18s}',
    '.dbm-mo{font-size:10.5px;color:var(--text-s);margin-top:3px}',
    '.dbm-free{font-size:10px;color:var(--gold);margin-top:6px;opacity:.85}',

    '.dbm-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:9px;margin-top:18px}',
    '.dbm-slot{border:1px solid var(--sl);background:transparent;border-radius:11px;padding:13px 6px;',
    '  font-size:14.5px;color:var(--text);cursor:pointer;font-variant-numeric:tabular-nums;',
    '  font-family:var(--sans);transition:border-color .16s,background .16s,color .16s,transform .16s}',
    '.dbm-slot:hover{border-color:var(--gold-d);transform:translateY(-1px)}',
    '.dbm-slot[aria-pressed="true"]{border-color:var(--gold);background:var(--gold-glow);color:var(--gold);font-weight:600}',
    '.dbm-holding{color:var(--gold);opacity:.85}',

    '.dbm-picked{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--bg3);',
    '  border-radius:11px;padding:12px 15px;font-size:14px;color:var(--text)}',
    '.dbm-picked strong{font-family:var(--serif);color:var(--ivory);font-weight:600}',
    '.dbm-change{margin-left:auto;font-size:12.5px;color:var(--gold);background:none;border:0;cursor:pointer;text-decoration:underline;font-family:var(--sans)}',
    '.dbm-timer{font-size:12.5px;color:var(--text-s);margin-top:10px}',
    '.dbm-timer b{color:var(--gold);font-variant-numeric:tabular-nums}',

    '.dbm-row{display:grid;grid-template-columns:1fr 1fr;gap:11px}',
    '@media (max-width:520px){.dbm-row{grid-template-columns:1fr}}',
    '.dbm-f{margin-top:12px}',
    '.dbm-f label{display:block;font-size:12px;color:var(--text-m);margin-bottom:5px}',
    '.dbm-f label span{color:var(--text-s)}',
    '.dbm-f input,.dbm-f select,.dbm-f textarea{width:100%;background:var(--bg);border:1px solid var(--sl);',
    '  border-radius:10px;padding:11px 13px;color:var(--text);font-family:var(--sans);font-size:14px}',
    '.dbm-f input:focus,.dbm-f select:focus,.dbm-f textarea:focus{outline:none;border-color:var(--gold)}',
    '.dbm-f textarea{min-height:74px;resize:vertical}',
    '.dbm-f input::placeholder,.dbm-f textarea::placeholder{color:var(--text-s)}',

    '.dbm-go{width:100%;margin-top:20px;padding:15px 22px;border:0;border-radius:11px;cursor:pointer;',
    '  background:var(--gold);color:#100D08;font-family:var(--sans);font-size:15px;font-weight:600;',
    '  letter-spacing:.01em;transition:opacity .16s,transform .16s}',
    '.dbm-go:hover:not(:disabled){opacity:.9;transform:translateY(-1px)}',
    '.dbm-go:disabled{opacity:.42;cursor:not-allowed;transform:none}',

    '.dbm-msg{border-radius:10px;padding:11px 14px;font-size:13px;margin-top:13px;line-height:1.5}',
    '.dbm-msg.bad{border:1px solid rgba(210,70,70,.5);color:#e78080;background:rgba(210,70,70,.07)}',
    'body.light .dbm-msg.bad{color:#a11b28;background:rgba(161,27,40,.05)}',

    '.dbm-empty{text-align:center;padding:34px 16px;color:var(--text-m);font-size:14px;line-height:1.6}',
    '.dbm-empty b{display:block;font-family:var(--serif);font-size:17px;color:var(--ivory);margin-bottom:7px;font-weight:600}',
    '.dbm-skel{height:66px;border-radius:12px;background:var(--bg3);position:relative;overflow:hidden}',
    '.dbm-skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);',
    '  background:linear-gradient(90deg,transparent,var(--sl),transparent);animation:dbmSh 1.4s infinite}',
    '@keyframes dbmSh{100%{transform:translateX(100%)}}',

    '.dbm-done{text-align:center;padding:16px 4px 6px}',
    '.dbm-tick{width:58px;height:58px;border-radius:50%;background:var(--gold-glow);border:1px solid var(--gold);',
    '  color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:27px;margin:0 auto 16px}',
    '.dbm-done h3{font-family:var(--serif);font-size:23px;font-weight:600;color:var(--ivory)}',
    '.dbm-when{font-family:var(--serif);font-size:19px;color:var(--gold);margin-top:12px}',
    '.dbm-done p{color:var(--text-m);font-size:14px;margin-top:12px;line-height:1.6;max-width:44ch;margin-left:auto;margin-right:auto}',
    '.dbm-wa{display:inline-flex;align-items:center;gap:9px;margin-top:20px;padding:14px 26px;border-radius:11px;',
    '  background:var(--gold);color:#100D08;font-weight:600;font-size:14.5px;text-decoration:none;transition:opacity .16s,transform .16s}',
    '.dbm-wa:hover{opacity:.9;transform:translateY(-1px)}',
    '.dbm-wa-note{font-size:12.5px;color:var(--text-s);margin-top:11px}',

    '@media (max-width:600px){',
    '  .dbm-veil{padding:0;align-items:flex-end}',
    '  .dbm{max-width:none;max-height:93vh;border-radius:20px 20px 0 0;padding:26px 20px 22px;',
    '    transform:translateY(100%);transition:transform .34s cubic-bezier(.22,1,.36,1),opacity .2s}',
    '  .dbm-veil.on .dbm{transform:none}',
    '  .dbm h2{font-size:23px}',
    '}',
    '.dbm [hidden]{display:none !important}'
  ].join('');

  // ---------------------------------------------------------------- helpers

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Always IST: it is the timezone Divya works in and the one her confirmation
  // will quote. Rendering browser-local time would mean two different times
  // for the same call.
  function fmt(iso, o) { return new Date(iso).toLocaleString('en-IN', Object.assign({ timeZone: IST }, o)); }
  var timeOf = function (i) { return fmt(i, { hour: 'numeric', minute: '2-digit', hour12: true }); };
  var dateOf = function (i) { return fmt(i, { weekday: 'long', day: 'numeric', month: 'long' }); };
  function money(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------ build

  function mount() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var veil = document.createElement('div');
    veil.className = 'dbm-veil';
    veil.id = 'dbmVeil';
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-modal', 'true');
    veil.setAttribute('aria-label', 'Book a private consultation');
    veil.innerHTML =
      '<div class="dbm" id="dbmBox">' +
        '<button class="dbm-x" id="dbmX" aria-label="Close">&times;</button>' +
        '<div id="dbmMain">' +
          '<div class="dbm-eyebrow">Private consultation</div>' +
          '<h2>Book your session with Divya</h2>' +
          '<div class="dbm-sub">One to one, through your chart and your numbers together. Ask what you actually want to ask.</div>' +
          '<div class="dbm-facts" id="dbmFacts"></div>' +
          '<div class="dbm-hr"></div>' +
          '<div id="dbmStep1">' +
            '<div class="dbm-lbl">1 &middot; Pick a time (IST)</div>' +
            '<div id="dbmPicker"><div class="dbm-skel"></div></div>' +
          '</div>' +
          '<div id="dbmStep2" hidden>' +
            '<div class="dbm-lbl">2 &middot; Your details</div>' +
            '<div class="dbm-picked" id="dbmPicked"></div>' +
            '<div class="dbm-timer" id="dbmTimer"></div>' +
            '<form id="dbmForm" novalidate>' +
              '<div class="dbm-row">' +
                '<div class="dbm-f"><label for="dbmName">Full name</label><input id="dbmName" autocomplete="name"></div>' +
                '<div class="dbm-f"><label for="dbmPhone">WhatsApp number</label><input id="dbmPhone" inputmode="tel" autocomplete="tel" placeholder="10 digit number"></div>' +
              '</div>' +
              '<div class="dbm-f"><label for="dbmEmail">Email</label><input id="dbmEmail" type="email" autocomplete="email"></div>' +
              '<div class="dbm-row">' +
                '<div class="dbm-f"><label for="dbmDob">Date of birth</label><input id="dbmDob" type="date"></div>' +
                '<div class="dbm-f"><label for="dbmTob">Time of birth <span>(if known)</span></label><input id="dbmTob" type="time"></div>' +
              '</div>' +
              '<div class="dbm-f"><label for="dbmPob">Place of birth</label><input id="dbmPob" placeholder="City, country"></div>' +
              '<div class="dbm-f"><label for="dbmMode">How would you like to talk?</label>' +
                '<select id="dbmMode"><option value="video_call">Video call</option><option value="phone_call">Audio call</option></select></div>' +
              '<div class="dbm-f"><label for="dbmQ">What is on your mind? <span>(optional)</span></label>' +
                '<textarea id="dbmQ" placeholder="The one thing you most want answered."></textarea></div>' +
              '<div id="dbmMsg"></div>' +
              '<button class="dbm-go" id="dbmGo" type="submit">Confirm this slot</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
        '<div class="dbm-done" id="dbmDone" hidden>' +
          '<div class="dbm-tick">&#10003;</div>' +
          '<h3>Your slot is reserved</h3>' +
          '<div class="dbm-when" id="dbmWhen"></div>' +
          '<p id="dbmNote"></p>' +
          '<a class="dbm-wa" id="dbmWa" target="_blank" rel="noopener" hidden>Message Divya on WhatsApp</a>' +
          '<div class="dbm-wa-note" id="dbmWaNote" hidden>Your details are already filled in.</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(veil);

    $('dbmX').addEventListener('click', close);
    veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && veil.classList.contains('on')) close();
    });
    $('dbmForm').addEventListener('submit', submit);
  }

  var lastFocus = null;

  function open(e) {
    if (e) e.preventDefault();
    lastFocus = document.activeElement;
    $('dbmVeil').classList.add('on');
    document.body.style.overflow = 'hidden';
    if (!state.loaded) load();
    setTimeout(function () { $('dbmX').focus(); }, 60);
  }

  function close() {
    $('dbmVeil').classList.remove('on');
    document.body.style.overflow = '';
    if (state.tick) clearInterval(state.tick);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ------------------------------------------------------------------ data

  function load() {
    state.loaded = true;
    fetch(API + '/availability?days=21', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success) throw new Error(d.error || 'Could not load times');
        state.days = d.days || [];
        state.holdMinutes = d.hold_minutes;
        $('dbmFacts').innerHTML =
          '<span class="dbm-fact">' + esc(d.duration_minutes) + ' minutes</span>' +
          '<span class="dbm-fact">' + esc(money(d.fee_inr)) + '</span>' +
          '<span class="dbm-fact">Video or audio</span>';
        state.whatsapp = d.whatsapp;
        if (!d.configured) return emptyState('Booking opens shortly',
          'Divya has not published her hours for this period yet. Message her directly and she will sort a time out personally.');
        if (!state.days.length) return emptyState('No times free right now',
          'Every slot in the next three weeks is taken. Message her directly and she will find you one.');
        renderDays();
      })
      .catch(function (err) {
        state.loaded = false;
        emptyState('Could not load available times', err.message || 'Please try again in a moment.');
      });
  }

  // An empty state must never be a dead end: whatever the reason there are no
  // slots, the visitor still gets a way to reach Divya.
  function emptyState(title, body) {
    var wa = state.whatsapp
      ? '<div style="margin-top:18px"><a class="dbm-wa" target="_blank" rel="noopener" href="https://wa.me/' +
        esc(state.whatsapp) + '?text=' + encodeURIComponent('Hi Divya, I would like to book a private consultation.') +
        '">Message Divya on WhatsApp</a></div>'
      : '';
    $('dbmPicker').innerHTML = '<div class="dbm-empty"><b>' + esc(title) + '</b>' + esc(body) + wa + '</div>';
  }

  function renderDays() {
    var html = '<div class="dbm-strip">' +
      '<button type="button" class="dbm-arrow l" id="dbmL" aria-label="Earlier days" hidden>&#8249;</button>' +
      '<button type="button" class="dbm-arrow r" id="dbmR" aria-label="Later days">&#8250;</button>' +
      '<div class="dbm-days" id="dbmDays">';
    state.days.forEach(function (day, i) {
      var t = day.slots[0].starts_at;
      html += '<button type="button" class="dbm-day" data-date="' + esc(day.date) + '" aria-pressed="' + (i === 0) + '">' +
        '<div class="dbm-wd">' + esc(fmt(t, { weekday: 'short' })) + '</div>' +
        '<div class="dbm-dn">' + esc(fmt(t, { day: 'numeric' })) + '</div>' +
        '<div class="dbm-mo">' + esc(fmt(t, { month: 'short' })) + '</div>' +
        '<div class="dbm-free">' + day.slots.length + ' free</div></button>';
    });
    html += '</div></div><div class="dbm-slots" id="dbmSlots"></div>';
    $('dbmPicker').innerHTML = html;

    var strip = $('dbmDays');
    function arrows() {
      $('dbmL').hidden = strip.scrollLeft < 8;
      $('dbmR').hidden = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 8;
    }
    $('dbmL').addEventListener('click', function () { strip.scrollBy({ left: -240, behavior: 'smooth' }); });
    $('dbmR').addEventListener('click', function () { strip.scrollBy({ left: 240, behavior: 'smooth' }); });
    strip.addEventListener('scroll', arrows);
    arrows();

    $('dbmDays').addEventListener('click', function (e) {
      var b = e.target.closest('[data-date]');
      if (!b) return;
      Array.prototype.forEach.call($('dbmDays').children, function (c) {
        c.setAttribute('aria-pressed', String(c === b));
      });
      renderSlots(b.getAttribute('data-date'));
    });
    // One delegated listener for the whole grid, re-read on each click, so
    // switching days never stacks handlers or leaves a stale closure behind.
    $('dbmSlots').addEventListener('click', function (e) {
      var b = e.target.closest('[data-key]');
      if (!b || b.disabled) return;
      var day = state.days.filter(function (d) { return d.date === state.date; })[0];
      var slot = day && day.slots.filter(function (s) { return s.slot_key === b.getAttribute('data-key'); })[0];
      if (slot) hold(slot, b);
    });
    renderSlots(state.days[0].date);
  }

  function renderSlots(date) {
    state.date = date;
    var day = state.days.filter(function (d) { return d.date === date; })[0];
    if (!day) return;
    $('dbmSlots').innerHTML = day.slots.map(function (s) {
      return '<button type="button" class="dbm-slot" data-key="' + esc(s.slot_key) + '" aria-pressed="false">' +
        esc(timeOf(s.starts_at)) + '</button>';
    }).join('');
  }

  /**
   * Move to the form IMMEDIATELY and reserve in the background.
   *
   * Waiting for the hold before revealing step two meant the customer clicked a
   * time and then watched nothing happen for two to three seconds, which is the
   * exact moment they decide the site is broken. The form is theirs to start
   * filling in at once; the reservation lands a moment later and only the
   * countdown line waits for it. If the slot turns out to be gone we say so and
   * hand them back the picker - by which point they have lost nothing but a
   * keystroke or two.
   */
  function hold(slot, button) {
    Array.prototype.forEach.call($('dbmSlots').children, function (c) {
      c.setAttribute('aria-pressed', String(c === button));
    });

    state.slot = slot;
    state.hold = null;
    $('dbmPicked').innerHTML = '<span><strong>' + esc(dateOf(slot.starts_at)) + '</strong> at <strong>' +
      esc(timeOf(slot.starts_at)) + '</strong> IST</span><button type="button" class="dbm-change" id="dbmChange">Change</button>';
    $('dbmChange').addEventListener('click', back);
    $('dbmTimer').innerHTML = '<span class="dbm-holding">Reserving this slot…</span>';
    $('dbmStep1').hidden = true;
    $('dbmStep2').hidden = false;
    // Disabled only until the reservation confirms, so nobody can submit
    // against a hold that does not exist yet.
    $('dbmGo').disabled = true;
    $('dbmBox').scrollTop = 0;
    setTimeout(function () { $('dbmName').focus(); }, 60);

    fetch(API + '/hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ slot_key: slot.slot_key, starts_at: slot.starts_at, ends_at: slot.ends_at })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
      .then(function (d) {
        // They may have pressed Change while this was in flight.
        if (state.slot !== slot) return;
        state.hold = d;
        $('dbmGo').disabled = false;
        countdown(new Date(d.expires_at));
      })
      .catch(function (err) {
        if (state.slot !== slot) return;
        back();
        msg('bad', err.message || 'That slot just went. Please pick another.');
      });
  }

  function back() {
    if (state.tick) clearInterval(state.tick);
    state.slot = null; state.hold = null;
    $('dbmStep2').hidden = true;
    $('dbmStep1').hidden = false;
    $('dbmMsg').innerHTML = '';
    state.loaded = false; load();
  }

  // The hold is a promise to the customer, so it counts down in front of them
  // rather than expiring silently while they are typing.
  function countdown(expiresAt) {
    if (state.tick) clearInterval(state.tick);
    function paint() {
      var left = Math.max(0, Math.round((expiresAt - new Date()) / 1000));
      if (left <= 0) {
        clearInterval(state.tick);
        $('dbmTimer').innerHTML = '';
        $('dbmGo').disabled = true;
        msg('bad', 'Your hold expired. Pick a slot again and it will be reserved fresh.');
        return;
      }
      var m = Math.floor(left / 60), s = left % 60;
      $('dbmTimer').innerHTML = 'Held for you for <b>' + m + ':' + (s < 10 ? '0' : '') + s + '</b>';
    }
    paint();
    state.tick = setInterval(paint, 1000);
  }

  function msg(kind, text) {
    $('dbmMsg').innerHTML = text ? '<div class="dbm-msg ' + kind + '">' + esc(text) + '</div>' : '';
  }

  function submit(e) {
    e.preventDefault();
    if (!state.hold) return msg('bad', 'Still reserving your slot, one moment.');
    var q = new URLSearchParams(location.search);
    var payload = {
      hold_id: state.hold.hold_id, slot_key: state.slot.slot_key,
      name: $('dbmName').value, phone: $('dbmPhone').value, email: $('dbmEmail').value,
      dob: $('dbmDob').value, tob: $('dbmTob').value, pob: $('dbmPob').value,
      mode: $('dbmMode').value, question: $('dbmQ').value,
      utm_source: q.get('utm_source') || '', utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || ''
    };
    if (!payload.name.trim() || !payload.phone.trim() || !payload.email.trim() || !payload.dob || !payload.pob.trim()) {
      return msg('bad', 'Please fill in your name, number, email, date of birth and place of birth.');
    }
    $('dbmGo').disabled = true;
    $('dbmGo').textContent = 'Reserving…';
    msg('', '');

    fetch(API + '/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
      .then(function (d) {
        if (state.tick) clearInterval(state.tick);
        $('dbmMain').hidden = true;
        $('dbmDone').hidden = false;
        $('dbmWhen').textContent = dateOf(d.starts_at) + ', ' + timeOf(d.starts_at) + ' IST';
        $('dbmNote').textContent = d.next_step === 'payment'
          ? 'Payment confirmed. Your call is booked and the joining link is on its way to your email and WhatsApp.'
          : 'This time is held for you. Send Divya a quick message to get your payment link, and the slot is confirmed the moment it is paid.';
        // Until notifications exist, this is what actually tells Divya a
        // booking happened. The slot is reserved either way.
        var wa = $('dbmWa');
        if (d.whatsapp_handoff) {
          wa.href = d.whatsapp_handoff;
          wa.hidden = false;
          $('dbmWaNote').hidden = false;
        } else {
          wa.hidden = true;
          $('dbmWaNote').hidden = true;
        }
        $('dbmBox').scrollTop = 0;
      })
      .catch(function (err) {
        $('dbmGo').disabled = false;
        $('dbmGo').textContent = 'Confirm this slot';
        msg('bad', err.message || 'Could not complete the booking. Please try again.');
      });
  }

  // ------------------------------------------------------------- wire it up

  function wire() {
    mount();
    // Every existing booking entry point on the page. Delegated from document
    // so the CTAs the other patch scripts inject later are caught too.
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('a[href="#booking"], a[href$="/consultation"], .nav-book, [data-book-consultation]');
      if (!trigger) return;
      // A modifier click or middle click means "open in a new tab" - let it.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      open(e);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
