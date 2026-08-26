const PDFDocument = require('pdfkit');

const COLORS = {
  dark: '#171419',
  darkSoft: '#211B21',
  paper: '#FCF9F3',
  cream: '#F7F2E9',
  soft: '#EFE4D4',
  white: '#FFFDF8',
  ink: '#211C1E',
  muted: '#776E67',
  gold: '#B88A49',
  goldLight: '#D9BB83',
  line: '#DDD0BD',
  green: '#4F7A64'
};

const PAGE = {
  left: 52,
  right: 52,
  top: 78,
  bottom: 58
};

const LIFE_TITLES = {
  'Personal Nature: Strengths And Weaknesses': 'Identity, temperament and repeated behavioural patterns',
  'Past Life Karma': 'Symbolic karmic themes and repeated life lessons',
  'Finances': 'Money, earning patterns and financial direction',
  'Marriage And Partnership': 'Partnership patterns, expectations and relationship dynamics',
  'Health And Constitution': 'Constitutional tendencies, routine and wellbeing awareness',
  'Children': 'Children, nurturing patterns and family responsibilities',
  'Property Purchase': 'Home, property and long-term material stability'
};

function safeText(value) {
  return String(value == null ? '' : value)
    .replace(/\r/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\t/g, ' ')
    .trim();
}

function cleanLine(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

function splitSections(reportText) {
  const lines = safeText(reportText).split('\n');
  const sections = [];
  let current = null;

  lines.forEach(raw => {
    const line = raw.trim();
    const match = line.match(/^(\d{1,2})\.\s+(.+)$/);
    if (match) {
      if (current) sections.push({ ...current, body: current.lines.join('\n').trim() });
      current = { number: match[1], title: match[2].trim(), lines: [] };
      return;
    }
    if (current) current.lines.push(raw);
  });

  if (current) sections.push({ ...current, body: current.lines.join('\n').trim() });
  return sections;
}

function splitByMarkers(body, markers) {
  const result = { intro: [] };
  markers.forEach(marker => { result[marker.key] = []; });
  let active = 'intro';

  safeText(body).split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line) {
      if (result[active].length && result[active][result[active].length - 1] !== '') result[active].push('');
      return;
    }

    for (const marker of markers) {
      if (marker.test(line)) {
        active = marker.key;
        const remainder = marker.remainder ? marker.remainder(line) : '';
        if (remainder) result[active].push(remainder);
        return;
      }
    }
    result[active].push(line);
  });

  Object.keys(result).forEach(key => {
    result[key] = result[key].join('\n').trim();
  });
  return result;
}

function parseLifeArea(body) {
  return splitByMarkers(body, [
    { key: 'chart', test: line => /^What your birth chart shows:/i.test(line), remainder: line => line.replace(/^What your birth chart shows:\s*/i, '') },
    { key: 'numbers', test: line => /^What your numbers show:/i.test(line), remainder: line => line.replace(/^What your numbers show:\s*/i, '') },
    { key: 'agree', test: line => /^Where the two systems agree:/i.test(line), remainder: line => line.replace(/^Where the two systems agree:\s*/i, '') },
    { key: 'tension', test: line => /^Where they pull against each other, or where one system is silent:/i.test(line), remainder: line => line.replace(/^Where they pull against each other, or where one system is silent:\s*/i, '') },
    { key: 'timing', test: line => /^Timing:/i.test(line), remainder: line => line.replace(/^Timing:\s*/i, '') },
    { key: 'action', test: line => /^What to actually do about it:/i.test(line), remainder: line => line.replace(/^What to actually do about it:\s*/i, '') },
    { key: 'confidence', test: line => /^Confidence:/i.test(line), remainder: line => line.replace(/^Confidence:\s*/i, '') }
  ]);
}

function parsePrimer(body) {
  return splitByMarkers(body, [
    { key: 'systems', test: line => /^The two systems used in your report$/i.test(line) },
    { key: 'ideas', test: line => /^The four ideas you need$/i.test(line) },
    { key: 'convergence', test: line => /^The convergence method$/i.test(line) },
    { key: 'limits', test: line => /^What this report will not do$/i.test(line) }
  ]);
}

function parseIdeaBlocks(text) {
  const result = [];
  let current = null;
  safeText(text).split('\n').forEach(raw => {
    const line = raw.trim();
    const match = line.match(/^(\d)\.\s+(.+)$/);
    if (match) {
      if (current) result.push({ ...current, text: current.lines.join(' ').trim() });
      current = { number: match[1], title: match[2].trim(), lines: [] };
      return;
    }
    if (current && line) current.lines.push(line);
  });
  if (current) result.push({ ...current, text: current.lines.join(' ').trim() });
  return result;
}

function extractNamedBlock(body, start, end) {
  const text = safeText(body);
  const startIndex = text.toLowerCase().indexOf(start.toLowerCase());
  if (startIndex < 0) return '';
  const from = startIndex + start.length;
  if (!end) return text.slice(from).trim();
  const endIndex = text.toLowerCase().indexOf(end.toLowerCase(), from);
  return text.slice(from, endIndex < 0 ? undefined : endIndex).trim();
}

function parseGlanceRows(block, numerology = false) {
  return safeText(block)
    .split(/\n\s*\n/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => {
      const lines = chunk.split('\n').map(cleanLine).filter(Boolean);
      const first = (lines.shift() || '').replace(/^[-]\s*/, '');
      const colon = first.indexOf(':');
      const label = colon >= 0 ? first.slice(0, colon).trim() : first;
      const value = colon >= 0 ? first.slice(colon + 1).trim() : '';
      if (numerology) {
        const derived = lines.find(line => /^Derived from:/i.test(line)) || '';
        const meaning = lines.filter(line => !/^Derived from:/i.test(line)).join(' ');
        return { label, value, derived: derived.replace(/^Derived from:\s*/i, ''), meaning };
      }
      return { label, value, meaning: lines.join(' ') };
    });
}

function parseBulletList(text) {
  return safeText(text)
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function parseTimingRows(body) {
  const rows = [];
  let current = null;
  safeText(body).split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (!/^(Astrological chapter|Numerological year|Combined reading|Confidence):/i.test(line)) {
      if (current) rows.push(current);
      current = { period: line, astrology: '', numerology: '', combined: '', confidence: '' };
      return;
    }
    if (!current) return;
    if (/^Astrological chapter:/i.test(line)) current.astrology = line.replace(/^Astrological chapter:\s*/i, '');
    else if (/^Numerological year:/i.test(line)) current.numerology = line.replace(/^Numerological year:\s*/i, '');
    else if (/^Combined reading:/i.test(line)) current.combined = line.replace(/^Combined reading:\s*/i, '');
    else if (/^Confidence:/i.test(line)) current.confidence = line.replace(/^Confidence:\s*/i, '');
  });
  if (current) rows.push(current);
  return rows;
}

function addWrappedText(doc, text, x, y, width, options = {}) {
  const font = options.font || 'Helvetica';
  const size = options.size || 9;
  const color = options.color || COLORS.muted;
  const lineGap = options.lineGap == null ? 3.5 : options.lineGap;
  doc.font(font).fontSize(size).fillColor(color).text(safeText(text), x, y, {
    width,
    lineGap,
    align: options.align || 'left'
  });
  return doc.y;
}

function drawCover(doc, lead = {}) {
  const w = doc.page.width;
  const h = doc.page.height;
  doc.rect(0, 0, w, h).fill(COLORS.dark);
  doc.rect(w * 0.69, 0, w * 0.31, h).fill(COLORS.darkSoft);

  doc.save();
  doc.strokeColor(COLORS.gold).lineWidth(1);
  [78, 116, 154].forEach(radius => doc.circle(w - 110, 135, radius).stroke());
  doc.circle(w - 110, 135, 10).fill(COLORS.gold);
  doc.restore();

  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.5)
    .text('DIVYA BAJAJ', 62, 80, { characterSpacing: 1.4 });
  doc.fillColor(COLORS.goldLight).font('Helvetica').fontSize(6.8)
    .text('ASTRO-NUMEROLOGIST', 62, 101, { characterSpacing: 1.1 });

  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(10)
    .text('THE', 62, 232, { characterSpacing: 1.4 });
  doc.fillColor(COLORS.white).font('Times-Bold').fontSize(31)
    .text('FULL BLUEPRINT', 62, 272, { width: w * 0.58 });
  doc.fillColor(COLORS.goldLight).font('Times-Italic').fontSize(13)
    .text('Nadi Astrology + Vedic Numerology Personal Report', 62, 323, { width: w * 0.57, lineGap: 2 });

  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7)
    .text('PREPARED PERSONALLY FOR', 62, 456, { characterSpacing: 1.2 });
  doc.fillColor(COLORS.white).font('Times-Bold').fontSize(23)
    .text(safeText(lead.name) || 'Client', 62, 483, { width: w * 0.56 });
  doc.strokeColor(COLORS.gold).lineWidth(1).moveTo(62, 531).lineTo(w * 0.63, 531).stroke();

  const details = [
    ['DATE OF BIRTH', lead.dob || '-'],
    ['TIME OF BIRTH', lead.tob || '-'],
    ['PLACE OF BIRTH', lead.pob || '-']
  ];
  let y = 594;
  details.forEach(([label, value]) => {
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(6.5)
      .text(label, 62, y, { characterSpacing: 0.7 });
    doc.fillColor(COLORS.white).font('Helvetica').fontSize(9.5)
      .text(safeText(value), 62, y + 16, { width: w * 0.54, lineGap: 2 });
    y += 66;
  });

  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7)
    .text('PERSONAL', w * 0.72, h - 125);
  doc.text('PRIVATE', w * 0.72, h - 105);
  doc.text('PRACTICAL', w * 0.72, h - 85);
  doc.fillColor(COLORS.goldLight).font('Times-Bold').fontSize(24)
    .text(String(new Date().getFullYear()), w * 0.72, h - 58, { width: w * 0.21, align: 'right' });
}

function paintContentPage(doc, label) {
  const w = doc.page.width;
  const h = doc.page.height;
  doc.rect(0, 0, w, h).fill(COLORS.paper);
  doc.strokeColor(COLORS.line).lineWidth(0.6).moveTo(PAGE.left, 55).lineTo(w - PAGE.right, 55).stroke();
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7.5)
    .text('DIVYA BAJAJ', PAGE.left, 33, { characterSpacing: 1.2 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.2)
    .text(safeText(label || 'THE FULL BLUEPRINT'), w - PAGE.right - 210, 33, { width: 210, align: 'right', characterSpacing: 0.7 });
  doc.x = PAGE.left;
  doc.y = PAGE.top;
}

function newContentPage(ctx, label) {
  ctx.doc.addPage();
  ctx.sectionLabel = label || ctx.sectionLabel || 'THE FULL BLUEPRINT';
  paintContentPage(ctx.doc, ctx.sectionLabel);
}

function ensureSpace(ctx, needed) {
  const bottom = ctx.doc.page.height - PAGE.bottom - 18;
  if (ctx.doc.y + needed > bottom) newContentPage(ctx, ctx.sectionLabel);
}

function textHeight(doc, text, width, options = {}) {
  const font = options.font || 'Helvetica';
  const size = options.size || 9;
  doc.font(font).fontSize(size);
  return doc.heightOfString(safeText(text), { width, lineGap: options.lineGap == null ? 3.5 : options.lineGap });
}

function drawEyebrow(doc, text, x, y) {
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7)
    .text(safeText(text).toUpperCase(), x, y, { characterSpacing: 0.6 });
}

function drawPageTitle(ctx, number, title, subtitle) {
  const doc = ctx.doc;
  ensureSpace(ctx, 96);
  drawEyebrow(doc, String(number).padStart(2, '0'), PAGE.left, doc.y);
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(25)
    .text(safeText(title).toUpperCase(), PAGE.left, doc.y + 26, { width: doc.page.width - PAGE.left - PAGE.right });
  if (subtitle) {
    doc.fillColor(COLORS.muted).font('Times-Italic').fontSize(10.5)
      .text(safeText(subtitle), PAGE.left, doc.y + 65, { width: doc.page.width - PAGE.left - PAGE.right });
    doc.y += 99;
  } else {
    doc.y += 82;
  }
}

function drawInfoCard(ctx, opts) {
  const doc = ctx.doc;
  const width = opts.width;
  const inner = width - 30;
  const body = safeText(opts.body);
  const title = safeText(opts.title);
  const bodyH = textHeight(doc, body, inner, { size: opts.bodySize || 8.7, lineGap: 3.7 });
  const titleH = textHeight(doc, title, inner, { font: 'Times-Bold', size: opts.titleSize || 12 });
  const height = Math.max(opts.minHeight || 92, 43 + titleH + 10 + bodyH + 18);
  if (!opts.noEnsure) ensureSpace(ctx, height + 12);
  const y = opts.y == null ? doc.y : opts.y;
  const x = opts.x == null ? PAGE.left : opts.x;

  doc.save();
  doc.roundedRect(x, y, width, height, 6)
    .fillAndStroke(opts.accent ? COLORS.soft : COLORS.white, COLORS.line);
  drawEyebrow(doc, opts.kicker || '', x + 15, y + 14);
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(opts.titleSize || 12)
    .text(title, x + 15, y + 33, { width: inner });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(opts.bodySize || 8.7)
    .text(body, x + 15, y + 55 + titleH, { width: inner, lineGap: 3.7 });
  doc.restore();

  if (opts.y == null) doc.y = y + height + 12;
  return height;
}

function drawTwoCards(ctx, left, right) {
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;
  const gap = 14;
  const width = (usable - gap) / 2;
  const leftBodyH = textHeight(doc, left.body, width - 30, { size: 8.7, lineGap: 3.7 });
  const rightBodyH = textHeight(doc, right.body, width - 30, { size: 8.7, lineGap: 3.7 });
  const leftTitleH = textHeight(doc, left.title, width - 30, { font: 'Times-Bold', size: 12 });
  const rightTitleH = textHeight(doc, right.title, width - 30, { font: 'Times-Bold', size: 12 });
  const height = Math.max(116, 43 + Math.max(leftTitleH, rightTitleH) + 10 + Math.max(leftBodyH, rightBodyH) + 18);
  ensureSpace(ctx, height + 14);
  const y = doc.y;
  drawInfoCard(ctx, { ...left, x: PAGE.left, y, width, minHeight: height, noEnsure: true });
  drawInfoCard(ctx, { ...right, x: PAGE.left + width + gap, y, width, minHeight: height, noEnsure: true });
  doc.y = y + height + 14;
}

function drawConfidenceBand(ctx, text) {
  const doc = ctx.doc;
  ensureSpace(ctx, 58);
  const usable = doc.page.width - PAGE.left - PAGE.right;
  const y = doc.y;
  doc.roundedRect(PAGE.left, y, usable, 48, 5).fill(COLORS.dark);
  drawEyebrow(doc, 'CONFIDENCE', PAGE.left + 16, y + 14);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(10)
    .text('READING', PAGE.left + 98, y + 13);
  doc.fillColor(COLORS.goldLight).font('Helvetica').fontSize(7.5)
    .text(safeText(text), PAGE.left + 165, y + 11, { width: usable - 180, lineGap: 2.5 });
  doc.y = y + 62;
}

function drawSnapshotPage(ctx, lead, numbers, sections) {
  newContentPage(ctx, 'THE FULL BLUEPRINT');
  const doc = ctx.doc;
  drawEyebrow(doc, 'YOUR REPORT', PAGE.left, doc.y);
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(27)
    .text(`Hello ${safeText(lead.name).split(' ')[0] || 'there'}, this is your personal blueprint.`, PAGE.left, doc.y + 25, { width: 470 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.4)
    .text('Use this page as your map. The report is structured to separate evidence, interpretation, timing and practical action.', PAGE.left, doc.y + 92, { width: 470, lineGap: 3.2 });
  doc.y += 132;

  const usable = doc.page.width - PAGE.left - PAGE.right;
  const gap = 10;
  const cw = (usable - gap * 3) / 4;
  const values = [
    ['BIRTH NUMBER', numbers.ruling_number || '-'],
    ['DESTINY NUMBER', numbers.destiny_number || '-'],
    ['NAME NUMBER', numbers.name_number || '-'],
    ['PERSONAL YEAR', numbers.personal_year || '-']
  ];
  const y = doc.y;
  values.forEach((item, index) => {
    const x = PAGE.left + index * (cw + gap);
    doc.roundedRect(x, y, cw, 86, 5).fillAndStroke(COLORS.white, COLORS.line);
    drawEyebrow(doc, item[0], x + 12, y + 13);
    doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(25)
      .text(String(item[1]), x + 12, y + 35, { width: cw - 24 });
  });
  doc.y = y + 108;

  drawInfoCard(ctx, {
    kicker: 'MAIN CONCERN',
    title: 'What this reading is helping you think through',
    body: lead.question || 'Complete life clarity',
    width: usable,
    accent: true,
    minHeight: 92
  });

  drawEyebrow(doc, 'REPORT MAP', PAGE.left, doc.y + 2);
  doc.y += 24;
  sections.forEach(section => {
    ensureSpace(ctx, 29);
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7.5)
      .text(String(section.number).padStart(2, '0'), PAGE.left, doc.y + 2, { width: 26 });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9)
      .text(section.title, PAGE.left + 34, doc.y, { width: usable - 34 });
    doc.strokeColor(COLORS.line).lineWidth(0.45)
      .moveTo(PAGE.left + 34, doc.y + 18).lineTo(doc.page.width - PAGE.right, doc.y + 18).stroke();
    doc.y += 27;
  });
}

function renderPrimer(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, section.title, 'A simple framework for understanding how the report is organised');
  const parsed = parsePrimer(section.body);
  const doc = ctx.doc;
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(13)
    .text(safeText(parsed.intro), PAGE.left, doc.y, { width: doc.page.width - PAGE.left - PAGE.right, lineGap: 4 });
  doc.y += 18;
  drawInfoCard(ctx, {
    kicker: 'THE TWO SYSTEMS',
    title: 'Nadi Astrology + Vedic Numerology',
    body: parsed.systems,
    width: doc.page.width - PAGE.left - PAGE.right,
    accent: true
  });

  const ideas = parseIdeaBlocks(parsed.ideas);
  for (let i = 0; i < ideas.length; i += 2) {
    const a = ideas[i];
    const b = ideas[i + 1];
    if (!b) {
      drawInfoCard(ctx, { kicker: `IDEA ${a.number}`, title: a.title, body: a.text, width: doc.page.width - PAGE.left - PAGE.right });
    } else {
      drawTwoCards(ctx,
        { kicker: `IDEA ${a.number}`, title: a.title, body: a.text },
        { kicker: `IDEA ${b.number}`, title: b.title, body: b.text }
      );
    }
  }

  drawInfoCard(ctx, {
    kicker: 'CONVERGENCE',
    title: 'How agreement and tension are handled',
    body: parsed.convergence,
    width: doc.page.width - PAGE.left - PAGE.right,
    accent: true
  });

  drawInfoCard(ctx, {
    kicker: 'BOUNDARIES',
    title: 'What this report will not do',
    body: parsed.limits,
    width: doc.page.width - PAGE.left - PAGE.right
  });
}

function renderGlance(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, 'Your Chart & Numbers', 'The strongest signals before we go deeper into each life area');
  const body = section.body;
  const astro = extractNamedBlock(body, 'The astrological layer', 'The numerological layer');
  const numero = extractNamedBlock(body, 'The numerological layer', 'The headline finding');
  const headline = extractNamedBlock(body, 'The headline finding');
  const astroRows = parseGlanceRows(astro, false);
  const numeroRows = parseGlanceRows(numero, true);
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;

  drawInfoCard(ctx, {
    kicker: 'HEADLINE FINDING',
    title: 'The strongest cross-system pattern',
    body: headline,
    width: usable,
    accent: true,
    titleSize: 12.5
  });

  const gap = 10;
  const cw = (usable - gap * 3) / 4;
  ensureSpace(ctx, 98);
  const y = doc.y;
  numeroRows.slice(0, 4).forEach((row, index) => {
    const x = PAGE.left + index * (cw + gap);
    doc.roundedRect(x, y, cw, 88, 5).fillAndStroke(COLORS.white, COLORS.line);
    drawEyebrow(doc, row.label, x + 12, y + 12);
    doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(23)
      .text(row.value || '-', x + 12, y + 34, { width: cw - 24 });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.8)
      .text(row.meaning || row.derived || '', x + 12, y + 61, { width: cw - 24, height: 20, ellipsis: true });
  });
  doc.y = y + 110;

  drawEyebrow(doc, 'ASTROLOGICAL LAYER', PAGE.left, doc.y);
  doc.y += 22;
  astroRows.forEach((row, index) => {
    ensureSpace(ctx, 46);
    const yy = doc.y;
    if (index % 2 === 0) doc.rect(PAGE.left, yy, usable, 42).fill(COLORS.cream);
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.4)
      .text(row.label, PAGE.left + 12, yy + 13, { width: 115 });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9)
      .text(row.value, PAGE.left + 142, yy + 12, { width: 120 });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text(row.meaning, PAGE.left + 278, yy + 10, { width: usable - 290, height: 25, ellipsis: true });
    doc.y += 46;
  });
}

function renderLifeArea(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, section.title, LIFE_TITLES[section.title] || 'A focused reading of this life area');
  const parsed = parseLifeArea(section.body);
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;

  if (parsed.intro) {
    doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(13)
      .text(parsed.intro, PAGE.left, doc.y, { width: usable, lineGap: 4 });
    doc.y += 18;
  }

  drawTwoCards(ctx,
    { kicker: 'BIRTH CHART', title: 'What your chart shows', body: parsed.chart || 'The chart is quiet on this point.' },
    { kicker: 'VEDIC NUMEROLOGY', title: 'What your numbers show', body: parsed.numbers || 'The numbers are quiet on this point.' }
  );

  drawInfoCard(ctx, {
    kicker: 'CONVERGENCE',
    title: 'Where both systems agree',
    body: parsed.agree || 'No strong independent convergence is claimed here.',
    width: usable,
    accent: true
  });

  drawInfoCard(ctx, {
    kicker: 'TENSION OR SILENCE',
    title: 'Where the picture is mixed',
    body: parsed.tension || 'No meaningful tension is supported by the available data.',
    width: usable
  });

  drawTwoCards(ctx,
    { kicker: 'TIMING', title: 'The current chapter', body: parsed.timing || 'No timing claim is made here.' },
    { kicker: 'ACTION', title: 'What to actually do', body: parsed.action || 'Use this section as reflection rather than a fixed prediction.' }
  );

  drawConfidenceBand(ctx, parsed.confidence || 'Limited by the available verified data.');
}

function renderRemedies(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, section.title, 'Practical first, structural second, optional observance last');
  const parsed = splitByMarkers(section.body, [
    { key: 'behavioural', test: line => /^Priority one, behavioural:/i.test(line), remainder: line => line.replace(/^Priority one, behavioural:\s*/i, '') },
    { key: 'structural', test: line => /^Priority two, professional and structural:/i.test(line), remainder: line => line.replace(/^Priority two, professional and structural:\s*/i, '') },
    { key: 'traditional', test: line => /^Priority three, optional traditional observance:/i.test(line), remainder: line => line.replace(/^Priority three, optional traditional observance:\s*/i, '') },
    { key: 'gemstones', test: line => /^Gemstones:/i.test(line), remainder: line => line.replace(/^Gemstones:\s*/i, '') }
  ]);
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;

  if (parsed.intro) {
    doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(13)
      .text(parsed.intro, PAGE.left, doc.y, { width: usable, lineGap: 4 });
    doc.y += 18;
  }
  drawInfoCard(ctx, { kicker: 'PRIORITY 01', title: 'Behavioural practices', body: parsed.behavioural, width: usable, accent: true });
  drawInfoCard(ctx, { kicker: 'PRIORITY 02', title: 'Professional and structural', body: parsed.structural, width: usable });
  drawInfoCard(ctx, { kicker: 'PRIORITY 03', title: 'Optional traditional observance', body: parsed.traditional, width: usable });
  drawInfoCard(ctx, { kicker: 'GEMSTONES', title: 'Separate assessment only', body: parsed.gemstones, width: usable });
}

function renderTiming(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, section.title, 'A five-year view of changing emphasis and practical direction');
  const rows = parseTimingRows(section.body);
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;

  rows.forEach((row, index) => {
    const body = [
      row.astrology ? `Astrology: ${row.astrology}` : '',
      row.numerology ? `Numerology: ${row.numerology}` : '',
      row.combined ? `Combined reading: ${row.combined}` : ''
    ].filter(Boolean).join('\n\n');
    drawInfoCard(ctx, {
      kicker: `YEAR ${String(index + 1).padStart(2, '0')}`,
      title: row.period,
      body,
      width: usable,
      accent: index === 0
    });
    if (row.confidence) {
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.2)
        .text(`Confidence: ${row.confidence}`, PAGE.left + 15, doc.y - 8, { width: usable - 30 });
      doc.y += 10;
    }
  });
}

