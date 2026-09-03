const fs = require('fs');
const path = require('path');

const ASSET_DIR = path.join(process.cwd(), 'public', 'report-html-assets');

const META = {
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

const LIFE = [
  ['03', 'Personal Nature: Strengths And Weaknesses', 'personal_nature'],
  ['04', 'Past Life Karma', 'past_life_karma'],
  ['05', 'Finances', 'finances'],
  ['06', 'Marriage And Partnership', 'marriage'],
  ['07', 'Health And Constitution', 'health'],
  ['08', 'Children', 'children'],
  ['09', 'Property Purchase', 'property']
];

function clean(value) {
  return String(value == null ? '' : value).replace(/\r/g, '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
}

function esc(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function dataUrl(file, mime) {
  const filePath = path.join(ASSET_DIR, file);
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function assetData() {
  return {
    cover: dataUrl('cover-master.jpg', 'image/jpeg'),
    logo: dataUrl('divya-logo.webp', 'image/webp'),
    portrait: dataUrl('divya-portrait.webp', 'image/webp')
  };
}

function dob(value) {
  const m = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : clean(value);
}

function tob(value) {
  const m = clean(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return clean(value);
  let h = Number(m[1]);
  const ap = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (!h) h = 12;
  return `${h}:${m[2]} ${ap}`;
}

function firstSentence(value, max = 178) {
  const text = clean(value);
  const match = text.match(/^(.{1,260}?[.!?])(?:\s|$)/);
  const sentence = match ? match[1] : text;
  return sentence.length > max ? `${sentence.slice(0, max - 3).trim()}...` : sentence;
}

function block(html, section, extra = '') {
  return `<div class="flow-block ${extra}" data-section-label="${esc(section)}">${html}</div>`;
}

function sectionHeader(number, title) {
  return block(`
    <div class="section-number">${esc(number)}</div>
    <h2 class="section-title">${esc(title)}</h2>
    <div class="section-meta">${esc(META[title] || '')}</div>
    <div class="section-rule"></div>
  `, title, 'section-head keep-next');
}

function para(text, section, extra = '') {
  if (!clean(text)) return '';
  return block(`<p class="copy ${extra}">${esc(text)}</p>`, section);
}

function sub(title, section) {
  return block(`<h3 class="subhead">${esc(title)}</h3>`, section, 'subhead-block keep-next');
}

function bullets(items, section) {
  return list(items).map(item => block(`<div class="bullet"><span></span><p>${esc(typeof item === 'string' ? item : JSON.stringify(item))}</p></div>`, section)).join('');
}

function callout(label, text, section, extra = '') {
  if (!clean(text)) return '';
  return block(`<div class="callout ${extra}"><div class="callout-label">${esc(label)}</div><div class="callout-copy">${esc(text)}</div></div>`, section, 'keep-together');
}

function confidence(text, section) {
  if (!clean(text)) return '';
  return block(`<div class="confidence"><div class="confidence-label">CONFIDENCE</div><div>${esc(text)}</div></div>`, section, 'keep-together');
}

function tableBlocks({ section, id, columns, rows, className = '' }) {
  const template = columns.map(col => col.width || '1fr').join(' ');
  const header = block(`<div class="report-table header ${className}" data-table-header="${esc(id)}" style="grid-template-columns:${template}">${columns.map(c => `<div>${esc(c.label)}</div>`).join('')}</div>`, section, 'table-header keep-next');
  const body = list(rows).map(row => block(`<div class="report-table row ${className}" data-table-row="${esc(id)}" style="grid-template-columns:${template}">${columns.map(c => `<div class="${c.align === 'center' ? 'center' : ''}">${esc(row[c.key])}</div>`).join('')}</div>`, section, 'table-row keep-together')).join('');
  return header + body;
}

function renderPrimer(report) {
  const s = 'How To Read This Report';
  const p = report.primer || {};
  const ideas = p.four_ideas || {};
  let html = sectionHeader('01', s);
  html += para(p.purpose, s, 'lead-copy');
  html += sub('The two systems used in your report', s);
  html += para(p.systems, s);
  html += sub('The four ideas you need', s);
  [
    ['01', 'Houses are life departments', ideas.houses],
    ['02', 'Planets are the officers in charge', ideas.planets],
    ['03', 'Dasha is whose turn it is', ideas.dasha],
    ['04', 'The chain of command', ideas.chain_of_command]
  ].forEach(([n, title, body]) => {
    html += block(`<div class="idea"><div class="idea-no">${n}</div><div><h4>${esc(title)}</h4><p>${esc(body)}</p></div></div>`, s, 'keep-together');
  });
  html += callout('Convergence method', p.convergence_method, s);
  html += sub('What this report will not do', s);
  html += bullets(p.limits, s);
  html += para(p.disclaimer, s, 'italic');
  return html;
}

function renderGlance(report) {
  const s = 'Your Chart And Numbers At A Glance';
  const g = report.glance || {};
  let html = sectionHeader('02', s);
  html += tableBlocks({
    section: s,
    id: 'astro-glance',
    columns: [
      { label: 'ELEMENT', key: 'element', width: '18%' },
      { label: 'POSITION / SIGNAL', key: 'position', width: '28%' },
      { label: 'PLAIN MEANING', key: 'plain_meaning', width: '54%' }
    ],
    rows: g.astrology
  });
  html += block('<div class="table-gap"></div>', s);
  html += tableBlocks({
    section: s,
    id: 'numero-glance',
    columns: [
      { label: 'NUMBER', key: 'label', width: '21%' },
      { label: 'VALUE', key: 'value', width: '9%', align: 'center' },
      { label: 'PLAIN MEANING', key: 'plain_meaning', width: '70%' }
    ],
    rows: g.numerology
  });
  html += callout('The headline finding', g.headline_finding, s, 'strong');
  return html;
}

function renderLife(number, title, area = {}) {
  let html = sectionHeader(number, title);
  html += para(area.intro, title, 'lead-copy');
  html += sub('What your birth chart shows', title);
  html += para(area.birth_chart, title);
  html += sub('What your numbers show', title);
  html += para(area.numbers, title);
  html += callout('Where the two systems agree', area.convergence, title, 'strong');
  html += sub('Where the picture is mixed', title);
  html += para(area.tension_or_silence, title);
  html += sub('Timing', title);
  html += list(area.timing).length ? bullets(area.timing, title) : para('No timing claim is made because the verified data does not support one.', title);
  html += sub('What to actually do about it', title);
  html += bullets(area.actions, title);
  html += confidence(area.confidence, title);
  return html;
}

function renderRemedies(report) {
  const s = 'Remedies';
  const r = report.remedies || {};
  let html = sectionHeader('10', s);
  html += para(r.intro, s, 'lead-copy');
  html += sub('Priority one: behavioural practices', s);
  list(r.behavioural).forEach((item, i) => {
    const body = [
      item.pattern && `Pattern: ${clean(item.pattern)}`,
      item.practice && `Practice: ${clean(item.practice)}`,
      item.rhythm && `Rhythm: ${clean(item.rhythm)}`,
      item.purpose && `Purpose: ${clean(item.purpose)}`
    ].filter(Boolean).join('  ');
    html += callout(`Practice ${String(i + 1).padStart(2, '0')}`, body, s, 'practice');
  });
  html += sub('Priority two: professional and structural', s);
  html += bullets(r.professional_structural, s);
  html += sub('Priority three: optional traditional observance', s);
  list(r.traditional_observance).forEach(item => {
    html += callout(item.planet || 'Optional observance', [clean(item.why), clean(item.observance)].filter(Boolean).join('  '), s, 'practice');
  });
  html += callout('Gemstones', r.gemstone_note || 'No gemstone is recommended in this report without a separate dedicated planetary-strength assessment.', s, 'practice');
  return html;
}

function renderTiming(report) {
  const s = 'Your Timing Map';
  let html = sectionHeader('11', s);
  html += tableBlocks({
    section: s,
    id: 'timing-map',
    className: 'timing-table',
    columns: [
      { label: 'PERIOD', key: 'period', width: '10%' },
      { label: 'ASTROLOGY', key: 'astrology', width: '22%' },
      { label: 'NUMEROLOGY', key: 'numerology', width: '18%' },
      { label: 'COMBINED READING', key: 'combined_reading', width: '38%' },
      { label: 'CONF.', key: 'confidence', width: '12%' }
    ],
    rows: report.timing_map
  });
  if (report.major_shift?.period && report.major_shift?.reading) {
    html += callout(`Major shift: ${report.major_shift.period}`, `${clean(report.major_shift.reading)} ${clean(report.major_shift.confidence)}`, s);
  }
  return html;
}

function renderClosing(report) {
  const s = 'Closing Summary';
  let html = sectionHeader('12', s);
  list(report.closing_summary).forEach((point, i) => {
    html += block(`<div class="closing-point"><div class="closing-no">${String(i + 1).padStart(2, '0')}</div><div>${esc(point)}</div></div>`, s, 'keep-together');
  });
  return html;
}

function renderLimitations(report) {
  const s = 'Scope And Limitations';
  let html = sectionHeader('13', s);
  html += bullets(report.scope_limitations, s);
  return html;
}

function summaryPage(lead, report) {
  const first = esc(clean(lead.name).split(' ')[0] || 'Your');
  const pulse = LIFE.map(([, title, key]) => {
    const area = report.life_areas?.[key] || {};
    return `<div class="pulse-row"><div>${esc(title.replace(': Strengths And Weaknesses', '').replace(' And Constitution', '').replace(' And Partnership', '').replace(' Purchase', ''))}</div><div>${esc(firstSentence(area.convergence || area.tension_or_silence || area.intro))}</div></div>`;
  }).join('');
  const timing = list(report.timing_map)[0];
  return `
    <div class="summary-kicker">YOUR REPORT IN ONE PAGE</div>
    <h1 class="summary-title">The big picture, ${first}</h1>
    <div class="summary-callout"><div class="callout-label">THE STRONGEST SIGNAL</div><div>${esc(report.glance?.headline_finding || '')}</div></div>
    <div class="summary-subhead">Seven-area pulse</div>
    <div class="pulse-table"><div class="pulse-head"><div>AREA</div><div>WHAT TO NOTICE</div></div>${pulse}</div>
    ${timing ? `<div class="summary-callout current"><div class="callout-label">YOUR CURRENT CHAPTER</div><div>${esc(`${clean(timing.period)}: ${clean(timing.combined_reading || timing.astrology || timing.numerology)}`)}</div></div>` : ''}
    <p class="summary-concern">${lead.question ? `Your main concern is &quot;${esc(lead.question)}&quot;. ` : ''}The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.</p>
  `;
}

function tocEntries() {
  return [
    ['00', 'Your Report In One Page', 'summary'],
    ['01', 'How To Read This Report', 'How To Read This Report'],
    ['02', 'Your Chart And Numbers At A Glance', 'Your Chart And Numbers At A Glance'],
    ['03', 'Personal Nature: Strengths And Weaknesses', 'Personal Nature: Strengths And Weaknesses'],
    ['04', 'Past Life Karma', 'Past Life Karma'],
    ['05', 'Finances', 'Finances'],
    ['06', 'Marriage And Partnership', 'Marriage And Partnership'],
    ['07', 'Health And Constitution', 'Health And Constitution'],
    ['08', 'Children', 'Children'],
    ['09', 'Property Purchase', 'Property Purchase'],
    ['10', 'Remedies', 'Remedies'],
    ['11', 'Your Timing Map', 'Your Timing Map'],
    ['12', 'Closing Summary', 'Closing Summary'],
    ['13', 'Scope And Limitations', 'Scope And Limitations']
  ].map(([n, title, target]) => `<div class="toc-row"><div class="toc-no">${n}</div><div class="toc-title">${esc(title)}</div><div class="toc-dots"></div><div class="toc-page" data-toc-target="${esc(target)}"></div></div>`).join('');
}

function fixedChrome({ label, portrait, logo, pageNumber = '', body, extraClass = '' }) {
  return `<section class="report-page content-page fixed-page ${extraClass}" data-page-label="${esc(label)}">
    <header class="page-header"><img src="${logo}" alt="Divya Bajaj"><div class="page-label">${esc(label)}</div><div class="header-rule"></div></header>
    <main class="page-content fixed-content">${body}</main>
    <footer class="page-footer"><div class="footer-rule"></div><div class="footer-copy">DIVYA BAJAJ&nbsp;&nbsp;|&nbsp;&nbsp;PRIVATE PERSONAL REPORT</div><div class="page-number">${pageNumber}</div><img class="footer-portrait" src="${portrait}" alt="Divya Bajaj"></footer>
  </section>`;
}

function styles() {
  return `
    :root{--paper:#fff8ee;--paper2:#fffaf3;--gold:#b7873d;--gold2:#a9772e;--goldsoft:#d8bb87;--ink:#201b17;--muted:#776958;--sand:#f6ead7;--line:#cda866;--page-w:210mm;--page-h:297mm;--content-left:16mm;--content-right:16mm;--content-top:47mm;--content-bottom:49mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#efe9df;color:var(--ink);font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body.print-mode{background:#fff}
    .report-shell{padding:24px 0 60px}
    .report-toolbar{position:sticky;top:14px;z-index:50;width:min(210mm,calc(100% - 24px));margin:0 auto 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;background:rgba(28,23,18,.94);color:#fff;border:1px solid rgba(183,135,61,.35);box-shadow:0 10px 30px rgba(0,0,0,.18)}
    .toolbar-title{font:600 13px/1.3 Arial,sans-serif}.toolbar-actions{display:flex;gap:8px;flex-wrap:wrap}.toolbar-actions a{display:inline-block;padding:9px 13px;text-decoration:none;text-transform:uppercase;letter-spacing:1.1px;font-size:9px;font-weight:800;border:1px solid #d0ad6d;color:#f8ead1}.toolbar-actions a.primary{background:#d2b274;color:#16110c}
    .report-page{position:relative;width:var(--page-w);height:var(--page-h);margin:0 auto 18px;background:var(--paper);overflow:hidden;box-shadow:0 10px 34px rgba(35,27,17,.18);page-break-after:always;break-after:page}
    .cover-page{background-position:center;background-size:100% 100%;background-repeat:no-repeat}
    .cover-name{position:absolute;left:23.2mm;top:181.5mm;width:68mm;font-family:Georgia,'Times New Roman',serif;font-size:6.1mm;line-height:1;color:#191714}
    .cover-field{position:absolute;left:38.1mm;width:44mm;height:9mm;display:flex;align-items:center;padding:0 1.2mm 1.7mm;font-size:2.7mm;font-weight:500;border-bottom:.25mm solid #c9a463;background:rgba(255,250,243,.90)}
    .cover-dob{top:198.6mm}.cover-tob{top:215.1mm}.cover-pob{top:231.6mm;width:49mm}
    .page-header{position:absolute;left:16mm;right:16mm;top:5.4mm;height:35.5mm}
    .page-header img{position:absolute;left:50%;top:0;width:35.6mm;height:28.7mm;object-fit:contain;transform:translateX(-50%)}
    .page-label{position:absolute;right:0;bottom:3mm;width:48mm;text-align:right;text-transform:uppercase;letter-spacing:.3mm;font-size:1.65mm;color:#5d5042;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .header-rule{position:absolute;left:0;right:0;bottom:0;border-top:.22mm solid var(--line)}
    .page-content{position:absolute;left:var(--content-left);right:var(--content-right);top:var(--content-top);bottom:var(--content-bottom);overflow:hidden}
    .page-footer{position:absolute;inset:0;pointer-events:none}
    .footer-rule{position:absolute;left:16mm;right:48mm;top:274.6mm;border-top:.22mm solid var(--line)}
    .footer-copy{position:absolute;left:16mm;bottom:12.4mm;font-size:1.65mm;letter-spacing:.08mm;color:#4c4034}
    .page-number{position:absolute;right:51mm;bottom:12.2mm;width:12mm;text-align:right;font-size:2mm;font-weight:700;color:var(--gold2)}
    .footer-portrait{position:absolute;right:0;bottom:0;width:45mm;height:45mm;object-fit:contain;object-position:right bottom}
    .fixed-content{overflow:hidden}
    .toc-kicker,.summary-kicker{color:var(--gold2);font-size:2.05mm;font-weight:800;letter-spacing:.42mm;text-transform:uppercase;margin-bottom:4.5mm}
    .toc-heading,.summary-title{font-family:Georgia,'Times New Roman',serif;font-weight:600;color:var(--ink);margin:0}.toc-heading{font-size:7.4mm;margin-bottom:8.2mm}.summary-title{font-size:8.1mm;margin-bottom:5mm}
    .toc-row{height:10.6mm;display:grid;grid-template-columns:10mm auto 1fr 9mm;align-items:center;column-gap:2mm;font-size:2.45mm}.toc-no{color:var(--gold2);font-weight:800}.toc-title{white-space:nowrap}.toc-dots{height:1px;border-bottom:.25mm dotted #b89762;align-self:center}.toc-page{text-align:right;color:var(--gold2);font-weight:800}
    .summary-callout,.callout{border:.23mm solid #d9bd8c;background:#f8eddc;border-left:1.2mm solid var(--gold);border-radius:1.2mm}.summary-callout{padding:3.2mm 4mm;margin-bottom:4mm;font-family:Georgia,'Times New Roman',serif;font-size:2.65mm;line-height:1.45}.summary-callout.current{font-family:Arial,Helvetica,sans-serif}.callout-label{font-family:Arial,Helvetica,sans-serif;color:var(--gold2);font-size:1.75mm;font-weight:800;letter-spacing:.28mm;margin-bottom:1.4mm;text-transform:uppercase}.summary-subhead{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:4mm;margin:3mm 0 2mm}.pulse-table{border:.22mm solid #d7bb8b;margin-bottom:4mm}.pulse-head,.pulse-row{display:grid;grid-template-columns:28% 72%}.pulse-head>div{padding:2.2mm;background:var(--gold);color:#fff;font-size:1.75mm;font-weight:800;letter-spacing:.18mm}.pulse-row>div{padding:2.1mm;border-top:.18mm solid #e0cba9;font-size:2mm;line-height:1.32}.pulse-row>div:first-child{font-weight:700;border-right:.18mm solid #e0cba9}.summary-concern{font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:2.45mm;line-height:1.45;margin:0}
    .flow-page .page-content{overflow:hidden}.flow-block{width:100%;margin:0 0 2.5mm}.section-head{margin-top:.7mm;margin-bottom:3.8mm}.section-number{color:var(--gold2);font-size:2mm;font-weight:800;letter-spacing:.25mm;margin-bottom:2.4mm}.section-title{font-family:Georgia,'Times New Roman',serif;font-size:6mm;line-height:1.08;font-weight:600;margin:0 0 1.5mm;color:var(--ink)}.section-meta{font-family:Georgia,'Times New Roman',serif;font-size:2.25mm;font-style:italic;color:#7b6d5b;margin-bottom:2.5mm}.section-rule{border-top:.22mm solid var(--line)}
    .copy{margin:0;font-size:2.45mm;line-height:1.46;color:#2b241d}.copy.lead-copy{font-family:Georgia,'Times New Roman',serif;font-size:2.8mm;line-height:1.47}.copy.italic{font-family:Georgia,'Times New Roman',serif;font-style:italic;color:#5d5143}
    .subhead{font-family:Georgia,'Times New Roman',serif;font-size:3.15mm;line-height:1.2;margin:1.2mm 0 0;font-weight:700}.subhead-block{margin-top:3.4mm;margin-bottom:1.5mm}
    .idea{display:grid;grid-template-columns:10mm 1fr;gap:2.5mm;padding:1mm 0}.idea-no{font-family:Georgia,'Times New Roman',serif;color:var(--gold2);font-size:5.8mm;font-weight:700;line-height:1}.idea h4{margin:.2mm 0 1mm;font-family:Georgia,'Times New Roman',serif;font-size:3.2mm}.idea p{margin:0;font-size:2.35mm;line-height:1.43}
    .bullet{display:grid;grid-template-columns:3mm 1fr;gap:1.3mm;align-items:start;margin:0 0 1.7mm}.bullet span{width:1.05mm;height:1.05mm;border-radius:50%;background:var(--gold);margin-top:1.2mm}.bullet p{margin:0;font-size:2.38mm;line-height:1.42}
    .callout{padding:3mm 3.8mm;margin-top:1.2mm;margin-bottom:2.7mm}.callout-copy{font-size:2.35mm;line-height:1.43}.callout.strong .callout-copy{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:2.5mm}.callout.practice{background:#fffaf3}
    .confidence{display:grid;grid-template-columns:28mm 1fr;gap:4mm;align-items:center;padding:2.8mm 4mm;background:#f0dfc6;border:.23mm solid #d7bb8b;border-radius:1mm;font-size:2.18mm;line-height:1.35}.confidence-label{font-size:1.75mm;font-weight:800;letter-spacing:.27mm;color:var(--gold2)}
    .report-table{display:grid;width:100%;border-left:.2mm solid #d4b77f;border-top:.2mm solid #d4b77f;margin:0}.report-table>div{padding:2.2mm 2.2mm;border-right:.2mm solid #d4b77f;border-bottom:.2mm solid #d4b77f;font-size:2.05mm;line-height:1.36;min-width:0}.report-table.header>div{background:var(--gold);color:#fff;font-size:1.68mm;font-weight:800;letter-spacing:.11mm;text-transform:uppercase;padding-top:2mm;padding-bottom:2mm}.report-table.row>div{background:#fffaf3}.report-table .center{text-align:center}.table-header{margin-bottom:0}.table-row{margin-bottom:0}.table-gap{height:3mm}.timing-table>div{font-size:1.75mm;line-height:1.28}.timing-table.header>div{font-size:1.48mm}
    .closing-point{display:grid;grid-template-columns:11mm 1fr;gap:4mm;padding:2.5mm 0 3.2mm;border-bottom:.2mm solid #cbb086;font-size:2.55mm;line-height:1.45}.closing-no{font-family:Georgia,'Times New Roman',serif;font-weight:700;color:var(--gold2);font-size:5.5mm;line-height:1}
    #flow-source{display:none}.flow-output{display:block}
    .screen-note{position:fixed;right:12px;bottom:12px;z-index:60;background:#201a15;color:#fff;padding:8px 10px;font-size:11px;opacity:.75}
    @media(max-width:850px){.report-shell{padding-top:10px}.report-page{transform-origin:top center}.report-toolbar{position:relative;top:0}.toolbar-actions{width:100%}.report-toolbar{flex-wrap:wrap}}
    @media print{html,body{background:#fff!important}.report-shell{padding:0}.report-toolbar,.screen-note{display:none!important}.report-page{margin:0!important;box-shadow:none!important;break-after:page;page-break-after:always}.report-page:last-child{break-after:auto;page-break-after:auto}@page{size:A4;margin:0}}
  `;
}

function paginatorScript() {
  return `
  (function(){
    'use strict';
    const logo=${JSON.stringify('__LOGO__')};
    const portrait=${JSON.stringify('__PORTRAIT__')};
    const output=document.getElementById('flow-pages');
    const source=document.getElementById('flow-source');
    const blocks=Array.from(source.children);
    const tableHeaders={};
    blocks.forEach(b=>{const h=b.querySelector('[data-table-header]');if(h)tableHeaders[h.getAttribute('data-table-header')]=b.cloneNode(true)});
    let page=null,content=null,pageCount=3,lastTableOnPage=null;
    const sectionPages={summary:3};

    function createPage(label){
      pageCount+=1;
      page=document.createElement('section');
      page.className='report-page content-page flow-page';
      page.dataset.pageLabel=label||'The Integrated Life Report';
      page.innerHTML='<header class="page-header"><img alt="Divya Bajaj"><div class="page-label"></div><div class="header-rule"></div></header><main class="page-content"></main><footer class="page-footer"><div class="footer-rule"></div><div class="footer-copy">DIVYA BAJAJ&nbsp;&nbsp;|&nbsp;&nbsp;PRIVATE PERSONAL REPORT</div><div class="page-number"></div><img class="footer-portrait" alt="Divya Bajaj"></footer>';
      page.querySelector('.page-header img').src=logo;
      page.querySelector('.footer-portrait').src=portrait;
      page.querySelector('.page-label').textContent=label||'THE INTEGRATED LIFE REPORT';
      page.querySelector('.page-number').textContent=String(pageCount).padStart(2,'0');
      content=page.querySelector('.page-content');
      output.appendChild(page);
      lastTableOnPage=null;
      return page;
    }

    function overflows(){return content.scrollHeight>content.clientHeight+1}
    function appendClone(block){const c=block.cloneNode(true);content.appendChild(c);return c}
    function labelOf(block){return block.dataset.sectionLabel||'The Integrated Life Report'}
    function tableRowId(block){const el=block.querySelector('[data-table-row]');return el&&el.getAttribute('data-table-row')}
    function tableHeaderId(block){const el=block.querySelector('[data-table-header]');return el&&el.getAttribute('data-table-header')}

    function addHeaderIfNeeded(block){
      const id=tableRowId(block);
      if(!id||lastTableOnPage===id)return;
      const hb=tableHeaders[id];
      if(!hb)return;
      const header=appendClone(hb);
      if(overflows()){header.remove();createPage(labelOf(block));appendClone(hb)}
      lastTableOnPage=id;
    }

    createPage(labelOf(blocks[0]||{}));
    for(let i=0;i<blocks.length;i++){
      const b=blocks[i];
      const label=labelOf(b);
      if(!sectionPages[label])sectionPages[label]=pageCount;
      const headerId=tableHeaderId(b);
      if(headerId)lastTableOnPage=headerId;
      addHeaderIfNeeded(b);

      let clone=appendClone(b);
      const keepNext=b.classList.contains('keep-next')&&blocks[i+1];
      let probe=null;
      if(keepNext)probe=appendClone(blocks[i+1]);
      const bad=overflows();
      if(probe)probe.remove();
      if(bad){
        clone.remove();
        createPage(label);
        if(!sectionPages[label])sectionPages[label]=pageCount;
        if(tableRowId(b))addHeaderIfNeeded(b);
        clone=appendClone(b);
        if(overflows()) clone.style.fontSize='97%';
      }
      if(!tableRowId(b)&&!tableHeaderId(b))lastTableOnPage=null;
    }

    document.querySelectorAll('[data-toc-target]').forEach(el=>{
      const target=el.getAttribute('data-toc-target');
      el.textContent=String(sectionPages[target]||'').padStart(2,'0');
    });
    document.documentElement.dataset.paginated='true';
    window.__DIVYA_REPORT_READY__=true;
  })();`;
}

function renderReportHtml({ lead = {}, reportJson = {}, access = {}, printMode = false }) {
  const report = reportJson || {};
  const assets = assetData();
  let flow = renderPrimer(report) + renderGlance(report);
  LIFE.forEach(([number, title, key]) => { flow += renderLife(number, title, report.life_areas?.[key] || {}); });
  flow += renderRemedies(report) + renderTiming(report) + renderClosing(report) + renderLimitations(report);

  let script = paginatorScript().replace(JSON.stringify('__LOGO__'), JSON.stringify(assets.logo)).replace(JSON.stringify('__PORTRAIT__'), JSON.stringify(assets.portrait));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>${esc(lead.name || 'Client')} - The Integrated Life Report</title>
<style>${styles()}</style>
</head>
<body class="${printMode ? 'print-mode' : ''}">
<div class="report-shell">
  ${printMode ? '' : `<div class="report-toolbar"><div class="toolbar-title">${esc(lead.name)} · The Integrated Life Report</div><div class="toolbar-actions">${access.pdfUrl ? `<a class="primary" href="${esc(access.pdfUrl)}">Download PDF</a>` : ''}<a href="/consultation" target="_blank" rel="noopener">Book Consultation</a></div></div>`}

  <section class="report-page cover-page" style="background-image:url('${assets.cover}')">
    <div class="cover-name">${esc(lead.name || 'Client Name')}</div>
    <div class="cover-field cover-dob">${esc(dob(lead.dob) || '-')}</div>
    <div class="cover-field cover-tob">${esc(tob(lead.tob) || '-')}</div>
    <div class="cover-field cover-pob">${esc(lead.pob || lead.place || '-')}</div>
  </section>

  ${fixedChrome({label:'Table of Contents',portrait:assets.portrait,logo:assets.logo,pageNumber:'02',extraClass:'toc-page',body:`<div class="toc-kicker">TABLE OF CONTENTS</div><h1 class="toc-heading">Inside your Integrated Life Report</h1>${tocEntries()}`})}

  ${fixedChrome({label:'Your Report In One Page',portrait:assets.portrait,logo:assets.logo,pageNumber:'03',extraClass:'summary-page',body:summaryPage(lead,report)})}

  <div id="flow-source">${flow}</div>
  <div id="flow-pages" class="flow-output"></div>
</div>
${printMode ? '' : '<div class="screen-note">Private personal report</div>'}
<script>${script}</script>
</body>
</html>`;
}

module.exports = { renderReportHtml, clean, dob, tob };
