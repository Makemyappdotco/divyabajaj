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

function getPath(root, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  return parts.reduce((value, key) => value == null ? undefined : value[key], root);
}

function checkLimit(pages, issues, path, min, max) {
  const value = getPath(pages, path);
  if (typeof value !== 'string') return;
  const count = wordCount(value);
  if (count > max) {
    issues.push({ type: 'length', severity: 'high', path, message: `Text has ${count} words. Maximum allowed is ${max}. Shorten the copy without shrinking the design.` });
  } else if (count < min) {
    issues.push({ type: 'length', severity: 'low', path, message: `Text has ${count} words. Recommended minimum is ${min}.` });
  }
}

function checkArrayItemLimits(pages, issues, path, min, max, childKey = null) {
  const list = getPath(pages, path);
  if (!Array.isArray(list)) return;
  list.forEach((item, index) => {
    const value = childKey ? item?.[childKey] : item;
    if (typeof value !== 'string') return;
    const count = wordCount(value);
    const itemPath = childKey ? `${path}[${index}].${childKey}` : `${path}[${index}]`;
    if (count > max) issues.push({ type: 'length', severity: 'high', path: itemPath, message: `Text has ${count} words. Maximum allowed is ${max}.` });
    else if (count < min) issues.push({ type: 'length', severity: 'low', path: itemPath, message: `Text has ${count} words. Recommended minimum is ${min}.` });
  });
}

