const { FORBIDDEN_PHRASES } = require('./spec');

function words(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function wordCount(value) {
  return words(value).length;
}

function scanLanguage(value, path, issues) {
  if (typeof value === 'string') {
    if (value.includes('—')) issues.push({ type: 'language', severity: 'high', path, message: 'Em dash is not allowed.' });
    const lower = value.toLowerCase();
    FORBIDDEN_PHRASES.forEach(phrase => {
      if (lower.includes(phrase)) issues.push({ type: 'language', severity: 'medium', path, message: `Generic AI phrase detected: ${phrase}` });
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanLanguage(item, `${path}[${index}]`, issues));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => scanLanguage(child, path ? `${path}.${key}` : key, issues));
  }
}

function scanEmpty(value, path, issues) {
  if (typeof value === 'string') {
    if (!value.trim()) issues.push({ type: 'missing_content', severity: 'high', path, message: 'Required text is empty.' });
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) issues.push({ type: 'missing_content', severity: 'high', path, message: 'Required list is empty.' });
    value.forEach((item, index) => scanEmpty(item, `${path}[${index}]`, issues));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => scanEmpty(child, path ? `${path}.${key}` : key, issues));
  }
}

function scanFactConsistency(pages, factLedger, issues) {
  const expected = factLedger.immutable_facts;
  const cards = pages?.page_3?.number_cards || [];
  const expectedValues = [
    String(expected.ruling_number),
    String(expected.destiny_number),
    String(expected.name_number),
    String(expected.personal_year)
  ];

  if (cards.length !== 4) {
    issues.push({ type: 'fact_consistency', severity: 'high', path: 'page_3.number_cards', message: 'Exactly four core-number cards are required.' });
  } else {
    cards.forEach((card, index) => {
      if (String(card.value) !== expectedValues[index]) {
        issues.push({ type: 'fact_consistency', severity: 'critical', path: `page_3.number_cards[${index}].value`, message: `Expected ${expectedValues[index]}, received ${card.value}.` });
      }
    });
  }

  const yearLabel = String(pages?.page_7?.year_label || '');
  if (!yearLabel.includes(String(expected.personal_year))) {
    issues.push({ type: 'fact_consistency', severity: 'high', path: 'page_7.year_label', message: `Current-year label must include Personal Year ${expected.personal_year}.` });
  }

  const hiddenNumbers = new Set((pages?.page_10?.missing_guidance || []).map(item => Number(item.number)));
  expected.missing_numbers.forEach(number => {
    if (!hiddenNumbers.has(Number(number))) {
      issues.push({ type: 'fact_consistency', severity: 'critical', path: 'page_10.missing_guidance', message: `Missing number ${number} is absent from Page 10.` });
    }
  });
}

function similarity(a, b) {
  const aa = new Set(words(a.toLowerCase()).filter(word => word.length > 4));
  const bb = new Set(words(b.toLowerCase()).filter(word => word.length > 4));
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  aa.forEach(word => { if (bb.has(word)) common += 1; });
  return common / Math.min(aa.size, bb.size);
}

function collectLongText(value, path, out) {
  if (typeof value === 'string') {
    if (wordCount(value) >= 18) out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLongText(item, `${path}[${index}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => collectLongText(child, path ? `${path}.${key}` : key, out));
  }
}

function scanRepetition(pages, issues) {
  const items = [];
  collectLongText(pages, '', items);
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (similarity(items[i].text, items[j].text) >= 0.74) {
        issues.push({
          type: 'repetition',
          severity: 'medium',
          path: `${items[i].path} <> ${items[j].path}`,
          message: 'Two report fields are too similar and should not repeat the same insight.'
        });
      }
    }
  }
}

function validatePremiumContent({ pages, factLedger }) {
  const issues = [];
  scanEmpty(pages, '', issues);
  scanLanguage(pages, '', issues);
  scanFactConsistency(pages, factLedger, issues);
  scanRepetition(pages, issues);

  return {
    passed: !issues.some(issue => ['critical', 'high'].includes(issue.severity)),
    issues,
    scores: {
      content_accuracy: issues.some(issue => issue.type === 'fact_consistency' && ['critical', 'high'].includes(issue.severity)) ? 0 : 10,
      language: Math.max(0, 10 - issues.filter(issue => issue.type === 'language').length * 0.5),
      repetition: Math.max(0, 10 - issues.filter(issue => issue.type === 'repetition').length * 0.5)
    }
  };
}

module.exports = { wordCount, validatePremiumContent };
