const PDFDocument = require('pdfkit');
const DESIGN = require('../config/reportDesignSystem');
const BRAND = require('../config/divyaBrand');

const C = DESIGN.colors;
const T = DESIGN.type;
const P = DESIGN.page;
const S = DESIGN.spacing;

const SECTION_META = {
  'How To Read This Report': 'How the report works, what each layer means, and where its limits are',
  'Your Chart And Numbers At A Glance': 'The strongest chart and number signals before the detailed reading',
  'Personal Nature: Strengths And Weaknesses': 'Your natural operating style, strengths, blind spots and repeated patterns',
  'Past Life Karma': 'Symbolic karmic patterns and the lessons that repeat until handled differently',
  'Finances': 'Earning patterns, financial behaviour, opportunities, leaks and timing',
  'Marriage And Partnership': 'Partnership patterns, expectations, compatibility dynamics and timing',
  'Health And Constitution': 'Constitutional tendencies, routine, stress patterns and wellbeing awareness',
  'Children': 'Children, nurturing patterns, family responsibilities and timing where supported',
  'Property Purchase': 'Home, property, stability and long-term material decisions',
  'Remedies': 'Practical first, structural second, optional observance last',
  'Your Timing Map': 'A five-year map of changing emphasis and practical direction',
  'Closing Summary': 'The five points worth carrying forward from the complete reading',
  'Scope And Limitations': 'Clear boundaries so the report remains useful and responsible'
};

const LIFE_TITLES = new Set([
  'Personal Nature: Strengths And Weaknesses',
  'Past Life Karma',
  'Finances',
  'Marriage And Partnership',
  'Health And Constitution',
  'Children',
  'Property Purchase'
]);

function safeText(value) {
  return String(value == null ? '' : value)
    .replace(/\r/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\t/g, ' ')
    .trim();
}

function compact(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

function firstSentence(value, max = 175) {
  const text = compact(value);
  if (!text) return 'The available data does not support a stronger conclusion here.';
  const match = text.match(/^(.{1,240}?[.!?])(?:\s|$)/);
  const out = match ? match[1] : text;
  if (out.length <= max) return out;
  return `${out.slice(0, max - 1).trim()}...`;
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
      current = { number: Number(match[1]), title: match[2].trim(), lines: [] };
      return;
    }
    if (current) current.lines.push(raw);
  });
  if (current) sections.push({ ...current, body: current.lines.join('\n').trim() });
  return sections;
}

function splitByMarkers(body, markers) {
  const out = { intro: [] };
  markers.forEach(marker => { out[marker.key] = []; });
  let active = 'intro';
  safeText(body).split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line) {
      if (out[active].length && out[active][out[active].length - 1] !== '') out[active].push('');
      return;
    }
    const marker = markers.find(item => item.test(line));
    if (marker) {
      active = marker.key;
      const remainder = marker.remainder ? marker.remainder(line) : '';
      if (remainder) out[active].push(remainder);
      return;
    }
    out[active].push(line);
  });
  Object.keys(out).forEach(key => { out[key] = out[key].join('\n').trim(); });
  return out;
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
  const blocks = [];
  let current = null;
  safeText(text).split('\n').forEach(raw => {
    const line = raw.trim();
    const match = line.match(/^(\d)\.\s+(.+)$/);
    if (match) {
      if (current) blocks.push({ ...current, text: current.lines.join(' ').trim() });
      current = { number: match[1], title: match[2].trim(), lines: [] };
      return;
    }
    if (current && line) current.lines.push(line);
  });
  if (current) blocks.push({ ...current, text: current.lines.join(' ').trim() });
  return blocks;
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

function extractNamedBlock(body, start, end) {
  const text = safeText(body);
  const lower = text.toLowerCase();
  const i = lower.indexOf(start.toLowerCase());
  if (i < 0) return '';
  const from = i + start.length;
  if (!end) return text.slice(from).trim();
  const j = lower.indexOf(end.toLowerCase(), from);
  return text.slice(from, j < 0 ? undefined : j).trim();
}

function parseGlanceRows(block, numerology) {
  return safeText(block)
    .split(/\n\s*\n/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map(chunk => {
      const lines = chunk.split('\n').map(compact).filter(Boolean);
      const first = (lines.shift() || '').replace(/^[-*•]\s*/, '');
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

function parseBullets(text) {
  const raw = safeText(text);
  if (!raw) return [];
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.some(line => /^[-*•]\s+/.test(line))) {
    return lines.map(line => line.replace(/^[-*•]\s+/, '').trim()).filter(Boolean);
  }
  return raw.split(/\n\s*\n/).map(compact).filter(Boolean);
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

async function loadLogo() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(BRAND.assetUrls.logoGold, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    return null;
  }
}

function paintContentPage(doc, sectionLabel) {
  const w = doc.page.width;
  const h = doc.page.height;
  doc.save();
  doc.rect(0, 0, w, h).fill(C.paper);
  doc.strokeColor(C.line).lineWidth(0.65).moveTo(P.left, 54).lineTo(w - P.right, 54).stroke();
  doc.fillColor(C.gold).font(T.bodyBold).fontSize(T.small)
    .text('DIVYA BAJAJ', P.left, 32, { characterSpacing: 1.1, lineBreak: false });
  doc.fillColor(C.muted).font(T.body).fontSize(T.small)
    .text(safeText(sectionLabel || DESIGN.documentTitle).toUpperCase(), w - P.right - 220, 32, { width: 220, align: 'right', characterSpacing: 0.4, lineBreak: false });
  doc.restore();
  doc.x = P.left;
  doc.y = P.top;
}

function createContext(doc) {
  return { doc, sectionLabel: DESIGN.documentTitle, sectionPages: {}, summaryPage: null, tocPage: null };
}

function addContentPage(ctx, label) {
  ctx.sectionLabel = label || ctx.sectionLabel;
  ctx.doc.addPage();
  paintContentPage(ctx.doc, ctx.sectionLabel);
  const range = ctx.doc.bufferedPageRange();
  return range.start + range.count - 1;
}

function ensureSpace(ctx, needed, label) {
  const bottom = ctx.doc.page.height - P.safeBottom;
  if (ctx.doc.y + needed > bottom) addContentPage(ctx, label || ctx.sectionLabel);
}

function height(doc, text, width, opts = {}) {
  doc.font(opts.font || T.body).fontSize(opts.size || T.bodySize);
  return doc.heightOfString(safeText(text), { width, lineGap: opts.lineGap == null ? T.lineGap : opts.lineGap });
}

function drawCover(doc, lead, logoBuffer) {
  const w = doc.page.width;
  const h = doc.page.height;
  doc.rect(0, 0, w, h).fill(C.navyDeep);
  doc.rect(0, 0, 9, h).fill(C.gold);
  doc.rect(42, 44, w - 84, h - 88).lineWidth(0.7).strokeColor('#3C4860').stroke();

  if (logoBuffer) {
    try { doc.image(logoBuffer, 58, 66, { fit: [82, 82] }); } catch (error) {}
  }
  doc.fillColor(C.goldSoft).font(T.bodyBold).fontSize(8)
    .text('DIVYA BAJAJ', 58, logoBuffer ? 154 : 78, { characterSpacing: 2.2 });
  doc.fillColor('#B8BECA').font(T.body).fontSize(7)
    .text('ASTRO-NUMEROLOGIST', 58, logoBuffer ? 174 : 99, { characterSpacing: 1.1 });

  doc.fillColor(C.white).font(T.display).fontSize(36)
    .text('The Integrated\nLife Report', 58, 244, { width: 390, lineGap: 5 });
  doc.fillColor(C.goldSoft).font(T.displayItalic).fontSize(13.5)
    .text(DESIGN.methodologyLine, 58, 350, { width: 390 });

  doc.strokeColor(C.gold).lineWidth(1.2).moveTo(58, 403).lineTo(w - 58, 403).stroke();
  doc.fillColor('#B8BECA').font(T.bodyBold).fontSize(7.2)
    .text('PREPARED FOR', 58, 432, { characterSpacing: 1.4 });
  doc.fillColor(C.white).font(T.display).fontSize(25)
    .text(safeText(lead.name) || 'Client', 58, 454, { width: w - 116 });

  const details = [
    ['DATE OF BIRTH', lead.dob || '-'],
    ['TIME OF BIRTH', lead.tob || '-'],
    ['PLACE OF BIRTH', lead.pob || '-']
  ];
  let y = 524;
  details.forEach(([label, value]) => {
    doc.fillColor(C.goldSoft).font(T.bodyBold).fontSize(6.7).text(label, 58, y, { characterSpacing: 0.8 });
    doc.fillColor(C.white).font(T.body).fontSize(9.6).text(safeText(value), 168, y - 1, { width: w - 226 });
    y += 38;
  });

  doc.fillColor('#8E97A8').font(T.body).fontSize(7.2)
    .text('Private personal report  |  Prepared for reflection and practical decision-making', 58, h - 76, { width: w - 116 });
}

function drawSectionStart(ctx, section) {
  const index = addContentPage(ctx, section.title);
  ctx.sectionPages[section.title] = index + 1;
  const doc = ctx.doc;
  doc.fillColor(C.gold).font(T.bodyBold).fontSize(7.2)
    .text(String(section.number).padStart(2, '0'), P.left, doc.y, { characterSpacing: 1.2 });
  doc.y += 19;
  doc.fillColor(C.navy).font(T.display).fontSize(T.h1)
    .text(section.title, P.left, doc.y, { width: doc.page.width - P.left - P.right, lineGap: 3 });
  doc.y += 9;
  const subtitle = SECTION_META[section.title] || '';
  if (subtitle) {
    doc.fillColor(C.muted).font(T.displayItalic).fontSize(10.4)
      .text(subtitle, P.left, doc.y, { width: doc.page.width - P.left - P.right, lineGap: 2 });
    doc.y += 17;
  }
  doc.strokeColor(C.goldSoft).lineWidth(0.9).moveTo(P.left, doc.y).lineTo(doc.page.width - P.right, doc.y).stroke();
  doc.y += S.xl;
}

function drawSubheading(ctx, text) {
  ensureSpace(ctx, 58);
  const doc = ctx.doc;
  doc.fillColor(C.navy).font(T.bodyBold).fontSize(T.h3)
    .text(safeText(text), P.left, doc.y, { width: doc.page.width - P.left - P.right });
  doc.y += S.sm;
}

function drawParagraph(ctx, text, opts = {}) {
  const value = compact(text);
  if (!value) return;
  const doc = ctx.doc;
  const width = doc.page.width - P.left - P.right;
  ensureSpace(ctx, Math.min(90, height(doc, value, width, opts) + 8));
  doc.fillColor(opts.color || C.ink).font(opts.font || T.body).fontSize(opts.size || T.bodySize)
    .text(value, P.left, doc.y, { width, lineGap: opts.lineGap == null ? T.lineGap : opts.lineGap, align: 'left' });
  doc.y += opts.after == null ? S.md : opts.after;
}

function drawBulletList(ctx, items) {
  const doc = ctx.doc;
  const width = doc.page.width - P.left - P.right - 22;
  items.forEach(item => {
    const value = compact(item);
    if (!value) return;
    const h = height(doc, value, width, { size: T.bodySize, lineGap: T.lineGap });
    ensureSpace(ctx, h + 18);
    const y = doc.y;
    doc.circle(P.left + 4, y + 5, 2.2).fill(C.gold);
    doc.fillColor(C.ink).font(T.body).fontSize(T.bodySize)
      .text(value, P.left + 18, y, { width, lineGap: T.lineGap });
    doc.y = y + h + S.sm;
  });
  doc.y += S.xs;
}

function drawCallout(ctx, label, text, opts = {}) {
  const value = compact(text);
  if (!value) return;
  const doc = ctx.doc;
  const width = doc.page.width - P.left - P.right;
  const bodyW = width - 32;
  const bodyH = height(doc, value, bodyW, { size: opts.size || 9.1, lineGap: 3.5, font: opts.font || T.body });
  const boxH = bodyH + 54;
  ensureSpace(ctx, boxH + S.md);
  const y = doc.y;
  doc.save();
  doc.roundedRect(P.left, y, width, boxH, 4).fillAndStroke(opts.fill || C.sand, C.line);
  doc.rect(P.left, y, 4, boxH).fill(opts.bar || C.gold);
  doc.fillColor(C.gold).font(T.bodyBold).fontSize(6.9)
    .text(safeText(label).toUpperCase(), P.left + 18, y + 13, { characterSpacing: 0.9 });
  doc.fillColor(C.ink).font(opts.font || T.body).fontSize(opts.size || 9.1)
    .text(value, P.left + 18, y + 31, { width: bodyW, lineGap: 3.5 });
  doc.restore();
  doc.y = y + boxH + S.md;
}

function drawConfidence(ctx, text) {
  const value = compact(text);
  if (!value) return;
  const doc = ctx.doc;
  const width = doc.page.width - P.left - P.right;
  const h = Math.max(50, height(doc, value, width - 135, { size: 8.2, lineGap: 2.7 }) + 24);
  ensureSpace(ctx, h + S.md);
  const y = doc.y;
  doc.roundedRect(P.left, y, width, h, 4).fill(C.navyDeep);
  doc.fillColor(C.goldSoft).font(T.bodyBold).fontSize(7).text('CONFIDENCE', P.left + 16, y + 16, { characterSpacing: 0.8 });
  doc.fillColor(C.white).font(T.body).fontSize(8.2)
    .text(value, P.left + 118, y + 13, { width: width - 134, lineGap: 2.7 });
  doc.y = y + h + S.lg;
}

function tableCellHeight(doc, text, width, font, size, lineGap) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(compact(text), { width: width - 14, lineGap });
}

function drawTable(ctx, columns, rows, opts = {}) {
  const doc = ctx.doc;
  const x = P.left;
  const headerH = opts.headerHeight || 30;
  const fontSize = opts.fontSize || T.table;
  const lineGap = opts.lineGap == null ? 2.4 : opts.lineGap;

  function header() {
    ensureSpace(ctx, headerH + 24);
    const y = doc.y;
    let cx = x;
    columns.forEach(col => {
      doc.rect(cx, y, col.width, headerH).fillAndStroke(C.navy, C.navy);
      doc.fillColor(C.white).font(T.bodyBold).fontSize(7.1)
        .text(col.label, cx + 7, y + 9, { width: col.width - 14, align: col.align || 'left' });
      cx += col.width;
    });
    doc.y = y + headerH;
  }

  header();
  rows.forEach((row, rowIndex) => {
    const values = columns.map(col => safeText(typeof col.value === 'function' ? col.value(row) : row[col.key]));
    const cellHeights = values.map((value, i) => tableCellHeight(doc, value, columns[i].width, T.body, fontSize, lineGap));
    const rowH = Math.max(opts.minRowHeight || 34, ...cellHeights.map(v => v + 16));
    if (doc.y + rowH > doc.page.height - P.safeBottom) {
      addContentPage(ctx, ctx.sectionLabel);
      header();
    }
    const y = doc.y;
    let cx = x;
    columns.forEach((col, i) => {
      const fill = rowIndex % 2 === 0 ? C.white : C.sand;
      doc.rect(cx, y, col.width, rowH).fillAndStroke(fill, C.line);
      doc.fillColor(C.ink).font(T.body).fontSize(fontSize)
        .text(values[i], cx + 7, y + 8, { width: col.width - 14, lineGap, align: col.align || 'left' });
      cx += col.width;
    });
    doc.y = y + rowH;
  });
  doc.y += S.lg;
}

function drawContentsPage(ctx) {
  const index = addContentPage(ctx, 'Contents');
  ctx.tocPage = index;
}

function drawSummaryPage(ctx, lead, sections) {
  const index = addContentPage(ctx, 'Your Report In One Page');
  ctx.summaryPage = index;
  const doc = ctx.doc;
  const width = doc.page.width - P.left - P.right;
  doc.fillColor(C.gold).font(T.bodyBold).fontSize(7.3).text('YOUR REPORT IN ONE PAGE', P.left, doc.y, { characterSpacing: 1.2 });
  doc.y += 20;
  doc.fillColor(C.navy).font(T.display).fontSize(25)
    .text(`The big picture, ${safeText(lead.name).split(' ')[0] || 'at a glance'}`, P.left, doc.y, { width });
  doc.y += 10;

  const glance = sections.find(s => s.title === 'Your Chart And Numbers At A Glance');
  const headline = glance ? extractNamedBlock(glance.body, 'The headline finding') : '';
  drawCallout(ctx, 'The strongest signal', headline || 'The detailed report builds the picture from independent astrology and numerology layers.', { fill: C.sandDeep, font: T.display, size: 10.5 });

  doc.fillColor(C.navy).font(T.bodyBold).fontSize(10.5).text('Seven-area pulse', P.left, doc.y);
  doc.y += 13;
  const labelWidth = 92;
  const insightWidth = width - labelWidth;
  const lifeRows = sections.filter(s => LIFE_TITLES.has(s.title)).map(section => {
    const parsed = parseLifeArea(section.body);
    return {
      area: section.title.replace(': Strengths And Weaknesses', '').replace(' And Constitution', '').replace(' And Partnership', '').replace(' Purchase', ''),
      insight: firstSentence(parsed.agree || parsed.tension || parsed.intro, 175)
    };
  });
  drawTable(ctx, [
    { label: 'AREA', key: 'area', width: labelWidth },
    { label: 'WHAT TO NOTICE', key: 'insight', width: insightWidth }
  ], lifeRows, { fontSize: 7.5, minRowHeight: 29, headerHeight: 25, lineGap: 2.0 });

  const timing = sections.find(s => s.title === 'Your Timing Map');
  const timingRows = timing ? parseTimingRows(timing.body) : [];
  const current = timingRows[0];
  if (current) {
    drawCallout(ctx, 'Your current chapter', `${current.period}: ${current.combined || current.astrology || current.numerology}`, { fill: C.white, size: 8.7 });
  }

  const question = compact(lead.question || '');
  const hook = question
    ? `Your main concern is "${question}". The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.`
    : 'The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.';
  drawParagraph(ctx, hook, { font: T.displayItalic, size: 9.6, color: C.navy, after: 0 });
}

function fillContentsPage(ctx, sections) {
  if (ctx.tocPage == null) return;
  const doc = ctx.doc;
  doc.switchToPage(ctx.tocPage);
  paintContentPage(doc, 'Contents');
  const width = doc.page.width - P.left - P.right;
  doc.fillColor(C.gold).font(T.bodyBold).fontSize(7.3).text('CONTENTS', P.left, doc.y, { characterSpacing: 1.2 });
  doc.y += 20;
  doc.fillColor(C.navy).font(T.display).fontSize(26).text('Your report map', P.left, doc.y, { width });
  doc.y += 11;
  doc.fillColor(C.muted).font(T.body).fontSize(9.2)
    .text('Read the one-page summary first, then move through the report in order. Each life area follows the same evidence, interpretation and action rhythm.', P.left, doc.y, { width, lineGap: 3.1 });
  doc.y += 28;

  const entries = [
    { number: '00', title: 'Your Report In One Page', page: ctx.summaryPage + 1 },
    ...sections.map(section => ({ number: String(section.number).padStart(2, '0'), title: section.title, page: ctx.sectionPages[section.title] || '' }))
  ];

  entries.forEach(entry => {
    const y = doc.y;
    doc.fillColor(C.gold).font(T.bodyBold).fontSize(7.5).text(entry.number, P.left, y + 2, { width: 26 });
    doc.fillColor(C.ink).font(T.bodyBold).fontSize(9.2).text(entry.title, P.left + 36, y, { width: width - 92 });
    doc.fillColor(C.gold).font(T.bodyBold).fontSize(8.2).text(String(entry.page), doc.page.width - P.right - 34, y, { width: 34, align: 'right' });
    doc.strokeColor(C.line).lineWidth(0.45).moveTo(P.left + 36, y + 19).lineTo(doc.page.width - P.right, y + 19).stroke();
    doc.y = y + 29;
  });
}

function renderPrimer(ctx, section) {
  drawSectionStart(ctx, section);
  const parsed = parsePrimer(section.body);
  drawParagraph(ctx, parsed.intro, { font: T.display, size: 12.5, color: C.navy, after: S.lg });
  drawSubheading(ctx, 'The two systems used in your report');
  drawParagraph(ctx, parsed.systems);

  drawSubheading(ctx, 'The four ideas you need');
  parseIdeaBlocks(parsed.ideas).forEach(idea => {
    ensureSpace(ctx, 86);
    const doc = ctx.doc;
    const y = doc.y;
    doc.fillColor(C.gold).font(T.display).fontSize(22).text(idea.number, P.left, y, { width: 32 });
    doc.fillColor(C.navy).font(T.bodyBold).fontSize(10.8).text(idea.title, P.left + 42, y + 2, { width: doc.page.width - P.left - P.right - 42 });
    doc.fillColor(C.ink).font(T.body).fontSize(T.bodySize)
      .text(compact(idea.text), P.left + 42, y + 24, { width: doc.page.width - P.left - P.right - 42, lineGap: T.lineGap });
    doc.y += Math.max(70, height(doc, idea.text, doc.page.width - P.left - P.right - 42, { size: T.bodySize }) + 41);
    doc.y += S.md;
  });

  drawCallout(ctx, 'Convergence method', parsed.convergence, { fill: C.sand });
  drawSubheading(ctx, 'What this report will not do');
  drawBulletList(ctx, parseBullets(parsed.limits));
}

function renderGlance(ctx, section) {
  drawSectionStart(ctx, section);
  const body = section.body;
  const astro = parseGlanceRows(extractNamedBlock(body, 'The astrological layer', 'The numerological layer'), false);
  const numero = parseGlanceRows(extractNamedBlock(body, 'The numerological layer', 'The headline finding'), true);
  const headline = extractNamedBlock(body, 'The headline finding');

  drawCallout(ctx, 'Headline finding', headline, { fill: C.sandDeep, font: T.display, size: 10.2 });
  drawSubheading(ctx, 'The astrological layer');
  const width = ctx.doc.page.width - P.left - P.right;
  drawTable(ctx, [
    { label: 'ELEMENT', key: 'label', width: 92 },
    { label: 'YOUR POSITION', key: 'value', width: 150 },
    { label: 'WHAT IT MEANS', key: 'meaning', width: width - 242 }
  ], astro, { fontSize: 7.7, minRowHeight: 37 });

  drawSubheading(ctx, 'The numerological layer');
  drawTable(ctx, [
    { label: 'NUMBER', key: 'label', width: 112 },
    { label: 'VALUE', key: 'value', width: 48, align: 'center' },
    { label: 'DERIVED FROM', key: 'derived', width: 145 },
    { label: 'PLAIN MEANING', key: 'meaning', width: width - 305 }
  ], numero, { fontSize: 7.5, minRowHeight: 34 });
}

function renderLifeArea(ctx, section) {
  drawSectionStart(ctx, section);
  const parsed = parseLifeArea(section.body);
  drawParagraph(ctx, parsed.intro, { font: T.display, size: 12.2, color: C.navy, after: S.xl });

  drawSubheading(ctx, 'What your birth chart shows');
  drawParagraph(ctx, parsed.chart);
  drawSubheading(ctx, 'What your numbers show');
  drawParagraph(ctx, parsed.numbers);
  drawCallout(ctx, 'Where the two systems agree', parsed.agree, { fill: C.sandDeep, font: T.display, size: 10.0 });
  drawSubheading(ctx, 'Where the picture is mixed');
  drawParagraph(ctx, parsed.tension);

  if (compact(parsed.timing)) {
    drawSubheading(ctx, 'Timing');
    const items = parseBullets(parsed.timing);
    if (items.length > 1) drawBulletList(ctx, items);
    else drawParagraph(ctx, parsed.timing);
  }

  drawSubheading(ctx, 'What to actually do about it');
  drawBulletList(ctx, parseBullets(parsed.action));
  drawConfidence(ctx, parsed.confidence);
}

function renderRemedies(ctx, section) {
  drawSectionStart(ctx, section);
  const parsed = splitByMarkers(section.body, [
    { key: 'behavioural', test: line => /^Priority one, behavioural:/i.test(line), remainder: line => line.replace(/^Priority one, behavioural:\s*/i, '') },
    { key: 'structural', test: line => /^Priority two, professional and structural:/i.test(line), remainder: line => line.replace(/^Priority two, professional and structural:\s*/i, '') },
    { key: 'traditional', test: line => /^Priority three, optional traditional observance:/i.test(line), remainder: line => line.replace(/^Priority three, optional traditional observance:\s*/i, '') },
    { key: 'gemstones', test: line => /^Gemstones:/i.test(line), remainder: line => line.replace(/^Gemstones:\s*/i, '') }
  ]);
  drawParagraph(ctx, parsed.intro, { font: T.display, size: 12.2, color: C.navy, after: S.xl });
  [
    ['01', 'Behavioural practices', parsed.behavioural],
    ['02', 'Professional and structural', parsed.structural],
    ['03', 'Optional traditional observance', parsed.traditional]
  ].forEach(([number, title, body]) => {
    ensureSpace(ctx, 90);
    const doc = ctx.doc;
    const y = doc.y;
    doc.fillColor(C.gold).font(T.display).fontSize(24).text(number, P.left, y, { width: 40 });
    doc.fillColor(C.navy).font(T.bodyBold).fontSize(11).text(title, P.left + 52, y + 3, { width: doc.page.width - P.left - P.right - 52 });
    doc.y = y + 28;
    drawParagraph(ctx, body);
  });
  if (parsed.gemstones) drawCallout(ctx, 'Gemstones', parsed.gemstones, { fill: C.white });
}

function renderTiming(ctx, section) {
  drawSectionStart(ctx, section);
  const rows = parseTimingRows(section.body);
  const width = ctx.doc.page.width - P.left - P.right;
  drawTable(ctx, [
    { label: 'PERIOD', key: 'period', width: 76 },
    { label: 'ASTROLOGY', key: 'astrology', width: 115 },
    { label: 'NUMEROLOGY', key: 'numerology', width: 105 },
    { label: 'COMBINED READING', key: 'combined', width: width - 346 },
    { label: 'CONF.', key: 'confidence', width: 50 }
  ], rows, { fontSize: 7.15, minRowHeight: 46, lineGap: 2.1 });
}

function renderClosing(ctx, section) {
  drawSectionStart(ctx, section);
  const points = parseBullets(section.body);
  points.forEach((point, index) => {
    ensureSpace(ctx, 75);
    const doc = ctx.doc;
    const y = doc.y;
    doc.fillColor(C.gold).font(T.display).fontSize(23).text(String(index + 1).padStart(2, '0'), P.left, y, { width: 38 });
    doc.fillColor(C.ink).font(T.body).fontSize(9.5)
      .text(compact(point), P.left + 52, y + 1, { width: doc.page.width - P.left - P.right - 52, lineGap: 3.7 });
    doc.y = y + Math.max(58, height(doc, point, doc.page.width - P.left - P.right - 52, { size: 9.5, lineGap: 3.7 }) + 14);
    doc.strokeColor(C.line).lineWidth(0.45).moveTo(P.left + 52, doc.y).lineTo(doc.page.width - P.right, doc.y).stroke();
    doc.y += S.md;
  });
}

function renderLimitations(ctx, section) {
  drawSectionStart(ctx, section);
  drawBulletList(ctx, parseBullets(section.body));
}

function renderGeneric(ctx, section) {
  drawSectionStart(ctx, section);
  safeText(section.body).split(/\n\s*\n/).map(compact).filter(Boolean).forEach(p => drawParagraph(ctx, p));
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    if (i === 0) continue;
    doc.switchToPage(i);
    const w = doc.page.width;
    const h = doc.page.height;
    doc.save();
    doc.strokeColor(C.line).lineWidth(0.5).moveTo(P.left, h - 42).lineTo(w - P.right, h - 42).stroke();
    doc.fillColor(C.muted).font(T.body).fontSize(6.7)
      .text('PRIVATE PERSONAL REPORT', P.left, h - 31, { characterSpacing: 0.65, lineBreak: false });
    doc.fillColor(C.gold).font(T.bodyBold).fontSize(7.2)
      .text(String(i + 1).padStart(2, '0'), w - P.right - 32, h - 31, { width: 32, align: 'right', lineBreak: false });
    doc.restore();
  }
}

async function generateStructuredPaidPdf({ lead = {}, reportText = '' }) {
  const logo = await loadLogo();
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: P.size,
        margins: { top: P.top, bottom: P.bottom, left: P.left, right: P.right },
        bufferPages: true,
        info: {
          Title: `Divya Bajaj - ${DESIGN.documentTitle}`,
          Author: 'Divya Bajaj',
          Subject: DESIGN.methodologyLine
        }
      });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const sections = splitSections(reportText);
      const ctx = createContext(doc);
      drawCover(doc, lead, logo);
      drawContentsPage(ctx);
      drawSummaryPage(ctx, lead, sections);

      sections.forEach(section => {
        if (section.title === 'How To Read This Report') return renderPrimer(ctx, section);
        if (section.title === 'Your Chart And Numbers At A Glance') return renderGlance(ctx, section);
        if (LIFE_TITLES.has(section.title)) return renderLifeArea(ctx, section);
        if (section.title === 'Remedies') return renderRemedies(ctx, section);
        if (section.title === 'Your Timing Map') return renderTiming(ctx, section);
        if (section.title === 'Closing Summary') return renderClosing(ctx, section);
        if (section.title === 'Scope And Limitations') return renderLimitations(ctx, section);
        return renderGeneric(ctx, section);
      });

      fillContentsPage(ctx, sections);
      addFooters(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateStructuredPaidPdf };
