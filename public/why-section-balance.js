(function () {
  'use strict';

  if (window.__divyaWhySectionBalanceV3) return;
  window.__divyaWhySectionBalanceV3 = true;

  function installLocationSuggestionContext() {
    if (window.__divyaLocationSuggestionContextV2 || typeof window.fetch !== 'function') return;
    window.__divyaLocationSuggestionContextV2 = true;
    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : String((input && input.url) || '');
      return nativeFetch(input, init).then(function (response) {
        if (url.indexOf('/api/locations/search') === -1 || !response.ok) return response;

        return response.clone().json().then(function (data) {
          if (!data || !Array.isArray(data.locations)) return response;
          var baseCounts = {};
          var displayCounts = {};

          data.locations.forEach(function (location) {
            var base = String(location.place_name || '').trim().toLowerCase();
            var display = String(location.display_name || location.place_name || '').trim().toLowerCase();
            if (base) baseCounts[base] = (baseCounts[base] || 0) + 1;
            if (display) displayCounts[display] = (displayCounts[display] || 0) + 1;
          });

          data.locations = data.locations.map(function (location) {
            var originalName = String(location.place_name || '').trim();
            var displayName = String(location.display_name || '').trim() || originalName;
            var duplicateBase = (baseCounts[originalName.toLowerCase()] || 0) > 1;
            var duplicateDisplay = (displayCounts[displayName.toLowerCase()] || 0) > 1;

            if ((duplicateBase || duplicateDisplay) && location.coordinate_hint && displayName.indexOf(location.coordinate_hint) === -1) {
              displayName += ' · ' + location.coordinate_hint;
            }

            return Object.assign({}, location, {
              original_place_name: originalName,
              place_name: displayName
            });
          });

          var headers = new Headers(response.headers);
          headers.set('Content-Type', 'application/json; charset=utf-8');
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: headers
          });
        }).catch(function () {
          return response;
        });
      });
    };
  }

  function addFourthPoint() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.why-card'));
    if (cards.length !== 3) return;

    var grid = cards[0].parentElement;
    if (!grid || cards.some(function (card) { return card.parentElement !== grid; })) return;
    if (grid.querySelector('[data-why-fourth-point]')) return;

    var card = cards[2].cloneNode(true);
    var heading = card.querySelector('h2,h3,h4,h5,h6');
    var paragraph = card.querySelector('p');
    if (!heading || !paragraph) return;

    card.querySelectorAll('[id]').forEach(function (element) {
      element.removeAttribute('id');
    });

    card.setAttribute('data-why-fourth-point', 'actionable-next-steps');
    card.classList.add('vis');
    heading.textContent = 'You leave knowing what to do next.';
    paragraph.textContent = 'Every report ends with clear priorities, practical remedies and the next steps Divya recommends. You do not leave with more information and the same confusion. You leave knowing what to act on first.';

    grid.appendChild(card);
  }

  installLocationSuggestionContext();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFourthPoint, { once: true });
  } else {
    addFourthPoint();
  }
})();
