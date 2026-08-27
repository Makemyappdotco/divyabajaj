const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const DESIGN = require('../config/reportDesignSystemV4');

const C = DESIGN.colors;
const T = DESIGN.type;
const P = DESIGN.page;
const S = DESIGN.spacing;
const A4 = [595.28, 841.89];
const CONTENT_MARGINS = { top: P.contentTop, bottom: A4[1] - P.contentBottom, left: P.left, right: P.right };

const LIFE_SECTIONS = [
  ['03', 'Personal Nature: Strengths And Weaknesses', 'personal_nature'],
  ['04', 'Past Life Karma', 'past_life_karma'],
  ['05', 'Finances', 'finances'],
  ['06', 'Marriage And Partnership', 'marriage'],
  ['07', 'Health And Constitution', 'health'],
  ['08', 'Children', 'children'],
  ['09', 'Property Purchase', 'property']
];

const SECTION_META = {
  'How To Read This Report': 'How the report works, what each layer means, and where its limits are',
  'Your Chart And Numbers At A Glance': 'The strongest chart and number signals before the detailed reading',
  'Personal Nature: Strengths And Weaknesses': 'Your natural operating style, strengths, blind spots and repeated patterns',
  'Past Life Karma': 'Symbolic karmic patterns and lessons that repeat until handled differently',
  Finances: 'Earning patterns, financial behaviour, opportunities, leaks and timing',
  'Marriage And Partnership': 'Partnership patterns, expectations, compatibility dynamics and timing',
  'Health And Constitution': 'Constitutional tendencies, routine, stress patterns and wellbeing awareness',
  Children: 'Children, nurturing patterns, family responsibilities and timing where supported',
  'Property Purchase': 'Home, property, stability and long-term material decisions',
  Remedies: 'Practical first, structural second, optional observance last',
  'Your Timing Map': 'A five-year map of changing emphasis and practical direction',
  'Closing Summary': 'The five points worth carrying forward from the complete reading',
  'Scope And Limitations': 'Clear boundaries so the report remains useful and responsible'
};

function clean(value) {
  return String(value == null ? '' : value)
    .replace(/\r/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function firstSentence(value, max = 180) {
  const text = clean(value);
  if (!text) return 'The available data is deliberately quiet here rather than forcing a conclusion.';
  const match = text.match(/^(.{1,260}?[.!?])(?:\s|$)/);
  const picked = match ? match[1] : text;
  return picked.length <= max ? picked : `${picked.slice(0, max - 3).trim()}...`;
}

function contentWidth() {
  return A4[0] - P.left - P.right;
}

function loadAssets() {
  const logoSvgPath = path.join(process.cwd(), 'public', 'divya-bajaj-golden-logo.svg');
  const portraitPath = path.join(process.cwd(), 'public', 'divya-profile.png');
  let logoSvg = '';
  let logoPng = null;
  let portrait = null;
  try {
    logoSvg = fs.readFileSync(logoSvgPath, 'utf8');
    const embedded = logoSvg.match(/href=["']data:image\/png;base64,([^"']+)/i);
    if (embedded && embedded[1]) logoPng = Buffer.from(embedded[1], 'base64');
  } catch (error) {}
  try { portrait = fs.readFileSync(portraitPath); } catch (error) {}
  return { logoSvg, logoPng, portrait };
}

function drawLogo(doc, assets, x, y, width) {
  if (assets.logoPng) {
    try { doc.image(assets.logoPng, x, y, { width }); return; } catch (error) {}
  }
  if (assets.logoSvg) {
    try { SVGtoPDF(doc, assets.logoSvg, x, y, { width, preserveAspectRatio: 'xMidYMin meet' }); return; } catch (error) {}
  }
  doc.fillColor(C.goldDeep).font(T.displayBold).fontSize(13).text('DIVYA BAJAJ', x, y + 12, { width, align: 'center' });
}

function drawStar(doc, x, y, r = 3) {
  doc.save();
  doc.strokeColor(C.goldSoft).lineWidth(0.45);
  doc.moveTo(x - r, y).lineTo(x + r, y).stroke();
  doc.moveTo(x, y - r).lineTo(x, y + r).stroke();
  doc.restore();
}

function drawMoon(doc, x, y, r) {
  doc.save();
  doc.fillColor(C.goldDeep).circle(x, y, r).fill();
  doc.fillColor(C.paper).circle(x + r * 0.46, y - r * 0.15, r * 0.95).fill();
  doc.restore();
}

function drawZodiacWheel(doc) {
  const cx = 475;
  const cy = 205;
  const radii = [64, 81, 99, 116, 137];
  doc.save();
  doc.opacity(0.43).strokeColor(C.goldSoft).lineWidth(0.55);
  radii.forEach(r => doc.circle(cx, cy, r).stroke());
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    doc.moveTo(cx + Math.cos(a) * 64, cy + Math.sin(a) * 64)
      .lineTo(cx + Math.cos(a) * 137, cy + Math.sin(a) * 137).stroke();
  }
  doc.circle(cx, cy, 20).stroke();
  for (let i = 0; i < 18; i += 1) {
    const a = (Math.PI * 2 * i) / 18;
    doc.moveTo(cx, cy).lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30).stroke();
  }
  doc.restore();
  drawStar(doc, 325, 62, 4);
  drawStar(doc, 395, 88, 3);
  drawStar(doc, 535, 68, 3);
  drawStar(doc, 548, 285, 2.5);
}

function drawBottomCelestial(doc) {
  doc.save();
  doc.strokeColor(C.goldSoft).lineWidth(0.65).opacity(0.65);
  doc.moveTo(25, 744).bezierCurveTo(170, 680, 205, 735, 345, 759).bezierCurveTo(448, 777, 510, 743, 572, 701).stroke();
  doc.moveTo(25, 760).bezierCurveTo(160, 706, 225, 758, 353, 778).bezierCurveTo(466, 795, 520, 754, 576, 724).stroke();
  doc.restore();
  [107, 137, 166, 197, 228].forEach((x, i) => {
    if (i === 2) { doc.save(); doc.fillColor(C.goldSoft).circle(x, 748, 7).fill(); doc.restore(); }
    else drawMoon(doc, x, 748, 7);
  });
  drawStar(doc, 82, 755, 3);
  drawStar(doc, 250, 757, 3);
  drawStar(doc, 365, 765, 3);
}

function drawCover(doc, lead, assets) {
  const w = A4[0];
  const h = A4[1];
  doc.rect(0, 0, w, h).fill(C.paper);
  doc.rect(26, 24, w - 52, h - 48).lineWidth(0.65).strokeColor(C.gold).stroke();
  drawZodiacWheel(doc);
  drawBottomCelestial(doc);
  drawMoon(doc, 536, 38, 11);
  drawLogo(doc, assets, 55, 50, 135);

  doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(8.2)
    .text('P R I V A T E   P E R S O N A L   R E P O R T', 63, 198, { width: 235 });
  doc.strokeColor(C.goldSoft).lineWidth(0.8).moveTo(63, 218).lineTo(235, 218).stroke();
  drawStar(doc, 149, 218, 3);

  doc.fillColor(C.ink).font(T.display).fontSize(36)
    .text('The\nIntegrated\nLife Report', 63, 240, { width: 270, lineGap: 0 });
  doc.fillColor(C.goldDeep).font(T.displayItalic).fontSize(14)
    .text(DESIGN.methodologyLine, 65, 407, { width: 260 });
  doc.strokeColor(C.goldSoft).lineWidth(0.8).moveTo(65, 431).lineTo(170, 431).stroke();
  drawStar(doc, 152, 431, 3);

  doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(7.2)
    .text('P R E P A R E D   F O R', 65, 460, { width: 185 });
  doc.fillColor(C.ink).font(T.display).fontSize(22)
    .text(clean(lead.name) || 'Client Name', 65, 479, { width: 275, ellipsis: true });

  const info = [
    ['DATE OF BIRTH', lead.dob || '-'],
    ['TIME OF BIRTH', lead.tob || '-'],
    ['PLACE OF BIRTH', lead.pob || lead.place || '-']
  ];
  let y = 534;
  info.forEach(([label, value], index) => {
    const iconX = 79;
    const iconY = y + 9;
    doc.strokeColor(C.goldSoft).lineWidth(0.7).circle(iconX, iconY, 16).stroke();
    if (index === 1) drawMoon(doc, iconX - 1, iconY, 8);
    else if (index === 0) {
      doc.strokeColor(C.goldDeep).lineWidth(0.7);
      for (let a = 0; a < 8; a += 1) {
        const r = (Math.PI * 2 * a) / 8;
        doc.moveTo(iconX, iconY).lineTo(iconX + Math.cos(r) * 8, iconY + Math.sin(r) * 8).stroke();
      }
      doc.circle(iconX, iconY, 3).stroke();
    } else {
      doc.strokeColor(C.goldDeep).lineWidth(0.7).circle(iconX, iconY, 8).stroke();
      doc.moveTo(iconX - 8, iconY).lineTo(iconX + 8, iconY).stroke();
      doc.moveTo(iconX, iconY - 8).lineTo(iconX, iconY + 8).stroke();
    }
    doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(6.5).text(label, 108, y, { width: 155, characterSpacing: 0.8 });
    doc.fillColor(C.ink).font(T.body).fontSize(9).text(clean(value), 108, y + 15, { width: 175, ellipsis: true });
    doc.strokeColor(C.muted).lineWidth(0.5).dash(1.5, { space: 2 }).moveTo(108, y + 31).lineTo(230, y + 31).stroke().undash();
    y += 47;
  });

  if (assets.portrait) {
    try { doc.image(assets.portrait, 272, 294, { fit: [304, 420], align: 'right', valign: 'bottom' }); } catch (error) {}
  }

  doc.fillColor(C.ink).font(T.body).fontSize(7.1)
    .text('D I V Y A   B A J A J   |   P R I V A T E   P E R S O N A L   R E P O R T', 58, 801, { width: 340, characterSpacing: 0.55 });
  doc.strokeColor(C.goldSoft).lineWidth(0.65).moveTo(283, 806).lineTo(550, 806).stroke();
  drawStar(doc, 554, 806, 3);
}

function drawPageChrome(doc, ctx, label) {
  const w = A4[0];
  const h = A4[1];
  doc.save();
  doc.rect(0, 0, w, h).fill(C.paper);
  drawLogo(doc, ctx.assets, (w - DESIGN.header.logoWidth) / 2, DESIGN.header.logoTop, DESIGN.header.logoWidth);
  doc.fillColor(C.ink).font(T.body).fontSize(6.5)
    .text(clean(label || DESIGN.documentTitle).toUpperCase(), DESIGN.header.sectionX, DESIGN.header.sectionY, {
      width: DESIGN.header.sectionWidth,
      align: 'right',
      characterSpacing: 0.2,
      lineBreak: false
    });
  doc.strokeColor(C.goldSoft).lineWidth(0.65).moveTo(P.left, P.headerDividerY).lineTo(w - P.right, P.headerDividerY).stroke();
  doc.restore();
  doc.x = P.left;
  doc.y = P.contentTop;
}

function drawFooter(doc, ctx, pageIndex) {
  doc.save();
  doc.strokeColor(C.goldSoft).lineWidth(0.65).moveTo(P.left, P.footerDividerY).lineTo(456, P.footerDividerY).stroke();
  doc.fillColor(C.ink).font(T.body).fontSize(6.6)
    .text('DIVYA BAJAJ   |   PRIVATE PERSONAL REPORT', DESIGN.footer.textX, DESIGN.footer.textY, { width: 260, characterSpacing: 0.2, lineBreak: false });
  doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(7.2)
    .text(String(pageIndex + 1).padStart(2, '0'), DESIGN.footer.pageX, DESIGN.footer.pageY, { width: 22, align: 'right', lineBreak: false });
  if (ctx.assets.portrait) {
    try {
      doc.image(ctx.assets.portrait, DESIGN.footer.portraitX, DESIGN.footer.portraitY, {
        fit: [DESIGN.footer.portraitWidth, DESIGN.footer.portraitHeight],
        align: 'right',
        valign: 'bottom'
      });
    } catch (error) {}
  }
  doc.restore();
}

function remaining(ctx) {
  return P.contentBottom - ctx.doc.y;
}

function addContentPage(ctx, label) {
  ctx.sectionLabel = label || ctx.sectionLabel || DESIGN.documentTitle;
  ctx.pageKind = 'content';
  ctx.doc.addPage({ size: A4, margins: CONTENT_MARGINS });
  const r = ctx.doc.bufferedPageRange();
  return r.start + r.count - 1;
}

function ensureSpace(ctx, needed) {
  if (remaining(ctx) < needed) addContentPage(ctx, ctx.sectionLabel);
}

function measure(doc, text, width, opts = {}) {
  doc.font(opts.font || T.body).fontSize(opts.size || T.bodySize);
  return doc.heightOfString(clean(text), { width, lineGap: opts.lineGap == null ? T.lineGap : opts.lineGap });
}

function paragraph(ctx, text, opts = {}) {
  const value = clean(text);
  if (!value) return;
  const width = opts.width || contentWidth();
  const h = measure(ctx.doc, value, width, opts);
  if (h <= 108) ensureSpace(ctx, h + 7);
  ctx.doc.fillColor(opts.color || C.ink).font(opts.font || T.body).fontSize(opts.size || T.bodySize)
    .text(value, opts.x || P.left, ctx.doc.y, { width, lineGap: opts.lineGap == null ? T.lineGap : opts.lineGap, align: 'left' });
  ctx.doc.y += opts.after == null ? S.md : opts.after;
}

function subheading(ctx, text) {
  ensureSpace(ctx, DESIGN.rules.minimumHeadingFollowSpace);
  ctx.doc.fillColor(C.ink).font(T.bodyBold).fontSize(T.h3)
    .text(clean(text), P.left, ctx.doc.y, { width: contentWidth() });
  ctx.doc.y += S.sm;
}

function sectionStart(ctx, number, title) {
  ctx.sectionLabel = title;
  if (remaining(ctx) < DESIGN.rules.minimumSectionStartSpace) addContentPage(ctx, title);
  else if (ctx.doc.y > P.contentTop + 4) ctx.doc.y += S.xl;
  const r = ctx.doc.bufferedPageRange();
  const pageIndex = r.start + r.count - 1;
  ctx.sectionPages[title] = pageIndex + 1;
  ctx.doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(6.8).text(number, P.left, ctx.doc.y, { characterSpacing: 1 });
  ctx.doc.y += 16;
  ctx.doc.fillColor(C.ink).font(T.displayBold).fontSize(T.h1)
    .text(title, P.left, ctx.doc.y, { width: contentWidth(), lineGap: 1.5 });
  ctx.doc.y += 5;
  const meta = SECTION_META[title];
  if (meta) {
    ctx.doc.fillColor(C.muted).font(T.displayItalic).fontSize(9.2)
      .text(meta, P.left, ctx.doc.y, { width: contentWidth(), lineGap: 1.5 });
    ctx.doc.y += 12;
  }
  ctx.doc.strokeColor(C.goldSoft).lineWidth(0.55).moveTo(P.left, ctx.doc.y).lineTo(A4[0] - P.right, ctx.doc.y).stroke();
  ctx.doc.y += S.lg;
}

function bulletList(ctx, items) {
  safeArray(items).forEach(item => {
    const value = clean(typeof item === 'string' ? item : JSON.stringify(item));
    if (!value) return;
    const textWidth = contentWidth() - 17;
    const h = measure(ctx.doc, value, textWidth, { size: T.bodySize });
    if (h <= 105) ensureSpace(ctx, h + 12);
    const y = ctx.doc.y;
    ctx.doc.fillColor(C.goldDeep).circle(P.left + 3, y + 5, 1.8).fill();
    ctx.doc.fillColor(C.ink).font(T.body).fontSize(T.bodySize)
      .text(value, P.left + 15, y, { width: textWidth, lineGap: T.lineGap });
    ctx.doc.y = y + h + S.sm;
  });
}

function callout(ctx, label, text, opts = {}) {
  const value = clean(text);
  if (!value) return;
  const width = contentWidth();
  const innerW = width - 34;
  const bodyH = measure(ctx.doc, value, innerW, { font: opts.font || T.body, size: opts.size || 9, lineGap: 3 });
  const boxH = bodyH + 45;
  ensureSpace(ctx, boxH + S.md);
  const y = ctx.doc.y;
  ctx.doc.roundedRect(P.left, y, width, boxH, 5).fillAndStroke(opts.fill || C.sand, C.line);
  ctx.doc.rect(P.left, y, 4, boxH).fill(C.goldDeep);
  ctx.doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(6.6)
    .text(clean(label).toUpperCase(), P.left + 17, y + 11, { width: innerW, characterSpacing: 0.65 });
  ctx.doc.fillColor(C.ink).font(opts.font || T.body).fontSize(opts.size || 9)
    .text(value, P.left + 17, y + 27, { width: innerW, lineGap: 3 });
  ctx.doc.y = y + boxH + S.md;
}

function confidence(ctx, text) {
  const value = clean(text);
  if (!value) return;
  const width = contentWidth();
  const bodyW = width - 122;
  const bodyH = measure(ctx.doc, value, bodyW, { size: 8.1, lineGap: 2.5 });
  const h = Math.max(42, bodyH + 18);
  ensureSpace(ctx, h + S.md);
  const y = ctx.doc.y;
  ctx.doc.roundedRect(P.left, y, width, h, 4).fillAndStroke(C.sandDeep, C.line);
  ctx.doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(6.6).text('CONFIDENCE', P.left + 14, y + 13, { characterSpacing: 0.65 });
  ctx.doc.fillColor(C.ink).font(T.body).fontSize(8.1).text(value, P.left + 102, y + 10, { width: bodyW, lineGap: 2.5 });
  ctx.doc.y = y + h + S.md;
}

function cellHeight(doc, text, width, size, lineGap = 2) {
  doc.font(T.body).fontSize(size);
  return doc.heightOfString(clean(text), { width: width - 12, lineGap });
}

function table(ctx, columns, rows, opts = {}) {
  const size = opts.size || T.table;
  const headerH = opts.headerHeight || 26;
  const lineGap = opts.lineGap == null ? 2 : opts.lineGap;
  function drawHeader() {
    ensureSpace(ctx, headerH + 20);
    const y = ctx.doc.y;
    let x = P.left;
    columns.forEach(col => {
      ctx.doc.rect(x, y, col.width, headerH).fillAndStroke(C.goldDeep, C.goldDeep);
      ctx.doc.fillColor(C.white).font(T.bodyBold).fontSize(6.6)
        .text(col.label, x + 6, y + 8, { width: col.width - 12, align: col.align || 'left' });
      x += col.width;
    });
    ctx.doc.y = y + headerH;
  }
  drawHeader();
  safeArray(rows).forEach((row, index) => {
    const values = columns.map(col => clean(typeof col.value === 'function' ? col.value(row) : row[col.key]));
    const heights = values.map((value, i) => cellHeight(ctx.doc, value, columns[i].width, size, lineGap));
    const rowH = Math.max(opts.minRowHeight || 31, ...heights.map(v => v + 14));
    if (remaining(ctx) < rowH) { addContentPage(ctx, ctx.sectionLabel); drawHeader(); }
    const y = ctx.doc.y;
    let x = P.left;
    columns.forEach((col, i) => {
      ctx.doc.rect(x, y, col.width, rowH).fillAndStroke(index % 2 ? C.sand : C.paperLight, C.line);
      ctx.doc.fillColor(C.ink).font(T.body).fontSize(size)
        .text(values[i], x + 6, y + 7, { width: col.width - 12, lineGap, align: col.align || 'left' });
      x += col.width;
    });
    ctx.doc.y = y + rowH;
  });
  ctx.doc.y += S.lg;
}

function drawContentsPlaceholder(ctx) {
  ctx.tocPage = addContentPage(ctx, 'Contents');
}

function drawSummary(ctx, lead, report) {
  ctx.summaryPage = addContentPage(ctx, 'Your Report In One Page');
  const firstName = clean(lead.name).split(' ')[0] || 'Your';
  ctx.doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(7).text('YOUR REPORT IN ONE PAGE', P.left, ctx.doc.y, { characterSpacing: 1.05 });
  ctx.doc.y += 20;
  ctx.doc.fillColor(C.ink).font(T.displayBold).fontSize(24)
    .text(`The big picture, ${firstName}`, P.left, ctx.doc.y, { width: contentWidth() });
  ctx.doc.y += 8;
  callout(ctx, 'The strongest signal', report.glance?.headline_finding || 'The strongest themes in the report are shown below.', { fill: C.sand, font: T.displayBold, size: 9.5 });
  ctx.doc.fillColor(C.ink).font(T.bodyBold).fontSize(10).text('Seven-area pulse', P.left, ctx.doc.y);
  ctx.doc.y += 12;
  const lifeRows = LIFE_SECTIONS.map(([, title, key]) => {
    const area = report.life_areas?.[key] || {};
    return {
      area: title.replace(': Strengths And Weaknesses', '').replace(' And Constitution', '').replace(' And Partnership', '').replace(' Purchase', ''),
      insight: firstSentence(area.convergence || area.tension_or_silence || area.intro, 170)
    };
  });
  table(ctx, [
    { label: 'AREA', key: 'area', width: 91 },
    { label: 'WHAT TO NOTICE', key: 'insight', width: contentWidth() - 91 }
  ], lifeRows, { size: 7.15, minRowHeight: 27, headerHeight: 24, lineGap: 1.8 });
  const timing = safeArray(report.timing_map)[0];
  if (timing) callout(ctx, 'Your current chapter', `${timing.period}: ${timing.combined_reading || timing.astrology || timing.numerology}`, { fill: C.paperLight, size: 8.3 });
  const concern = clean(lead.question);
  paragraph(ctx, concern
    ? `Your main concern is "${concern}". The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.`
    : 'The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.',
  { font: T.displayItalic, size: 9.2, after: 0 });
}

function renderPrimer(ctx, report) {
  sectionStart(ctx, '01', 'How To Read This Report');
  const primer = report.primer || {};
  paragraph(ctx, primer.purpose, { font: T.display, size: 11.3, after: S.lg });
  subheading(ctx, 'The two systems used in your report');
  paragraph(ctx, primer.systems);
  subheading(ctx, 'The four ideas you need');
  const ideas = primer.four_ideas || {};
  [
    ['01', 'Houses are life departments', ideas.houses],
    ['02', 'Planets are the officers in charge', ideas.planets],
    ['03', 'Dasha is whose turn it is', ideas.dasha],
    ['04', 'The chain of command', ideas.chain_of_command]
  ].forEach(([number, title, body]) => {
    ensureSpace(ctx, 62);
    const y = ctx.doc.y;
    ctx.doc.fillColor(C.goldDeep).font(T.displayBold).fontSize(18).text(number, P.left, y, { width: 32 });
    ctx.doc.fillColor(C.ink).font(T.bodyBold).fontSize(10).text(title, P.left + 42, y + 2, { width: contentWidth() - 42 });
    ctx.doc.y = y + 21;
    paragraph(ctx, body, { x: P.left + 42, width: contentWidth() - 42, size: 8.8, after: S.md });
  });
  callout(ctx, 'Convergence method', primer.convergence_method, { fill: C.sand });
  subheading(ctx, 'What this report will not do');
  bulletList(ctx, primer.limits);
  paragraph(ctx, primer.disclaimer, { font: T.displayItalic, size: 8.7 });
}

function renderGlance(ctx, report) {
  sectionStart(ctx, '02', 'Your Chart And Numbers At A Glance');
  const glance = report.glance || {};
  callout(ctx, 'Headline finding', glance.headline_finding, { fill: C.sand, font: T.displayBold, size: 9.4 });
  subheading(ctx, 'The astrological layer');
  table(ctx, [
    { label: 'ELEMENT', key: 'element', width: 92 },
    { label: 'YOUR POSITION', key: 'position', width: 142 },
    { label: 'WHAT IT MEANS', key: 'plain_meaning', width: contentWidth() - 234 }
  ], glance.astrology || [], { size: 7.2, minRowHeight: 34 });
  subheading(ctx, 'The numerological layer');
  table(ctx, [
    { label: 'NUMBER', key: 'label', width: 104 },
    { label: 'VALUE', key: 'value', width: 42, align: 'center' },
    { label: 'DERIVED FROM', key: 'derived_from', width: 133 },
    { label: 'PLAIN MEANING', key: 'plain_meaning', width: contentWidth() - 279 }
  ], glance.numerology || [], { size: 7.05, minRowHeight: 31 });
}

function renderLifeArea(ctx, number, title, area = {}) {
  sectionStart(ctx, number, title);
  paragraph(ctx, area.intro, { font: T.display, size: 11, after: S.lg });
  subheading(ctx, 'What your birth chart shows');
  paragraph(ctx, area.birth_chart);
  subheading(ctx, 'What your numbers show');
  paragraph(ctx, area.numbers);
  callout(ctx, 'Where the two systems agree', area.convergence, { fill: C.sand, font: T.displayBold, size: 9.2 });
  subheading(ctx, 'Where the picture is mixed');
  paragraph(ctx, area.tension_or_silence);
  subheading(ctx, 'Timing');
  if (safeArray(area.timing).length) bulletList(ctx, area.timing);
  else paragraph(ctx, 'No timing claim is made because the verified data does not support one.');
  subheading(ctx, 'What to actually do about it');
  bulletList(ctx, area.actions);
  confidence(ctx, area.confidence);
}

function renderRemedies(ctx, report) {
  sectionStart(ctx, '10', 'Remedies');
  const remedies = report.remedies || {};
  paragraph(ctx, remedies.intro, { font: T.display, size: 11, after: S.lg });
  subheading(ctx, 'Priority one: behavioural practices');
  safeArray(remedies.behavioural).forEach((item, index) => {
    const body = [item.pattern && `Pattern: ${item.pattern}`, item.practice && `Practice: ${item.practice}`, item.rhythm && `Rhythm: ${item.rhythm}`, item.purpose && `Purpose: ${item.purpose}`].filter(Boolean).join('  ');
    callout(ctx, `Practice ${String(index + 1).padStart(2, '0')}`, body, { fill: C.paperLight, size: 8.4 });
  });
  subheading(ctx, 'Priority two: professional and structural');
  bulletList(ctx, remedies.professional_structural);
  subheading(ctx, 'Priority three: optional traditional observance');
  safeArray(remedies.traditional_observance).forEach(item => {
    callout(ctx, item.planet || 'Optional observance', [item.why, item.observance].filter(Boolean).join('  '), { fill: C.sand, size: 8.4 });
  });
  callout(ctx, 'Gemstones', remedies.gemstone_note || 'No gemstone is recommended in this report without a separate dedicated planetary-strength assessment.', { fill: C.paperLight, size: 8.5 });
}

function renderTiming(ctx, report) {
  sectionStart(ctx, '11', 'Your Timing Map');
  table(ctx, [
    { label: 'PERIOD', key: 'period', width: 66 },
    { label: 'ASTROLOGY', key: 'astrology', width: 104 },
    { label: 'NUMEROLOGY', key: 'numerology', width: 93 },
    { label: 'COMBINED READING', key: 'combined_reading', width: contentWidth() - 309 },
    { label: 'CONF.', key: 'confidence', width: 46 }
  ], report.timing_map || [], { size: 6.7, minRowHeight: 42, lineGap: 1.8 });
  if (report.major_shift?.period && report.major_shift?.reading) {
    callout(ctx, `Major shift: ${report.major_shift.period}`, `${report.major_shift.reading} ${report.major_shift.confidence || ''}`, { fill: C.sand, size: 8.4 });
  }
}

function renderClosing(ctx, report) {
  sectionStart(ctx, '12', 'Closing Summary');
  safeArray(report.closing_summary).forEach((point, index) => {
    ensureSpace(ctx, 54);
    const y = ctx.doc.y;
    ctx.doc.fillColor(C.goldDeep).font(T.displayBold).fontSize(20).text(String(index + 1).padStart(2, '0'), P.left, y, { width: 36 });
    const width = contentWidth() - 48;
    const h = measure(ctx.doc, point, width, { size: 9.1, lineGap: 3 });
    ctx.doc.fillColor(C.ink).font(T.body).fontSize(9.1).text(clean(point), P.left + 48, y + 1, { width, lineGap: 3 });
    ctx.doc.y = y + Math.max(43, h + 10);
    ctx.doc.strokeColor(C.line).lineWidth(0.4).moveTo(P.left + 48, ctx.doc.y).lineTo(A4[0] - P.right, ctx.doc.y).stroke();
    ctx.doc.y += S.md;
  });
}

function renderLimitations(ctx, report) {
  sectionStart(ctx, '13', 'Scope And Limitations');
  bulletList(ctx, report.scope_limitations);
}

function fillContents(ctx) {
  ctx.doc.switchToPage(ctx.tocPage);
  drawPageChrome(ctx.doc, ctx, 'Contents');
  ctx.doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(7).text('CONTENTS', P.left, ctx.doc.y, { characterSpacing: 1.05 });
  ctx.doc.y += 20;
  ctx.doc.fillColor(C.ink).font(T.displayBold).fontSize(24).text('Your report map', P.left, ctx.doc.y, { width: contentWidth() });
  ctx.doc.y += 9;
  ctx.doc.fillColor(C.muted).font(T.body).fontSize(8.8)
    .text('Read the one-page summary first, then move through the complete reading. Page numbers below are generated from the final layout.', P.left, ctx.doc.y, { width: contentWidth(), lineGap: 2.8 });
  ctx.doc.y += 25;
  const entries = [
    ['00', 'Your Report In One Page', ctx.summaryPage + 1],
    ['01', 'How To Read This Report', ctx.sectionPages['How To Read This Report']],
    ['02', 'Your Chart And Numbers At A Glance', ctx.sectionPages['Your Chart And Numbers At A Glance']],
    ...LIFE_SECTIONS.map(([number, title]) => [number, title, ctx.sectionPages[title]]),
    ['10', 'Remedies', ctx.sectionPages.Remedies],
    ['11', 'Your Timing Map', ctx.sectionPages['Your Timing Map']],
    ['12', 'Closing Summary', ctx.sectionPages['Closing Summary']],
    ['13', 'Scope And Limitations', ctx.sectionPages['Scope And Limitations']]
  ];
  entries.forEach(([number, title, page]) => {
    const y = ctx.doc.y;
    ctx.doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(7.1).text(number, P.left, y + 2, { width: 25 });
    ctx.doc.fillColor(C.ink).font(T.bodyBold).fontSize(8.9).text(title, P.left + 34, y, { width: contentWidth() - 84 });
    ctx.doc.fillColor(C.goldDeep).font(T.bodyBold).fontSize(7.8).text(String(page || ''), A4[0] - P.right - 30, y, { width: 30, align: 'right' });
    ctx.doc.strokeColor(C.line).lineWidth(0.35).moveTo(P.left + 34, y + 18).lineTo(A4[0] - P.right, y + 18).stroke();
    ctx.doc.y = y + 27;
  });
}

function addAllFooters(ctx) {
  const r = ctx.doc.bufferedPageRange();
  for (let i = r.start + 1; i < r.start + r.count; i += 1) {
    ctx.doc.switchToPage(i);
    drawFooter(ctx.doc, ctx, i);
  }
}

function normalizeReport(reportJson) {
  if (!reportJson || typeof reportJson !== 'object') throw new Error('V4 PDF requires structured report JSON');
  return reportJson;
}

async function generateStructuredPaidPdfV4({ lead = {}, reportJson = null }) {
  const report = normalizeReport(reportJson);
  const assets = loadAssets();
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        autoFirstPage: false,
        bufferPages: true,
        info: { Title: `Divya Bajaj - ${DESIGN.documentTitle}`, Author: 'Divya Bajaj', Subject: DESIGN.methodologyLine }
      });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const ctx = { doc, assets, pageKind: 'cover', sectionLabel: DESIGN.documentTitle, tocPage: null, summaryPage: null, sectionPages: {} };
      doc.on('pageAdded', () => { if (ctx.pageKind === 'content') drawPageChrome(doc, ctx, ctx.sectionLabel); });

      doc.addPage({ size: A4, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      drawCover(doc, lead, assets);
      drawContentsPlaceholder(ctx);
      drawSummary(ctx, lead, report);
      renderPrimer(ctx, report);
      renderGlance(ctx, report);
      LIFE_SECTIONS.forEach(([number, title, key]) => renderLifeArea(ctx, number, title, report.life_areas?.[key] || {}));
      renderRemedies(ctx, report);
      renderTiming(ctx, report);
      renderClosing(ctx, report);
      renderLimitations(ctx, report);
      fillContents(ctx);
      addAllFooters(ctx);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateStructuredPaidPdfV4 };
