(function () {
  'use strict';

  if (window.__divyaWhySectionBalanceV1) return;
  window.__divyaWhySectionBalanceV1 = true;

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFourthPoint, { once: true });
  } else {
    addFourthPoint();
  }
})();