function scanHardLengthLimits(pages, issues) {
  checkLimit(pages, issues, 'page_2.hero_statement', 25, 55);
  checkArrayItemLimits(pages, issues, 'page_2.insights', 18, 42, 'body');

  checkArrayItemLimits(pages, issues, 'page_3.number_cards', 12, 28, 'interpretation');
  checkArrayItemLimits(pages, issues, 'page_3.number_cards', 2, 5, 'short_meaning');
  checkLimit(pages, issues, 'page_3.interplay_headline', 4, 10);
  checkLimit(pages, issues, 'page_3.interplay_body', 35, 85);
  checkLimit(pages, issues, 'page_3.success_formula', 20, 45);
  checkLimit(pages, issues, 'page_3.contradiction', 35, 75);

  checkLimit(pages, issues, 'page_4.how_people_see_you', 30, 70);
  checkLimit(pages, issues, 'page_4.what_is_happening_inside', 30, 70);
  checkArrayItemLimits(pages, issues, 'page_4.strengths', 1, 4);
  checkArrayItemLimits(pages, issues, 'page_4.decision_steps', 4, 16, 'body');
  checkArrayItemLimits(pages, issues, 'page_4.blind_spots', 6, 18);
  checkLimit(pages, issues, 'page_4.birth_detail_lens', 30, 70);

  checkLimit(pages, issues, 'page_5.hero_quote', 12, 30);
  checkArrayItemLimits(pages, issues, 'page_5.work_best_when', 5, 18);
  checkArrayItemLimits(pages, issues, 'page_5.what_to_avoid', 5, 18);
  checkArrayItemLimits(pages, issues, 'page_5.career_directions', 10, 26, 'body');
  checkLimit(pages, issues, 'page_5.job_vs_business', 35, 85);
  checkArrayItemLimits(pages, issues, 'page_5.money_system', 4, 12);

  checkLimit(pages, issues, 'page_6.hero_statement', 25, 55);
  checkArrayItemLimits(pages, issues, 'page_6.cards', 18, 42, 'body');
  checkLimit(pages, issues, 'page_6.communication_pattern', 35, 80);
  checkArrayItemLimits(pages, issues, 'page_6.improvements', 6, 18);
  checkLimit(pages, issues, 'page_6.strongest_fit', 18, 45);

  checkLimit(pages, issues, 'page_7.theme_title', 2, 6);
  checkLimit(pages, issues, 'page_7.intro', 35, 75);
  checkArrayItemLimits(pages, issues, 'page_7.cards', 18, 42, 'body');
  checkArrayItemLimits(pages, issues, 'page_7.focus', 2, 10);
  checkArrayItemLimits(pages, issues, 'page_7.avoid', 2, 10);
  checkLimit(pages, issues, 'page_7.decision_filter', 25, 60);

  checkLimit(pages, issues, 'page_8.intro', 25, 60);
  checkArrayItemLimits(pages, issues, 'page_8.phases', 22, 48, 'body');
  checkArrayItemLimits(pages, issues, 'page_8.phases', 2, 5, 'title');
  checkLimit(pages, issues, 'page_8.rule_72_hour', 28, 65);

  checkLimit(pages, issues, 'page_9.intro', 35, 80);
  checkArrayItemLimits(pages, issues, 'page_9.steps', 22, 50, 'body');
  checkLimit(pages, issues, 'page_9.long_term_filter', 35, 80);
  checkArrayItemLimits(pages, issues, 'page_9.slow_down', 2, 8);
  checkArrayItemLimits(pages, issues, 'page_9.simple_formula', 2, 8);

  checkLimit(pages, issues, 'page_10.central_contradiction', 35, 75);
  checkLimit(pages, issues, 'page_10.repeated_number_pattern', 35, 75);
  checkArrayItemLimits(pages, issues, 'page_10.missing_guidance', 15, 38, 'body');
  checkArrayItemLimits(pages, issues, 'page_10.planes', 15, 28, 'body');

  checkLimit(pages, issues, 'page_11.intro', 25, 60);
  checkArrayItemLimits(pages, issues, 'page_11.cards', 20, 48, 'body');
  checkLimit(pages, issues, 'page_11.gemstone_note', 35, 80);

  checkLimit(pages, issues, 'page_12.intro', 25, 60);
  (getPath(pages, 'page_12.weeks') || []).forEach((week, weekIndex) => checkArrayItemLimits(pages, issues, `page_12.weeks[${weekIndex}].actions`, 5, 20));
  checkLimit(pages, issues, 'page_12.closing', 25, 60);

  checkLimit(pages, issues, 'page_13.intro', 25, 60);
  checkArrayItemLimits(pages, issues, 'page_13.areas', 25, 60, 'body');
  checkArrayItemLimits(pages, issues, 'page_13.questions', 8, 24);
  checkLimit(pages, issues, 'page_13.closing', 20, 55);

  checkLimit(pages, issues, 'page_14.hero', 8, 22);
  checkArrayItemLimits(pages, issues, 'page_14.paragraphs', 25, 85);
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

  // The approved Page 10 design has room for up to three missing-number cards.
  // Validate the displayed cards against the same first-three deterministic values the renderer uses.
  const expectedDisplayedMissing = (expected.missing_numbers || []).slice(0, 3).map(Number);
  const renderedMissing = (pages?.page_10?.missing_guidance || []).map(item => Number(item.number));
  const hiddenNumbers = new Set(renderedMissing);

  expectedDisplayedMissing.forEach(number => {
    if (!hiddenNumbers.has(number)) {
      issues.push({ type: 'fact_consistency', severity: 'critical', path: 'page_10.missing_guidance', message: `Displayed missing number ${number} is absent from Page 10.` });
    }
  });

  renderedMissing.forEach(number => {
    if (!expectedDisplayedMissing.includes(number)) {
      issues.push({ type: 'fact_consistency', severity: 'critical', path: 'page_10.missing_guidance', message: `Page 10 shows ${number} as missing, but it is not one of the deterministic missing numbers selected for display.` });
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
  scanHardLengthLimits(pages, issues);
  scanFactConsistency(pages, factLedger, issues);
  scanRepetition(pages, issues);

  return {
    passed: !issues.some(issue => ['critical', 'high'].includes(issue.severity)),
    issues,
    scores: {
      content_accuracy: issues.some(issue => issue.type === 'fact_consistency' && ['critical', 'high'].includes(issue.severity)) ? 0 : 10,
      length_control: issues.some(issue => issue.type === 'length' && issue.severity === 'high') ? 0 : 10,
      language: Math.max(0, 10 - issues.filter(issue => issue.type === 'language').length * 0.5),
      repetition: Math.max(0, 10 - issues.filter(issue => issue.type === 'repetition').length * 0.5)
    }
  };
}

module.exports = { wordCount, validatePremiumContent };
