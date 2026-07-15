const EXPECTED_TITLES = {
  1: ['Personal Opening From Divya'],
  2: ['Your Full Blueprint Summary'],
  3: ['Birth Detail Based Astrology Overview'],
  4: ['Numerology Core Number Summary'],
  5: ['Ruling Number Deep Reading'],
  6: ['Destiny Number Deep Reading'],
  7: ['Name Number and Public Energy'],
  8: ['Lo Shu Grid Deep Reading'],
  9: ['Missing Numbers, Repeated Numbers and Life Lessons', 'Missing Numbers and Life Lessons', 'Repeated Numbers and Strong Patterns'],
  10: ['Mental, Emotional and Practical Planes'],
  11: ['Personality Pattern and Inner Nature'],
  12: ['Career Direction and Work Style'],
  13: ['Best Suited Professions and Business Directions'],
  14: ['Money Pattern and Growth Advice'],
  15: ['Relationship and Marriage Pattern'],
  16: ['Family, Communication and Emotional Triggers'],
  17: ['Health, Energy and Routine Awareness'],
  18: ['The Decisions That Need More Attention'],
  19: ['Current Year Guidance'],
  20: ['Next 12 Months Focus'],
  21: ['Next 3 to 5 Year Direction'],
  22: ['Name Correction and Business Number Notes'],
  23: ['Mobile Number, House Number and Daily Environment Notes'],
  24: ['Gemstone and Remedy Direction'],
  25: ['Practical 30-Day Action Plan'],
  26: ['What Divya Would Personally Ask In A Consultation'],
  27: ['Final Guidance and Next Step']
};

const FALLBACK_NEIGHBOURS = {
  1: [2, 27], 2: [1, 11], 3: [4, 19], 4: [5, 6, 7], 5: [4, 6], 6: [4, 5], 7: [4, 5],
  8: [9, 10], 9: [8, 10], 10: [9, 11], 11: [2, 10], 12: [13, 14], 13: [12, 14], 14: [12, 13],
  15: [16, 11], 16: [15, 11], 17: [11, 19], 18: [11, 19], 19: [20, 21], 20: [19, 21], 21: [20, 19],
  22: [23, 24], 23: [22, 24], 24: [22, 23], 25: [19, 27], 26: [27, 18], 27: [2, 25]
};

function stripMarkup(value) {
  return String(value || '')
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*>\s*/, '')
    .trim();
}

function normalizeComparable(value) {
  return stripMarkup(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectHeading(line) {
  const cleaned = stripMarkup(line);
  if (!cleaned) return null;

  const numbered = cleaned.match(/^(?:section\s*)?(\d{1,2})\s*(?:[.)]|[:\-])\s*(.+)$/i);
  if (numbered) {
    const number = Number(numbered[1]);
    if (number >= 1 && number <= 27) return { number, title: stripMarkup(numbered[2]) };
  }

  const comparable = normalizeComparable(cleaned);
  for (const [number, titles] of Object.entries(EXPECTED_TITLES)) {
    for (const title of titles) {
      const expected = normalizeComparable(title);
      if (comparable === expected || comparable.endsWith(expected) || comparable.includes(expected)) {
        return { number: Number(number), title };
      }
    }
  }

  return null;
}

function parseFlexibleSections(reportText) {
  const raw = String(reportText || '').replace(/\r/g, '');
  const lines = raw.split('\n');
  const sections = {};
  let current = null;
  let buffer = [];

  function flush() {
    if (!current) return;
    const body = buffer
      .join('\n')
      .replace(/\*\*|__/g, '')
      .replace(/—/g, ',')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (body) sections[current.number] = body;
    buffer = [];
  }

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      flush();
      current = heading;
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();

  return sections;
}

function recoverMissingSections(sections, reportText) {
  const output = { ...sections };
  const fullText = String(reportText || '')
    .replace(/\r/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/—/g, ',')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const available = Object.values(output).filter(value => String(value || '').trim());
  const globalFallback = available[0] || fullText || 'This area needs practical attention and should be understood in the context of the complete blueprint.';

  for (let number = 1; number <= 27; number += 1) {
    if (String(output[number] || '').trim()) continue;
    const neighbours = FALLBACK_NEIGHBOURS[number] || [];
    const neighbourText = neighbours.map(item => output[item]).find(value => String(value || '').trim());
    output[number] = neighbourText || globalFallback;
  }

  return output;
}

function normalizeReportForDirectPdf(reportText) {
  const sections = recoverMissingSections(parseFlexibleSections(reportText), reportText);
  return Object.keys(EXPECTED_TITLES)
    .map(Number)
    .sort((a, b) => a - b)
    .map(number => `${number}. ${EXPECTED_TITLES[number][0]}\n${sections[number]}`)
    .join('\n\n');
}

module.exports = {
  EXPECTED_TITLES,
  detectHeading,
  parseFlexibleSections,
  recoverMissingSections,
  normalizeReportForDirectPdf
};
