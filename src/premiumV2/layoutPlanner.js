const { PAGE_META } = require('./spec');
const { wordCount } = require('./validator');

function totalWords(value) {
  if (typeof value === 'string') return wordCount(value);
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + totalWords(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + totalWords(item), 0);
  return 0;
}

const THRESHOLDS = {
  2: [260, 380],
  4: [220, 340],
  5: [300, 440],
  6: [260, 390],
  7: [250, 380],
  8: [220, 350],
  9: [260, 400],
  11: [240, 380],
  12: [260, 420],
  13: [260, 400]
};

function chooseVariant(pageNumber, content) {
  const allowed = PAGE_META[pageNumber].variants;
  if (allowed.length === 1) return allowed[0];
  const count = totalWords(content);
  const [shortMax, standardMax] = THRESHOLDS[pageNumber] || [220, 360];
  if (count <= shortMax && allowed.includes('short')) return 'short';
  if (count <= standardMax && allowed.includes('standard')) return 'standard';
  return allowed.includes('dense') ? 'dense' : allowed[allowed.length - 1];
}

function buildLayoutPlan(pages) {
  const plan = {};
  for (let pageNumber = 1; pageNumber <= 14; pageNumber += 1) {
    const key = `page_${pageNumber}`;
    plan[key] = {
      page_number: pageNumber,
      template_family: PAGE_META[pageNumber].key,
      template_variant: chooseVariant(pageNumber, pages[key]),
      theme: PAGE_META[pageNumber].theme,
      content_words: totalWords(pages[key])
    };
  }
  return plan;
}

module.exports = { buildLayoutPlan, totalWords, chooseVariant };