function renderSummary(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, section.title, 'The five points worth carrying forward from the complete reading');
  const points = parseBulletList(section.body);
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;
  points.forEach((point, index) => {
    ensureSpace(ctx, 80);
    const y = doc.y;
    doc.roundedRect(PAGE.left, y, usable, 68, 6)
      .fillAndStroke(index === 0 ? COLORS.soft : COLORS.white, COLORS.line);
    doc.fillColor(COLORS.gold).font('Times-Bold').fontSize(22)
      .text(String(index + 1).padStart(2, '0'), PAGE.left + 16, y + 18, { width: 34 });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9)
      .text(point, PAGE.left + 62, y + 15, { width: usable - 80, lineGap: 3.4 });
    doc.y = y + 80;
  });
}

function renderLimitations(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, section.title, 'Clear boundaries so the report remains useful and responsible');
  const points = parseBulletList(section.body);
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;
  points.forEach(point => {
    ensureSpace(ctx, 54);
    const y = doc.y;
    doc.circle(PAGE.left + 5, y + 8, 2.2).fill(COLORS.gold);
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9)
      .text(point, PAGE.left + 17, y, { width: usable - 17, lineGap: 3.5 });
    doc.y += Math.max(34, doc.heightOfString(point, { width: usable - 17, lineGap: 3.5 }) + 13);
  });
}

function renderGeneric(ctx, section) {
  newContentPage(ctx, section.title.toUpperCase());
  drawPageTitle(ctx, section.number, section.title, 'A focused part of your personal blueprint');
  const doc = ctx.doc;
  const usable = doc.page.width - PAGE.left - PAGE.right;
  safeText(section.body).split(/\n\s*\n/).map(cleanLine).filter(Boolean).forEach(paragraph => {
    ensureSpace(ctx, 62);
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9)
      .text(paragraph, PAGE.left, doc.y, { width: usable, lineGap: 4 });
    doc.y += 14;
  });
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    if (i === 0) continue;
    doc.switchToPage(i);
    const w = doc.page.width;
    const h = doc.page.height;
    doc.save();
    doc.strokeColor(COLORS.line).lineWidth(0.55)
      .moveTo(PAGE.left, h - 42).lineTo(w - PAGE.right, h - 42).stroke();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.8)
      .text('PRIVATE PERSONAL REPORT', PAGE.left, h - 31, { characterSpacing: 0.7, lineBreak: false });
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7)
      .text(String(i).padStart(2, '0'), w - PAGE.right - 35, h - 31, { width: 35, align: 'right', lineBreak: false });
    doc.restore();
  }
}

function generatePremiumPaidPdf({ lead = {}, numbers = {}, reportText = '' }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: PAGE,
        bufferPages: true,
        info: {
          Title: 'Divya Bajaj - The Full Blueprint',
          Author: 'Divya Bajaj',
          Subject: 'Nadi Astrology and Vedic Numerology Full Blueprint'
        }
      });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const sections = splitSections(reportText);
      drawCover(doc, lead);
      const ctx = { doc, sectionLabel: 'THE FULL BLUEPRINT' };
      drawSnapshotPage(ctx, lead, numbers, sections);

      sections.forEach(section => {
        if (section.title === 'How To Read This Report') return renderPrimer(ctx, section);
        if (section.title === 'Your Chart And Numbers At A Glance') return renderGlance(ctx, section);
        if (Object.prototype.hasOwnProperty.call(LIFE_TITLES, section.title)) return renderLifeArea(ctx, section);
        if (section.title === 'Remedies') return renderRemedies(ctx, section);
        if (section.title === 'Your Timing Map') return renderTiming(ctx, section);
        if (section.title === 'Closing Summary') return renderSummary(ctx, section);
        if (section.title === 'Scope And Limitations') return renderLimitations(ctx, section);
        return renderGeneric(ctx, section);
      });

      addFooters(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePremiumPaidPdf };
