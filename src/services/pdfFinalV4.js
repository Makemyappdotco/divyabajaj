const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const A4 = [595.28, 841.89];
const LEFT = 45;
const RIGHT = 45;
const CONTENT_TOP = 132;
const CONTENT_BOTTOM = 688;
const CONTENT_WIDTH = A4[0] - LEFT - RIGHT;

const C = {
  paper: '#FBF5EB',
  paperLight: '#FFFDF8',
  gold: '#B7873D',
  goldDeep: '#A9772E',
  goldSoft: '#D6B985',
  sand: '#F7ECDD',
  sandDeep: '#F0DFC6',
  ink: '#1D1A18',
  muted: '#62584D',
  line: '#D6B985',
  white: '#FFFFFF'
};

const LIFE_SECTIONS = [
  ['03', 'Personal Nature: Strengths And Weaknesses', 'personal_nature'],
  ['04', 'Past Life Karma', 'past_life_karma'],
  ['05', 'Finances', 'finances'],
  ['06', 'Marriage And Partnership', 'marriage'],
  ['07', 'Health And Constitution', 'health'],
  ['08', 'Children', 'children'],
  ['09', 'Property Purchase', 'property']
];

function clean(value) {
  return String(value == null ? '' : value)
    .replace(/\r/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function safeFileName(value) {
  return String(value || 'Divya-Bajaj')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'Divya-Bajaj';
}

function firstSentence(value, max = 180) {
  const text = clean(value);
  if (!text) return 'The available data is deliberately quiet here rather than forcing a conclusion.';
  const match = text.match(/^(.{1,260}?[.!?])(?:\s|$)/);
  const picked = match ? match[1] : text;
  return picked.length <= max ? picked : `${picked.slice(0, max - 3).trim()}...`;
}

function formatDob(value) {
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

function formatTime(value) {
  const text = clean(value);
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return text;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

function readChunkedAsset(prefix, count) {
  const dir = path.join(process.cwd(), 'public', 'report-v4', 'chunks');
  let encoded = '';
  for (let i = 1; i <= count; i += 1) {
    encoded += fs.readFileSync(path.join(dir, `${prefix}.${String(i).padStart(2, '0')}.b64`), 'utf8').replace(/\s+/g, '');
  }
  return Buffer.from(encoded, 'base64');
}

function loadAssets() {
  return {
    cover: readChunkedAsset('cover', 9),
    chrome: readChunkedAsset('chrome', 1),
    logo: readChunkedAsset('logo', 2),
    portrait: readChunkedAsset('portrait', 4)
  };
}

function drawCover(doc, lead, assets) {
  doc.image(assets.cover, 0, 0, { width: A4[0], height: A4[1] });

  doc.fillColor(C.paper).rect(62, 493, 196, 34).fill();
  doc.fillColor(C.ink).font('Times-Roman').fontSize(22)
    .text(clean(lead.name) || 'Client Name', 65, 494.5, { width: 205, lineBreak: false, ellipsis: true });

  const details = [
    [formatDob(lead.dob), 550],
    [formatTime(lead.tob), 597],
    [clean(lead.pob || lead.place), 644]
  ];
  details.forEach(([value, y]) => {
    doc.fillColor(C.paper).rect(103, y - 2, 152, 16).fill();
    doc.fillColor(C.ink).font('Helvetica').fontSize(7.6)
      .text(value || '-', 108, y, { width: 145, lineBreak: false, ellipsis: true });
    doc.strokeColor(C.goldSoft).lineWidth(0.55).moveTo(108, y + 13.5).lineTo(239, y + 13.5).stroke();
  });
}

function drawChrome(doc, ctx, label, pageNo) {
  doc.image(ctx.assets.chrome, 0, 0, { width: A4[0], height: A4[1] });
  doc.image(ctx.assets.logo, 247, 16.1605, { width: 101, height: 80.679 });
  doc.image(ctx.assets.portrait, 472, 714.0508, { width: 123, height: 126.8983 });

  doc.fillColor(C.ink).font('Helvetica').fontSize(6.4)
    .text(clean(label || 'The Integrated Life Report').toUpperCase(), 442, 90, {
      width: 108,
      align: 'right',
      lineBreak: false,
      ellipsis: true
    });
  doc.fillColor(C.goldDeep).font('Helvetica-Bold').fontSize(7.2)
    .text(String(pageNo).padStart(2, '0'), 438, 798, { width: 22, align: 'right', lineBreak: false });

  doc.x = LEFT;
  doc.y = CONTENT_TOP;
}

function currentPageNo(doc) {
  const r = doc.bufferedPageRange();
  return r.start + r.count;
}

function addContentPage(ctx, label) {
  ctx.sectionLabel = label || ctx.sectionLabel || 'The Integrated Life Report';
  ctx.doc.addPage({ size: A4, margins: { top: CONTENT_TOP, bottom: A4[1] - CONTENT_BOTTOM, left: LEFT, right: RIGHT } });
  const pageNo = currentPageNo(ctx.doc);
  drawChrome(ctx.doc, ctx, ctx.sectionLabel, pageNo);
  return pageNo;
}

function remaining(ctx) {
  return CONTENT_BOTTOM - ctx.doc.y;
}

function ensureSpace(ctx, needed) {
  if (remaining(ctx) < needed) addContentPage(ctx, ctx.sectionLabel);
}

function measure(doc, text, width = CONTENT_WIDTH, opts = {}) {
  doc.font(opts.font || 'Helvetica').fontSize(opts.size || 8.8);
  return doc.heightOfString(clean(text), { width, lineGap: opts.lineGap == null ? 3 : opts.lineGap });
}

function paragraph(ctx, value, opts = {}) {
  const text = clean(value);
  if (!text) return;
  const width = opts.width || CONTENT_WIDTH;
  const h = measure(ctx.doc, text, width, opts);
  if (h <= 110) ensureSpace(ctx, h + 8);
  const startY = ctx.doc.y;
  ctx.doc.fillColor(opts.color || C.ink).font(opts.font || 'Helvetica').fontSize(opts.size || 8.8)
    .text(text, opts.x || LEFT, startY, {
      width,
      lineGap: opts.lineGap == null ? 3 : opts.lineGap,
      align: 'left'
    });
  ctx.doc.y = Math.max(ctx.doc.y, startY + h) + (opts.after == null ? 8 : opts.after);
}

function subheading(ctx, text) {
  ensureSpace(ctx, 56);
  ctx.doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10)
    .text(clean(text), LEFT, ctx.doc.y, { width: CONTENT_WIDTH });
  ctx.doc.y += 18;
}

function sectionStart(ctx, number, title) {
  ctx.sectionLabel = title;
  if (remaining(ctx) < 112) addContentPage(ctx, title);
  else if (ctx.doc.y > CONTENT_TOP + 4) ctx.doc.y += 18;

  const pageNo = currentPageNo(ctx.doc);
  if (!ctx.sectionPages[title]) ctx.sectionPages[title] = pageNo;

  ctx.doc.fillColor(C.goldDeep).font('Helvetica-Bold').fontSize(7.4)
    .text(String(number).padStart(2, '0'), LEFT, ctx.doc.y, { characterSpacing: 0.9 });
  ctx.doc.y += 16;
  ctx.doc.fillColor(C.ink).font('Times-Bold').fontSize(22)
    .text(title, LEFT, ctx.doc.y, { width: CONTENT_WIDTH, lineGap: 1 });
  ctx.doc.y += 12;
}

function bulletList(ctx, items) {
  list(items).forEach(item => {
    const text = clean(typeof item === 'string' ? item : JSON.stringify(item));
    if (!text) return;
    const width = CONTENT_WIDTH - 17;
    const h = measure(ctx.doc, text, width, { size: 8.8, lineGap: 3 });
    if (h <= 108) ensureSpace(ctx, h + 10);
    const y = ctx.doc.y;
    ctx.doc.fillColor(C.goldDeep).circle(LEFT + 3, y + 5, 1.7).fill();
    ctx.doc.fillColor(C.ink).font('Helvetica').fontSize(8.8)
      .text(text, LEFT + 15, y, { width, lineGap: 3 });
    ctx.doc.y = y + h + 7;
  });
}

function callout(ctx, label, value, opts = {}) {
  const text = clean(value);
  if (!text) return;
  const innerW = CONTENT_WIDTH - 32;
  const bodyH = measure(ctx.doc, text, innerW, { font: opts.font || 'Times-Bold', size: opts.size || 10.3, lineGap: 4 });
  const boxH = Math.max(70, bodyH + 34);
  ensureSpace(ctx, boxH + 12);
  const y = ctx.doc.y;
  ctx.doc.roundedRect(LEFT, y, CONTENT_WIDTH, boxH, 5).fillAndStroke(opts.fill || C.sand, C.line);
  ctx.doc.rect(LEFT, y, 4, boxH).fill(C.goldDeep);
  ctx.doc.fillColor(C.goldDeep).font('Helvetica-Bold').fontSize(6.6)
    .text(clean(label).toUpperCase(), LEFT + 17, y + 11, { width: innerW, characterSpacing: 0.6 });
  ctx.doc.fillColor(C.ink).font(opts.font || 'Times-Bold').fontSize(opts.size || 10.3)
    .text(text, LEFT + 17, y + 27, { width: innerW, lineGap: 4 });
  ctx.doc.y = y + boxH + 12;
}

function confidence(ctx, value) {
  const text = clean(value);
  if (!text) return;
  const bodyW = CONTENT_WIDTH - 122;
  const h = Math.max(42, measure(ctx.doc, text, bodyW, { size: 8.1, lineGap: 2.5 }) + 18);
  ensureSpace(ctx, h + 10);
  const y = ctx.doc.y;
  ctx.doc.roundedRect(LEFT, y, CONTENT_WIDTH, h, 4).fillAndStroke(C.sandDeep, C.line);
  ctx.doc.fillColor(C.goldDeep).font('Helvetica-Bold').fontSize(6.6).text('CONFIDENCE', LEFT + 14, y + 13);
  ctx.doc.fillColor(C.ink).font('Helvetica').fontSize(8.1).text(text, LEFT + 102, y + 10, { width: bodyW, lineGap: 2.5 });
  ctx.doc.y = y + h + 10;
}

function cellHeight(doc, text, width, size, lineGap = 2) {
  doc.font('Helvetica').fontSize(size);
  return doc.heightOfString(clean(text), { width: width - 12, lineGap });
}

function table(ctx, columns, rows, opts = {}) {
  const size = opts.size || 7.4;
  const headerH = opts.headerHeight || 26;
  const lineGap = opts.lineGap == null ? 2 : opts.lineGap;

  function drawHeader() {
    ensureSpace(ctx, headerH + 20);
    const y = ctx.doc.y;
    let x = LEFT;
    columns.forEach(col => {
      ctx.doc.rect(x, y, col.width, headerH).fillAndStroke(C.goldDeep, C.goldDeep);
      ctx.doc.fillColor(C.white).font('Helvetica-Bold').fontSize(6.6)
        .text(col.label, x + 6, y + 8, { width: col.width - 12, align: col.align || 'left' });
      x += col.width;
    });
    ctx.doc.y = y + headerH;
  }

  drawHeader();
  list(rows).forEach((row, index) => {
    const values = columns.map(col => clean(typeof col.value === 'function' ? col.value(row) : row[col.key]));
    const heights = values.map((value, i) => cellHeight(ctx.doc, value, columns[i].width, size, lineGap));
    const rowH = Math.max(opts.minRowHeight || 31, ...heights.map(value => value + 14));
    if (remaining(ctx) < rowH) {
      addContentPage(ctx, ctx.sectionLabel);
      drawHeader();
    }
    const y = ctx.doc.y;
    let x = LEFT;
    columns.forEach((col, i) => {
      ctx.doc.rect(x, y, col.width, rowH).fillAndStroke(index % 2 ? C.sand : C.paperLight, C.line);
      ctx.doc.fillColor(C.ink).font('Helvetica').fontSize(size)
        .text(values[i], x + 6, y + 7, { width: col.width - 12, lineGap, align: col.align || 'left' });
      x += col.width;
    });
    ctx.doc.y = y + rowH;
  });
  ctx.doc.y += 14;
}

function drawContentsPlaceholder(ctx) {
  ctx.tocPage = addContentPage(ctx, 'Table of Contents') - 1;
}

function drawSummary(ctx, lead, report) {
  ctx.summaryPage = addContentPage(ctx, 'Your Report In One Page');
  const firstName = clean(lead.name).split(' ')[0] || 'Your';
  ctx.doc.fillColor(C.goldDeep).font('Helvetica-Bold').fontSize(7.4)
    .text('YOUR REPORT IN ONE PAGE', LEFT, ctx.doc.y, { characterSpacing: 0.7 });
  ctx.doc.y += 22;
  ctx.doc.fillColor(C.ink).font('Times-Bold').fontSize(22)
    .text(`The big picture, ${firstName}`, LEFT, ctx.doc.y, { width: CONTENT_WIDTH });
  ctx.doc.y += 13;

  callout(ctx, 'The strongest signal', report.glance?.headline_finding || 'The strongest themes in the report are shown below.');
  subheading(ctx, 'Seven-area pulse');

  const rows = LIFE_SECTIONS.map(([, title, key]) => {
    const area = report.life_areas?.[key] || {};
    return {
      area: title.replace(': Strengths And Weaknesses', '').replace(' And Constitution', '').replace(' And Partnership', '').replace(' Purchase', ''),
      insight: firstSentence(area.convergence || area.tension_or_silence || area.intro)
    };
  });

  table(ctx, [
    { label: 'AREA', key: 'area', width: 105 },
    { label: 'WHAT TO NOTICE', key: 'insight', width: CONTENT_WIDTH - 105 }
  ], rows, { size: 7.2, minRowHeight: 27, headerHeight: 24, lineGap: 1.8 });

  const timing = list(report.timing_map)[0];
  if (timing) {
    callout(ctx, 'Your current chapter', `${clean(timing.period)}: ${clean(timing.combined_reading || timing.astrology || timing.numerology)}`, { font: 'Helvetica', size: 8.4, fill: C.paperLight });
  }

  const concern = clean(lead.question);
  paragraph(ctx, concern
    ? `Your main concern is "${concern}". The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.`
    : 'The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.',
  { font: 'Times-Italic', size: 10, lineGap: 4, after: 0 });
}

function renderPrimer(ctx, report) {
  sectionStart(ctx, '01', 'How To Read This Report');
  const primer = report.primer || {};
  paragraph(ctx, primer.purpose, { font: 'Times-Roman', size: 10.7, lineGap: 4, after: 14 });
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
    ctx.doc.fillColor(C.goldDeep).font('Times-Bold').fontSize(18).text(number, LEFT, y, { width: 32 });
    ctx.doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10).text(title, LEFT + 42, y + 2, { width: CONTENT_WIDTH - 42 });
    ctx.doc.y = y + 22;
    paragraph(ctx, body, { x: LEFT + 42, width: CONTENT_WIDTH - 42, size: 8.8, after: 9 });
  });

  callout(ctx, 'The convergence method', primer.convergence_method, { font: 'Helvetica', size: 8.7 });
  subheading(ctx, 'What this report will not do');
  bulletList(ctx, primer.limits);
  paragraph(ctx, primer.disclaimer, { font: 'Times-Italic', size: 8.8 });
}

function renderGlance(ctx, report) {
  sectionStart(ctx, '02', 'Your Chart And Numbers At A Glance');
  const glance = report.glance || {};
  subheading(ctx, 'The astrological layer');
  table(ctx, [
    { label: 'ELEMENT', key: 'element', width: 90 },
    { label: 'POSITION / SIGNAL', key: 'position', width: 115 },
    { label: 'PLAIN MEANING', key: 'plain_meaning', width: CONTENT_WIDTH - 205 }
  ], glance.astrology || [], { size: 7.3, minRowHeight: 32 });

  subheading(ctx, 'The numerological layer');
  table(ctx, [
    { label: 'NUMBER', key: 'label', width: 110 },
    { label: 'VALUE', key: 'value', width: 55, align: 'center' },
    { label: 'PLAIN MEANING', key: 'plain_meaning', width: CONTENT_WIDTH - 165 }
  ], glance.numerology || [], { size: 7.2, minRowHeight: 31 });
  callout(ctx, 'The headline finding', glance.headline_finding);
}

function renderLifeArea(ctx, number, title, area = {}) {
  sectionStart(ctx, number, title);
  paragraph(ctx, area.intro, { font: 'Times-Roman', size: 10.7, lineGap: 4, after: 14 });
  subheading(ctx, 'What your birth chart shows');
  paragraph(ctx, area.birth_chart);
  subheading(ctx, 'What your numbers show');
  paragraph(ctx, area.numbers);
  callout(ctx, 'Where the two systems agree', area.convergence);
  subheading(ctx, 'Where the picture is mixed');
  paragraph(ctx, area.tension_or_silence);
  subheading(ctx, 'Timing');
  if (list(area.timing).length) bulletList(ctx, area.timing);
  else paragraph(ctx, 'No timing claim is made because the verified data does not support one.');
  subheading(ctx, 'What to actually do about it');
  bulletList(ctx, area.actions);
  confidence(ctx, area.confidence);
}

function renderRemedies(ctx, report) {
  sectionStart(ctx, '10', 'Remedies');
  const remedies = report.remedies || {};
  paragraph(ctx, remedies.intro, { font: 'Times-Roman', size: 10.7, lineGap: 4, after: 14 });
  subheading(ctx, 'Priority one: behavioural practices');
  list(remedies.behavioural).forEach((item, index) => {
    const body = [
      item.pattern && `Pattern: ${clean(item.pattern)}`,
      item.practice && `Practice: ${clean(item.practice)}`,
      item.rhythm && `Rhythm: ${clean(item.rhythm)}`,
      item.purpose && `Purpose: ${clean(item.purpose)}`
    ].filter(Boolean).join('  ');
    callout(ctx, `Practice ${String(index + 1).padStart(2, '0')}`, body, { font: 'Helvetica', size: 8.4, fill: C.paperLight });
  });
  subheading(ctx, 'Priority two: professional and structural');
  bulletList(ctx, remedies.professional_structural);
  subheading(ctx, 'Priority three: optional traditional observance');
  list(remedies.traditional_observance).forEach(item => {
    callout(ctx, item.planet || 'Optional observance', [clean(item.why), clean(item.observance)].filter(Boolean).join('  '), { font: 'Helvetica', size: 8.4 });
  });
  callout(ctx, 'Gemstones', remedies.gemstone_note || 'No gemstone is recommended in this report without a separate dedicated planetary-strength assessment.', { font: 'Helvetica', size: 8.5, fill: C.paperLight });
}

function renderTiming(ctx, report) {
  sectionStart(ctx, '11', 'Your Timing Map');
  table(ctx, [
    { label: 'PERIOD', key: 'period', width: 66 },
    { label: 'ASTROLOGY', key: 'astrology', width: 104 },
    { label: 'NUMEROLOGY', key: 'numerology', width: 93 },
    { label: 'COMBINED READING', key: 'combined_reading', width: CONTENT_WIDTH - 309 },
    { label: 'CONF.', key: 'confidence', width: 46 }
  ], report.timing_map || [], { size: 6.7, minRowHeight: 42, lineGap: 1.8 });

  if (report.major_shift?.period && report.major_shift?.reading) {
    callout(ctx, `Major shift: ${clean(report.major_shift.period)}`, `${clean(report.major_shift.reading)} ${clean(report.major_shift.confidence)}`, { font: 'Helvetica', size: 8.4 });
  }
}

function renderClosing(ctx, report) {
  sectionStart(ctx, '12', 'Closing Summary');
  list(report.closing_summary).forEach((point, index) => {
    ensureSpace(ctx, 52);
    const y = ctx.doc.y;
    ctx.doc.fillColor(C.goldDeep).font('Times-Bold').fontSize(20).text(String(index + 1).padStart(2, '0'), LEFT, y, { width: 36 });
    const width = CONTENT_WIDTH - 48;
    const h = measure(ctx.doc, point, width, { size: 9, lineGap: 3 });
    ctx.doc.fillColor(C.ink).font('Helvetica').fontSize(9).text(clean(point), LEFT + 48, y + 1, { width, lineGap: 3 });
    ctx.doc.y = y + Math.max(43, h + 10);
    ctx.doc.strokeColor(C.line).lineWidth(0.4).moveTo(LEFT + 48, ctx.doc.y).lineTo(A4[0] - RIGHT, ctx.doc.y).stroke();
    ctx.doc.y += 9;
  });
}

function renderLimitations(ctx, report) {
  sectionStart(ctx, '13', 'Scope And Limitations');
  bulletList(ctx, report.scope_limitations);
}

function fillContents(ctx) {
  ctx.doc.switchToPage(ctx.tocPage);
  drawChrome(ctx.doc, ctx, 'Table of Contents', ctx.tocPage + 1);
  ctx.doc.fillColor(C.goldDeep).font('Helvetica-Bold').fontSize(7.4).text('TABLE OF CONTENTS', LEFT, CONTENT_TOP, { characterSpacing: 0.4 });
  ctx.doc.fillColor(C.ink).font('Times-Bold').fontSize(22).text('Inside your Integrated Life Report', LEFT, CONTENT_TOP + 22, { width: CONTENT_WIDTH });

  const entries = [
    ['01', 'Your Report In One Page', ctx.summaryPage],
    ['02', 'How To Read This Report', ctx.sectionPages['How To Read This Report']],
    ['03', 'Your Chart And Numbers At A Glance', ctx.sectionPages['Your Chart And Numbers At A Glance']],
    ['04', 'Personal Nature: Strengths And Weaknesses', ctx.sectionPages['Personal Nature: Strengths And Weaknesses']],
    ['05', 'Past Life Karma', ctx.sectionPages['Past Life Karma']],
    ['06', 'Finances', ctx.sectionPages.Finances],
    ['07', 'Marriage And Partnership', ctx.sectionPages['Marriage And Partnership']],
    ['08', 'Health And Constitution', ctx.sectionPages['Health And Constitution']],
    ['09', 'Children', ctx.sectionPages.Children],
    ['10', 'Property Purchase', ctx.sectionPages['Property Purchase']],
    ['11', 'Remedies', ctx.sectionPages.Remedies],
    ['12', 'Your Timing Map', ctx.sectionPages['Your Timing Map']],
    ['13', 'Closing Summary', ctx.sectionPages['Closing Summary']],
    ['14', 'Scope And Limitations', ctx.sectionPages['Scope And Limitations']]
  ];

  let y = CONTENT_TOP + 58;
  entries.forEach(([number, title, page]) => {
    ctx.doc.fillColor(C.ink).font('Helvetica').fontSize(8.7).text(number, LEFT, y, { width: 25 });
    ctx.doc.fillColor(C.ink).font('Helvetica').fontSize(8.7).text(title, LEFT + 34, y, { width: 270, lineBreak: false, ellipsis: true });
    ctx.doc.strokeColor(C.goldSoft).lineWidth(0.45).dash(1.2, { space: 2.5 }).moveTo(304, y + 5).lineTo(510, y + 5).stroke().undash();
    ctx.doc.fillColor(C.goldDeep).font('Helvetica').fontSize(8.7).text(String(page || '').padStart(2, '0'), 520, y, { width: 30, align: 'right' });
    y += 31;
  });
}

function normalizeReport(reportJson) {
  if (!reportJson || typeof reportJson !== 'object') throw new Error('Final V4 PDF requires structured report JSON');
  return reportJson;
}

async function generateFinalPaidPdfV4({ lead = {}, reportJson = null }) {
  const report = normalizeReport(reportJson);
  const assets = loadAssets();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        autoFirstPage: false,
        bufferPages: true,
        compress: true,
        info: {
          Title: `Divya Bajaj - The Integrated Life Report - ${clean(lead.name)}`,
          Author: 'Divya Bajaj',
          Subject: 'Nadi Astrology + Vedic Numerology'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const ctx = {
        doc,
        assets,
        sectionLabel: 'The Integrated Life Report',
        tocPage: null,
        summaryPage: null,
        sectionPages: {}
      };

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

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateFinalPaidPdfV4, safeFileName };
