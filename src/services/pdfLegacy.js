const PDFDocument = require('pdfkit');

const COLORS = {
  dark: '#0B0A0D',
  darkSoft: '#151219',
  gold: '#C9A96E',
  goldLight: '#E8D09A',
  cream: '#F7F1E8',
  creamSoft: '#EFE5D5',
  ink: '#1B181C',
  muted: '#746B63',
  line: '#D7C5A3',
  green: '#2B8A63',
  white: '#FFFDF8'
};

const PAGE = {
  left: 54,
  right: 54,
  top: 76,
  bottom: 62
};

function safeText(value) {
  return String(value == null ? '' : value)
    .replace(/\r/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .trim();
}

function isPaidReport(report = {}) {
  return String(report.type || '').toLowerCase().includes('paid');
}

function cleanMarkdown(text) {
  return safeText(text)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\t/g, ' ');
}

function drawOrbitMark(doc, cx, cy, scale = 1) {
  doc.save();
  doc.lineWidth(1.2 * scale).strokeColor(COLORS.gold);
  doc.circle(cx, cy, 26 * scale).stroke();
  doc.ellipse(cx, cy, 34 * scale, 13 * scale).rotate(-24, { origin: [cx, cy] }).stroke();
  doc.ellipse(cx, cy, 33 * scale, 11 * scale).rotate(33, { origin: [cx, cy] }).stroke();
  doc.circle(cx, cy, 10 * scale).fill(COLORS.goldLight);
  doc.restore();
}

function paintCoverBackground(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.dark);
  doc.rect(0, 0, doc.page.width, 7).fill(COLORS.gold);
  doc.opacity(0.08).fillColor(COLORS.gold);
  doc.circle(doc.page.width - 20, 95, 180).fill();
  doc.circle(35, doc.page.height - 40, 145).fill();
  doc.opacity(1);
  doc.restore();
}

function paintContentBackground(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.cream);
  doc.rect(0, 0, doc.page.width, 5).fill(COLORS.gold);
  doc.strokeColor(COLORS.line).lineWidth(0.7)
    .moveTo(PAGE.left, 55)
    .lineTo(doc.page.width - PAGE.right, 55)
    .stroke();
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.2)
    .text('DIVYA BAJAJ', PAGE.left, 33, { characterSpacing: 1.8 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.8)
    .text('THE FULL BLUEPRINT', doc.page.width - PAGE.right - 150, 33, { width: 150, align: 'right', characterSpacing: 1.2 });
  doc.restore();
  doc.x = PAGE.left;
  doc.y = PAGE.top;
  doc.fillColor(COLORS.ink);
}

function ensureSpace(doc, needed = 90) {
  const bottom = doc.page.height - PAGE.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function drawInfoPill(doc, label, value, x, y, width) {
  doc.save();
  doc.roundedRect(x, y, width, 54, 4)
    .fillAndStroke('#17141A', '#3A3025');
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(7.2)
    .text(label.toUpperCase(), x + 12, y + 10, { width: width - 24, characterSpacing: 1.2 });
  doc.fillColor(COLORS.white).font('Helvetica').fontSize(10.5)
    .text(safeText(value) || '-', x + 12, y + 26, { width: width - 24, ellipsis: true });
  doc.restore();
}

function drawCoreCard(doc, label, value, x, y, width, height = 78) {
  doc.save();
  doc.roundedRect(x, y, width, height, 7)
    .fillAndStroke(COLORS.white, COLORS.line);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8)
    .text(label.toUpperCase(), x + 14, y + 13, { width: width - 28, characterSpacing: 1.1 });
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(28)
    .text(String(value || '-'), x + 14, y + 31, { width: width - 28 });
  doc.restore();
}

function drawCover(doc, { lead, numbers, paid }) {
  paintCoverBackground(doc);

  drawOrbitMark(doc, doc.page.width / 2, 105, 1.05);

  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(9)
    .text('DIVYA BAJAJ', 54, 158, { width: doc.page.width - 108, align: 'center', characterSpacing: 3.3 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
    .text('ASTRO - NUMEROLOGIST', 54, 177, { width: doc.page.width - 108, align: 'center', characterSpacing: 2.1 });

  doc.fillColor(COLORS.white).font('Times-Bold').fontSize(paid ? 34 : 31)
    .text(paid ? 'The Full Blueprint' : 'Your Numerology Report', 62, 226, { width: doc.page.width - 124, align: 'center' });
  doc.fillColor(COLORS.goldLight).font('Times-Italic').fontSize(15)
    .text(paid ? 'Astrology + Numerology Personal Report' : 'A personal numerology awareness report', 62, 275, { width: doc.page.width - 124, align: 'center' });

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.2)
    .text('PREPARED PERSONALLY FOR', 62, 344, { width: doc.page.width - 124, align: 'center', characterSpacing: 2.2 });
  doc.fillColor(COLORS.white).font('Times-Bold').fontSize(25)
    .text(safeText(lead.name) || 'Client', 62, 365, { width: doc.page.width - 124, align: 'center' });

  const cardX = 62;
  const gap = 10;
  const totalWidth = doc.page.width - 124;
  const cardWidth = (totalWidth - gap * 2) / 3;
  drawInfoPill(doc, 'Date of Birth', lead.dob, cardX, 430, cardWidth);
  drawInfoPill(doc, 'Time of Birth', lead.tob || 'Not provided', cardX + cardWidth + gap, 430, cardWidth);
  drawInfoPill(doc, 'Place of Birth', lead.pob || 'Not provided', cardX + (cardWidth + gap) * 2, 430, cardWidth);

  doc.save();
  doc.roundedRect(62, 522, totalWidth, 150, 9)
    .fillAndStroke('#121015', '#33291F');
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.2)
    .text('YOUR CORE NUMBERS', 82, 542, { characterSpacing: 1.9 });

  const items = [
    ['Ruling', numbers.ruling_number],
    ['Destiny', numbers.destiny_number],
    ['Name', numbers.name_number],
    ['Personal Year', numbers.personal_year]
  ];
  const itemW = (totalWidth - 40) / 4;
  items.forEach((item, index) => {
    const x = 82 + index * itemW;
    if (index) {
      doc.strokeColor('#2D261F').lineWidth(0.7)
        .moveTo(x - 8, 576).lineTo(x - 8, 642).stroke();
    }
    doc.fillColor(COLORS.white).font('Times-Bold').fontSize(25)
      .text(String(item[1] || '-'), x, 578, { width: itemW - 16, align: 'center' });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text(item[0].toUpperCase(), x, 616, { width: itemW - 16, align: 'center', characterSpacing: 0.8 });
  });
  doc.restore();

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
    .text('Private and personalised. Prepared for guidance, clarity and self-reflection.', 62, doc.page.height - 92, { width: doc.page.width - 124, align: 'center' });
}

function parseSections(reportText) {
  const raw = cleanMarkdown(reportText);
  const lines = raw.split('\n');
  const sections = [];
  let current = { title: 'Personal Reading', number: '', lines: [] };

  function pushCurrent() {
    const body = current.lines.join('\n').trim();
    if (body || current.title) sections.push({ ...current, body });
  }

  lines.forEach(sourceLine => {
    const line = sourceLine.trim();
    if (!line) {
      if (current.lines.length && current.lines[current.lines.length - 1] !== '') current.lines.push('');
      return;
    }

    const numbered = line.match(/^(\d{1,2})[.)]\s+(.{3,120})$/);
    const strongHeading = line.match(/^(?:section\s+)?([A-Z][A-Za-z0-9 &'()+\-/]{3,90})$/);
    const looksLikeHeading = numbered || (
      line.length <= 78 &&
      !/[.!?]$/.test(line) &&
      !/^[-*•]/.test(line) &&
      strongHeading &&
      /(?:Summary|Opening|Overview|Reading|Pattern|Direction|Guidance|Numbers|Lessons|Strengths|Career|Money|Relationship|Marriage|Family|Health|Current|Months|Years|Correction|Business|Mobile|House|Gemstone|Remedy|Action|Consultation|Step|Blueprint|Nature|Triggers|Professions)/i.test(line)
    );

    if (looksLikeHeading) {
      pushCurrent();
      current = {
        title: numbered ? numbered[2] : line,
        number: numbered ? numbered[1] : '',
        lines: []
      };
      return;
    }

    current.lines.push(line);
  });

  pushCurrent();
  return sections.filter(section => section.body || section.title !== 'Personal Reading');
}

function drawIntroPage(doc, { lead, numbers, reportText, paid }) {
  doc.addPage();
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.5)
    .text('YOUR REPORT AT A GLANCE', { characterSpacing: 1.7 });
  doc.moveDown(0.55);
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(28)
    .text(`Hello ${safeText(lead.name).split(' ')[0] || 'there'}, this is your personal blueprint.`);
  doc.moveDown(0.55);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10.5).lineGap(4)
    .text(paid
      ? 'This report brings your numerology patterns and birth-detail based astrology guidance into one clear, practical reading. It is designed to help you understand your natural strengths, repeated challenges, current phase and the decisions that deserve your attention.'
      : 'This report gives you a clear first view of your numerology patterns, natural strengths and current phase.');

  doc.moveDown(1.25);
  const usable = doc.page.width - PAGE.left - PAGE.right;
  const gap = 12;
  const w = (usable - gap) / 2;
  const y = doc.y;
  drawCoreCard(doc, 'Ruling Number', numbers.ruling_number, PAGE.left, y, w);
  drawCoreCard(doc, 'Destiny Number', numbers.destiny_number, PAGE.left + w + gap, y, w);
  drawCoreCard(doc, 'Name Number', numbers.name_number, PAGE.left, y + 92, w);
  drawCoreCard(doc, 'Personal Year', numbers.personal_year, PAGE.left + w + gap, y + 92, w);
  doc.y = y + 190;

  const missing = numbers.lo_shu_grid?.missing || [];
  const repeated = numbers.lo_shu_grid?.repeated || [];
  const snapshotY = doc.y;
  doc.save();
  doc.roundedRect(PAGE.left, snapshotY, usable, 116, 7)
    .fillAndStroke(COLORS.creamSoft, COLORS.line);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8)
    .text('NUMEROLOGY PATTERN SNAPSHOT', PAGE.left + 16, snapshotY + 15, { characterSpacing: 1.3 });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10.5)
    .text('Missing numbers', PAGE.left + 16, snapshotY + 43, { width: usable / 2 - 28 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.5)
    .text(missing.length ? missing.join(', ') : 'No major missing number pattern', PAGE.left + 16, snapshotY + 65, { width: usable / 2 - 28 });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10.5)
    .text('Repeated numbers', PAGE.left + usable / 2, snapshotY + 43, { width: usable / 2 - 20 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.5)
    .text(repeated.length ? repeated.map(item => `${item.number} x${item.count}`).join(', ') : 'No repeated number pattern', PAGE.left + usable / 2, snapshotY + 65, { width: usable / 2 - 20 });
  doc.restore();
  doc.x = PAGE.left;
  doc.y = snapshotY + 136;

  const wordCount = safeText(reportText).split(/\s+/).filter(Boolean).length;
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8)
    .text('REPORT DEPTH', { characterSpacing: 1.3 });
  doc.moveDown(0.4);
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(18)
    .text(`${wordCount.toLocaleString('en-IN')} words of personalised guidance`);
  doc.moveDown(0.3);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.5)
    .text('Read slowly. Highlight what feels accurate. Return to the action points after a few days with a calmer mind.');
}

function drawContentsPage(doc, sections) {
  doc.addPage();
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.5)
    .text('REPORT MAP', { characterSpacing: 1.7 });
  doc.moveDown(0.55);
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(28).text('What you will discover');
  doc.moveDown(0.7);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).lineGap(3)
    .text('This is a long report, but it is intentionally broken into focused sections. You can read it from start to finish or return directly to the area you need.');
  doc.moveDown(1);

  sections.slice(0, 30).forEach((section, index) => {
    ensureSpace(doc, 34);
    const num = section.number || String(index + 1).padStart(2, '0');
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8.5)
      .text(num, PAGE.left, doc.y + 1, { width: 28 });
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10.3)
      .text(section.title, PAGE.left + 34, doc.y, { width: doc.page.width - PAGE.left - PAGE.right - 34 });
    doc.moveDown(0.35);
    doc.strokeColor(COLORS.line).lineWidth(0.5)
      .moveTo(PAGE.left + 34, doc.y)
      .lineTo(doc.page.width - PAGE.right, doc.y)
      .stroke();
    doc.moveDown(0.45);
  });
}

function drawSectionTitle(doc, section, index) {
  ensureSpace(doc, 100);
  const number = section.number || String(index + 1).padStart(2, '0');
  doc.save();
  doc.roundedRect(PAGE.left, doc.y, 38, 25, 12).fill(COLORS.gold);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(8.5)
    .text(number, PAGE.left, doc.y + 8, { width: 38, align: 'center' });
  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(20)
    .text(section.title, PAGE.left + 50, doc.y + 1, { width: doc.page.width - PAGE.left - PAGE.right - 50 });
  doc.restore();
  doc.y += 38;
  doc.strokeColor(COLORS.line).lineWidth(0.8)
    .moveTo(PAGE.left, doc.y)
    .lineTo(doc.page.width - PAGE.right, doc.y)
    .stroke();
  doc.y += 15;
}

function drawBullet(doc, text) {
  ensureSpace(doc, 38);
  const y = doc.y;
  doc.save();
  doc.circle(PAGE.left + 5, y + 5, 2.4).fill(COLORS.gold);
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10.2).lineGap(3.2)
    .text(text, PAGE.left + 16, y, { width: doc.page.width - PAGE.left - PAGE.right - 16 });
  doc.restore();
  doc.moveDown(0.35);
}

function drawCallout(doc, title, body) {
  const width = doc.page.width - PAGE.left - PAGE.right;
  const bodyHeight = doc.heightOfString(body, { width: width - 30, lineGap: 3.5 });
  const boxHeight = Math.max(76, bodyHeight + 45);
  ensureSpace(doc, boxHeight + 18);
  const y = doc.y;
  doc.save();
  doc.roundedRect(PAGE.left, y, width, boxHeight, 7)
    .fillAndStroke(COLORS.creamSoft, COLORS.line);
  doc.rect(PAGE.left, y, 5, boxHeight).fill(COLORS.gold);
  doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8)
    .text(title.toUpperCase(), PAGE.left + 18, y + 14, { characterSpacing: 1.1 });
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.8).lineGap(3.5)
    .text(body, PAGE.left + 18, y + 31, { width: width - 32 });
  doc.restore();
  doc.y = y + boxHeight + 14;
}

function renderSectionBody(doc, body) {
  const lines = safeText(body).split('\n');
  let paragraph = [];

  function flushParagraph() {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    paragraph = [];
    if (!text) return;

    const calloutMatch = text.match(/^(Key takeaway|Divya's guidance|Divya's note|Important|Practical advice|Action point)\s*:\s*(.+)$/i);
    if (calloutMatch) {
      drawCallout(doc, calloutMatch[1], calloutMatch[2]);
      return;
    }

    ensureSpace(doc, 58);
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10.15).lineGap(4.1)
      .text(text, { width: doc.page.width - PAGE.left - PAGE.right, align: 'left' });
    doc.moveDown(0.55);
  }

  lines.forEach(line => {
    const cleaned = line.trim();
    if (!cleaned) {
      flushParagraph();
      return;
    }

    if (/^[-*•]\s+/.test(cleaned)) {
      flushParagraph();
      drawBullet(doc, cleaned.replace(/^[-*•]\s+/, ''));
      return;
    }

    const subheading = cleaned.match(/^([A-Za-z][A-Za-z0-9 &'()+\-/]{2,65}):$/);
    if (subheading) {
      flushParagraph();
      ensureSpace(doc, 48);
      doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(10)
        .text(subheading[1].toUpperCase(), { characterSpacing: 0.7 });
      doc.moveDown(0.35);
      return;
    }

    paragraph.push(cleaned);
  });

  flushParagraph();
}

function drawDisclaimer(doc, paid) {
  ensureSpace(doc, 115);
  drawCallout(
    doc,
    'Important note',
    paid
      ? 'This report is for guidance and self-reflection. Astrology and numerology are interpretive systems. Health guidance is limited to routine and wellbeing awareness and does not replace medical advice. Financial, legal and relationship decisions should be made using professional advice and your real-life circumstances.'
      : 'This report is for guidance and self-reflection and should not replace professional medical, legal, financial or mental health advice.'
  );
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    if (i === 0) continue;
    const pageNumber = i;
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save();
    doc.strokeColor(COLORS.line).lineWidth(0.55)
      .moveTo(PAGE.left, doc.page.height - 43)
      .lineTo(doc.page.width - PAGE.right, doc.page.height - 43)
      .stroke();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text('PRIVATE PERSONAL REPORT', PAGE.left, doc.page.height - 33, { characterSpacing: 1, lineBreak: false });
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8)
      .text(String(pageNumber).padStart(2, '0'), doc.page.width - PAGE.right - 36, doc.page.height - 33, { width: 36, align: 'right', lineBreak: false });
    doc.restore();
    doc.page.margins.bottom = oldBottomMargin;
  }
}

function generateReportPdf({ lead = {}, report = {}, numbers = {}, astrologyData = null, reportText = '' }) {
  return new Promise((resolve, reject) => {
    try {
      const paid = isPaidReport(report);
      let pageTheme = 'cover';
      const doc = new PDFDocument({
        size: 'A4',
        margins: PAGE,
        bufferPages: true,
        info: {
          Title: paid ? 'Divya Bajaj - The Full Blueprint' : 'Divya Bajaj - Numerology Report',
          Author: 'Divya Bajaj',
          Subject: paid ? 'Astrology and Numerology Full Blueprint' : 'Numerology Awareness Report'
        }
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.on('pageAdded', () => {
        if (pageTheme === 'content') paintContentBackground(doc);
        else paintCoverBackground(doc);
      });

      drawCover(doc, { lead, numbers, paid });

      pageTheme = 'content';
      const sections = parseSections(reportText);
      drawIntroPage(doc, { lead, numbers, reportText, paid });
      if (sections.length > 4) {
        drawContentsPage(doc, sections);
        doc.addPage();
      }

      sections.forEach((section, index) => {
        if (index > 0 && doc.y > doc.page.height - 180) doc.addPage();
        drawSectionTitle(doc, section, index);
        renderSectionBody(doc, section.body);
        doc.moveDown(0.75);
      });

      if (astrologyData && paid) {
        drawCallout(
          doc,
          'Astrology data note',
          safeText(astrologyData.note) || 'This test report uses the submitted birth details. Exact chart-level planetary calculations should be connected before the paid report is sold publicly.'
        );
      }

      drawDisclaimer(doc, paid);
      addFooters(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateReportPdf };
