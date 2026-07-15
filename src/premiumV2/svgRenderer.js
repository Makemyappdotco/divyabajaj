const { PAGE, COLORS, TYPE, PAGE_META } = require('./spec');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function estimateWidth(text, size, family = 'sans') {
  const factor = family === 'display' ? 0.54 : 0.5;
  return String(text || '').length * size * factor;
}

function wrapText(text, width, size, family = 'sans') {
  const source = String(text || '').trim();
  if (!source) return [];
  const words = source.split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach(word => {
    const trial = current ? `${current} ${word}` : word;
    if (!current || estimateWidth(trial, size, family) <= width) current = trial;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function svgText({ x, y, text, width, size = TYPE.body, fill = COLORS.text, weight = 400, family = 'sans', lineHeight = 1.35, anchor = 'start', letterSpacing = 0, uppercase = false }) {
  const value = uppercase ? String(text || '').toUpperCase() : String(text || '');
  const lines = width ? wrapText(value, width, size, family) : [value];
  const font = family === 'display' ? 'Georgia, Times New Roman, serif' : 'Poppins, Arial, Helvetica, sans-serif';
  const dy = size * lineHeight;
  const tspans = lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : dy}">${esc(line)}</tspan>`).join('');
  return {
    svg: `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="${font}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}">${tspans}</text>`,
    height: Math.max(size, lines.length * dy),
    lines
  };
}

function rect(x, y, width, height, fill, radius = 0, stroke = 'none', strokeWidth = 0) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function line(x1, y1, x2, y2, color = COLORS.line, width = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
}

function circle(cx, cy, r, fill, stroke = 'none', strokeWidth = 0) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function brandMark(cx, cy, scale = 1) {
  const gold = COLORS.gold;
  const s = scale;
  return `
    <g transform="translate(${cx},${cy}) scale(${s})">
      <path d="M -58 -55 L -58 55 L 8 55 C 42 55 62 34 62 4 C 62 -20 49 -39 27 -49 C 12 -56 -7 -57 -25 -57 Z" fill="none" stroke="${gold}" stroke-width="3"/>
      <path d="M 5 -47 C 39 -67 75 -44 70 -12 C 66 16 39 31 7 39" fill="none" stroke="${gold}" stroke-width="3"/>
      <ellipse cx="4" cy="-6" rx="54" ry="19" transform="rotate(-18 4 -6)" fill="none" stroke="${gold}" stroke-width="3"/>
      <circle cx="3" cy="-5" r="25" fill="${gold}" opacity="0.88"/>
    </g>`;
}

function pageStart(theme = 'light') {
  const bg = theme === 'dark' ? COLORS.dark : COLORS.cream;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}" height="${PAGE.height}" viewBox="0 0 ${PAGE.width} ${PAGE.height}">${rect(0, 0, PAGE.width, PAGE.height, bg)}`;
}

function pageEnd() {
  return '</svg>';
}

function header(pageNumber, eyebrow, title, theme = 'light') {
  const dark = theme === 'dark';
  const titleColor = dark ? COLORS.white : COLORS.text;
  const divider = dark ? '#4B3A1D' : '#D8C7A4';
  let out = '';
  out += svgText({ x: 44, y: 40, text: eyebrow, size: TYPE.eyebrow, fill: COLORS.gold, weight: 600, uppercase: true, letterSpacing: 0.6 }).svg;
  out += circle(60, 72, 13, COLORS.gold);
  out += svgText({ x: 60, y: 75, text: String(pageNumber - 1).padStart(2, '0'), size: 7, fill: dark ? COLORS.dark : COLORS.white, weight: 700, anchor: 'middle' }).svg;
  out += svgText({ x: 83, y: 79, text: title, size: TYPE.pageTitle, fill: titleColor, weight: 700, family: 'display' }).svg;
  out += line(44, 95, 551, 95, divider, 0.8);
  return out;
}

function footer(pageNumber, section, theme = 'light') {
  const dark = theme === 'dark';
  const color = dark ? '#B8B0A4' : '#6E675F';
  const divider = dark ? '#34302A' : '#CFC5B6';
  let out = line(44, 806, 551, 806, divider, 0.7);
  out += svgText({ x: 44, y: 824, text: 'DIVYA BAJAJ  •  PRIVATE PERSONAL REPORT', size: TYPE.footer, fill: color, weight: 500 }).svg;
  out += svgText({ x: 551, y: 824, text: `${section}  ${String(pageNumber).padStart(2, '0')}`, size: TYPE.footer, fill: color, weight: 500, anchor: 'end' }).svg;
  return out;
}

function card({ x, y, width, height, title, body, fill = COLORS.card, accent = true, dark = false, bodySize = TYPE.body, radius = 10 }) {
  const textColor = dark ? '#F2EDE5' : COLORS.text;
  const muted = dark ? '#D1C9BD' : COLORS.secondary;
  let out = rect(x, y, width, height, fill, radius, dark ? '#2E2A25' : '#DED6CA', 0.7);
  if (accent) out += rect(x, y, 3.5, height, COLORS.gold, 2);
  out += svgText({ x: x + 17, y: y + 25, text: title, width: width - 34, size: TYPE.cardHeading, fill: COLORS.gold, weight: 700, uppercase: true, letterSpacing: 0.35 }).svg;
  const bodyText = svgText({ x: x + 17, y: y + 47, text: body, width: width - 34, size: bodySize, fill: muted, weight: 400, lineHeight: 1.35 });
  out += bodyText.svg;
  return out;
}

function darkBand({ x = 44, y, width = 507, height, title, body, bodySize = TYPE.body, goldFill = false }) {
  const fill = goldFill ? COLORS.gold : COLORS.darkCard;
  const titleColor = goldFill ? COLORS.dark : COLORS.gold;
  const bodyColor = goldFill ? COLORS.dark : '#E9E3DA';
  let out = rect(x, y, width, height, fill, 10, goldFill ? COLORS.deepGold : '#25211D', 0.8);
  out += svgText({ x: x + 18, y: y + 25, text: title, size: TYPE.cardHeading, fill: titleColor, weight: 700, uppercase: true, letterSpacing: 0.35 }).svg;
  out += svgText({ x: x + 18, y: y + 49, text: body, width: width - 36, size: bodySize, fill: bodyColor, lineHeight: 1.35 }).svg;
  return out;
}

function bulletList({ x, y, width, items, color = COLORS.text, bulletColor = COLORS.gold, size = TYPE.body, gap = 20 }) {
  let out = '';
  let yy = y;
  items.forEach(item => {
    out += circle(x + 3, yy - 2, 2.2, bulletColor);
    const t = svgText({ x: x + 13, y: yy, text: item, width: width - 13, size, fill: color, lineHeight: 1.3 });
    out += t.svg;
    yy += Math.max(gap, t.height + 6);
  });
  return out;
}

function renderCover(data, lead) {
  let svg = pageStart('dark');
  svg += brandMark(297, 118, 0.7);
  svg += svgText({ x: 297, y: 205, text: 'DIVYA BAJAJ', size: 24, fill: COLORS.gold, family: 'display', weight: 500, anchor: 'middle', letterSpacing: 2.5 }).svg;
  svg += svgText({ x: 297, y: 226, text: 'ASTRO - NUMEROLOGIST', size: 8, fill: COLORS.gold, weight: 500, anchor: 'middle', letterSpacing: 3 }).svg;
  svg += svgText({ x: 44, y: 298, text: 'PERSONAL ASTROLOGY + NUMEROLOGY REPORT', size: TYPE.eyebrow, fill: COLORS.gold, weight: 700, letterSpacing: 0.5 }).svg;
  svg += svgText({ x: 44, y: 342, text: 'The Full Blueprint', size: 35, fill: COLORS.white, family: 'display', weight: 700 }).svg;
  svg += svgText({ x: 44, y: 385, text: data.subtitle, width: 470, size: 10.5, fill: '#CFC6BA', lineHeight: 1.45 }).svg;
  svg += svgText({ x: 44, y: 475, text: data.prepared_for_label, size: TYPE.eyebrow, fill: COLORS.gold, weight: 700, uppercase: true }).svg;
  svg += svgText({ x: 44, y: 514, text: lead.name, width: 500, size: 26, fill: COLORS.white, family: 'display', weight: 700 }).svg;
  const items = [
    ['DATE OF BIRTH', lead.dob],
    ['TIME OF BIRTH', lead.tob || 'NOT PROVIDED'],
    ['PLACE OF BIRTH', lead.pob || 'NOT PROVIDED']
  ];
  items.forEach((item, index) => {
    const x = 36 + index * 174;
    svg += rect(x, 610, 168, 78, index % 2 ? '#342A1A' : '#433519', 12, '#5A4823', 0.7);
    svg += rect(x + 12, 625, 144, 46, '#101010', 0);
    svg += svgText({ x: x + 20, y: 640, text: item[0], size: 6.2, fill: COLORS.gold, weight: 700 }).svg;
    svg += svgText({ x: x + 20, y: 661, text: String(item[1]).toUpperCase(), width: 125, size: 8.5, fill: COLORS.white, weight: 500 }).svg;
  });
  svg += svgText({ x: 44, y: 784, text: 'PRIVATE AND PERSONALISED  •  PREPARED FOR GUIDANCE, CLARITY AND SELF-REFLECTION', size: 6.2, fill: '#9F978B', weight: 500 }).svg;
  return svg + pageEnd();
}

function renderSummary(data) {
  let svg = pageStart('light') + header(2, 'EXECUTIVE SUMMARY', 'Your Blueprint in 60 Seconds');
  svg += svgText({ x: 44, y: 137, text: data.hero_statement, width: 500, size: 14.5, fill: COLORS.text, family: 'display', weight: 700, lineHeight: 1.28 }).svg;
  const positions = [
    [44, 220], [302, 220], [44, 326], [302, 326],
    [44, 432], [302, 432], [44, 538], [302, 538]
  ];
  data.insights.forEach((item, index) => {
    const [x, y] = positions[index];
    svg += card({ x, y, width: 249, height: 90, title: item.title, body: item.body, fill: index % 3 === 1 ? COLORS.creamAlt : COLORS.card });
  });
  svg += rect(44, 656, 507, 58, COLORS.darkCard, 10);
  ['IDENTITY', 'DIRECTION', 'TIMING', 'PATTERNS', 'ACTION'].forEach((label, index) => {
    const x = 64 + index * 97;
    svg += svgText({ x, y: 680, text: label, size: 6.5, fill: COLORS.gold, weight: 700 }).svg;
    svg += svgText({ x, y: 697, text: String(index + 1).padStart(2, '0'), size: 6.5, fill: '#D8D0C6' }).svg;
  });
  svg += footer(2, 'EXECUTIVE SUMMARY');
  return svg + pageEnd();
}

function renderCoreNumbers(data) {
  let svg = pageStart('light') + header(3, 'THE NUMBERS, SHOWN ONCE', 'Your Core Numbers');
  data.number_cards.forEach((item, index) => {
    const x = 44 + index * 128;
    svg += rect(x, 124, 118, 154, COLORS.card, 12, '#DED6CA', 0.7);
    svg += svgText({ x: x + 15, y: 160, text: item.value, size: 25, fill: COLORS.gold, family: 'display', weight: 700 }).svg;
    svg += svgText({ x: x + 15, y: 180, text: item.label, width: 88, size: 6.7, fill: COLORS.text, weight: 700, uppercase: true }).svg;
    svg += svgText({ x: x + 15, y: 214, text: item.short_meaning, width: 92, size: 12.8, fill: COLORS.text, family: 'display', weight: 700, lineHeight: 1.05 }).svg;
    svg += svgText({ x: x + 15, y: 250, text: item.interpretation, width: 90, size: 7.5, fill: COLORS.secondary, lineHeight: 1.25 }).svg;
  });
  svg += rect(44, 330, 507, 220, COLORS.darkCard, 12);
  svg += svgText({ x: 65, y: 360, text: 'HOW THESE NUMBERS WORK TOGETHER', size: 7, fill: COLORS.gold, weight: 700 }).svg;
  svg += svgText({ x: 65, y: 410, text: data.interplay_headline, width: 450, size: 27, fill: COLORS.white, family: 'display', weight: 700, lineHeight: 1.05 }).svg;
  svg += svgText({ x: 65, y: 462, text: data.interplay_body, width: 455, size: 8.7, fill: '#DED7CF', lineHeight: 1.4 }).svg;
  svg += darkBand({ x: 65, y: 490, width: 465, height: 45, title: 'YOUR SUCCESS FORMULA', body: data.success_formula, bodySize: 7.9, goldFill: true });
  svg += card({ x: 44, y: 600, width: 507, height: 105, title: 'ONE IMPORTANT CONTRADICTION', body: data.contradiction, fill: COLORS.card });
  svg += footer(3, 'CORE PATTERN');
  return svg + pageEnd();
}

function renderIdentity(data) {
  let svg = pageStart('light') + header(4, 'IDENTITY AND DECISION PATTERN', 'Who You Really Are');
  svg += card({ x: 44, y: 125, width: 249, height: 165, title: 'HOW PEOPLE OFTEN SEE YOU', body: data.how_people_see_you });
  svg += card({ x: 302, y: 125, width: 249, height: 165, title: 'WHAT IS HAPPENING INSIDE', body: data.what_is_happening_inside, fill: COLORS.creamAlt });
  svg += rect(44, 305, 507, 70, COLORS.darkCard, 10);
  svg += svgText({ x: 62, y: 330, text: 'YOUR NATURAL STRENGTHS', size: 7, fill: COLORS.gold, weight: 700 }).svg;
  data.strengths.forEach((item, index) => {
    const x = 62 + (index % 6) * 80;
    svg += rect(x, 345, 72, 18, '#2A2723', 9);
    svg += svgText({ x: x + 36, y: 357, text: item, width: 66, size: 5.8, fill: '#ECE6DE', weight: 500, anchor: 'middle' }).svg;
  });
  svg += svgText({ x: 44, y: 420, text: 'How your decisions usually work', size: 16, fill: COLORS.text, family: 'display', weight: 700 }).svg;
  data.decision_steps.forEach((step, index) => {
    const x = 44 + index * 128;
    svg += rect(x, 444, 118, 92, COLORS.card, 10, '#DED6CA', 0.7);
    svg += svgText({ x: x + 15, y: 473, text: String(index + 1), size: 14, fill: COLORS.gold, family: 'display', weight: 700 }).svg;
    svg += svgText({ x: x + 39, y: 470, text: step.title, width: 62, size: 6.4, fill: COLORS.text, weight: 700, uppercase: true }).svg;
    svg += svgText({ x: x + 15, y: 505, text: step.body, width: 88, size: 7.5, fill: COLORS.secondary }).svg;
  });
  svg += card({ x: 44, y: 570, width: 249, height: 142, title: 'BLIND SPOTS TO WATCH', body: data.blind_spots.map(item => `• ${item}`).join('\n'), bodySize: 7.3 });
  svg += card({ x: 302, y: 570, width: 249, height: 142, title: 'BIRTH-DETAIL LENS', body: data.birth_detail_lens, fill: COLORS.creamAlt, bodySize: 7.5 });
  svg += footer(4, 'IDENTITY');
  return svg + pageEnd();
}

function renderCareer(data) {
  let svg = pageStart('light') + header(5, 'PRACTICAL DIRECTION', 'Career + Money');
  svg += darkBand({ y: 120, height: 72, title: '', body: `“${data.hero_quote}”`, bodySize: 14.5 });
  svg += card({ x: 44, y: 215, width: 249, height: 150, title: 'YOU WORK BEST WHEN', body: data.work_best_when.map(item => `• ${item}`).join('\n'), bodySize: 7.2 });
  svg += card({ x: 302, y: 215, width: 249, height: 150, title: 'WHAT TO AVOID', body: data.what_to_avoid.map(item => `• ${item}`).join('\n'), fill: COLORS.creamAlt, bodySize: 7.2 });
  svg += svgText({ x: 44, y: 410, text: 'Focused career directions', size: 16, fill: COLORS.text, family: 'display', weight: 700 }).svg;
  let y = 440;
  data.career_directions.forEach(item => {
    svg += circle(49, y - 3, 2.3, COLORS.gold);
    svg += svgText({ x: 60, y, text: item.title, width: 135, size: 7.2, fill: COLORS.text, weight: 700 }).svg;
    svg += svgText({ x: 205, y, text: item.body, width: 335, size: 7.2, fill: COLORS.secondary }).svg;
    y += 33;
  });
  svg += card({ x: 44, y: 610, width: 507, height: 70, title: 'JOB VS BUSINESS', body: data.job_vs_business, fill: COLORS.creamAlt, bodySize: 7.6 });
  svg += rect(44, 698, 507, 74, COLORS.darkCard, 10);
  svg += svgText({ x: 62, y: 720, text: 'YOUR MONEY SYSTEM', size: 7, fill: COLORS.gold, weight: 700 }).svg;
  data.money_system.forEach((item, index) => {
    const x = 62 + index * 96;
    svg += svgText({ x, y: 744, text: String(index + 1), size: 12, fill: COLORS.gold, family: 'display', weight: 700 }).svg;
    svg += svgText({ x, y: 763, text: item, width: 82, size: 6.4, fill: '#E8E1D8', lineHeight: 1.25 }).svg;
  });
  svg += footer(5, 'DIRECTION');
  return svg + pageEnd();
}

function renderRelationships(data) {
  let svg = pageStart('light') + header(6, 'WHAT CLOSENESS NEEDS FROM YOU', 'Relationships + Communication');
  svg += svgText({ x: 44, y: 145, text: data.hero_statement, width: 507, size: 14, fill: COLORS.text, family: 'display', weight: 700, lineHeight: 1.3 }).svg;
  const positions = [[44, 230], [302, 230], [44, 345], [302, 345]];
  data.cards.forEach((item, index) => {
    const [x, y] = positions[index];
    svg += card({ x, y, width: 249, height: 100, title: item.title, body: item.body, fill: index % 2 ? COLORS.creamAlt : COLORS.card });
  });
  svg += darkBand({ y: 470, height: 95, title: 'YOUR COMMUNICATION PATTERN', body: data.communication_pattern, bodySize: 8.3 });
  svg += svgText({ x: 44, y: 610, text: 'What will improve your relationships', size: 16, fill: COLORS.text, family: 'display', weight: 700 }).svg;
  svg += bulletList({ x: 44, y: 640, width: 500, items: data.improvements, size: 7.6, gap: 22 });
  svg += card({ x: 44, y: 740, width: 507, height: 46, title: '', body: data.strongest_fit, fill: COLORS.creamAlt, accent: false, bodySize: 7.5 });
  svg += footer(6, 'RELATIONSHIPS');
  return svg + pageEnd();
}

function renderCurrentYear(data, numbers) {
  let svg = pageStart('dark') + header(7, data.year_label, 'Your Current Year', 'dark');
  svg += svgText({ x: 44, y: 145, text: 'THE THEME OF THE YEAR', size: 7, fill: COLORS.gold, weight: 700 }).svg;
  svg += svgText({ x: 44, y: 193, text: data.theme_title, width: 420, size: 27, fill: COLORS.white, family: 'display', weight: 700 }).svg;
  svg += svgText({ x: 44, y: 242, text: data.intro, width: 430, size: 9, fill: '#D0C8BE', lineHeight: 1.45 }).svg;
  svg += svgText({ x: 505, y: 230, text: String(numbers.personal_year), size: 118, fill: '#4A3C21', family: 'display', weight: 700, anchor: 'middle' }).svg;
  const positions = [[44, 340], [302, 340], [44, 450], [302, 450]];
  data.cards.forEach((item, index) => {
    const [x, y] = positions[index];
    svg += card({ x, y, width: 249, height: 95, title: item.title, body: item.body, fill: COLORS.darkSoft, dark: true });
  });
  svg += card({ x: 44, y: 575, width: 249, height: 100, title: 'FOCUS', body: data.focus.join('\n'), fill: COLORS.darkSoft, dark: true, accent: false });
  svg += card({ x: 302, y: 575, width: 249, height: 100, title: 'AVOID', body: data.avoid.join('\n'), fill: COLORS.darkSoft, dark: true, accent: false });
  svg += darkBand({ y: 700, height: 60, title: '', body: data.decision_filter, bodySize: 7.8, goldFill: true });
  svg += footer(7, 'CURRENT YEAR', 'dark');
  return svg + pageEnd();
}

function renderNext12(data) {
  let svg = pageStart('light') + header(8, 'A PRACTICAL SEQUENCE, NOT A FIXED PREDICTION', 'Your Next 12 Months');
  svg += svgText({ x: 44, y: 135, text: data.intro, width: 500, size: 8.7, fill: COLORS.secondary, lineHeight: 1.4 }).svg;
  data.phases.forEach((phase, index) => {
    const y = 190 + index * 122;
    svg += circle(86, y + 45, 16, COLORS.gold);
    svg += svgText({ x: 86, y: y + 49, text: String(index + 1), size: 7, fill: COLORS.white, weight: 700, anchor: 'middle' }).svg;
    svg += card({ x: 115, y, width: 436, height: 98, title: `${phase.label} • ${phase.title}`, body: phase.body });
  });
  svg += darkBand({ y: 700, height: 68, title: 'THE 72-HOUR RULE', body: data.rule_72_hour, bodySize: 7.8 });
  svg += footer(8, 'NEXT 12 MONTHS');
  return svg + pageEnd();
}

function renderLongTerm(data) {
  let svg = pageStart('light') + header(9, 'DIRECTION, NOT GUARANTEED EVENTS', 'Your Next 3 to 5 Years');
  svg += svgText({ x: 44, y: 140, text: data.intro, width: 500, size: 13.2, fill: COLORS.text, family: 'display', weight: 700, lineHeight: 1.25 }).svg;
  const positions = [[44, 235], [302, 235], [44, 350], [302, 350]];
  data.steps.forEach((step, index) => {
    const [x, y] = positions[index];
    let body = `<tspan></tspan>`;
    svg += rect(x, y, 249, 100, COLORS.card, 10, '#DED6CA', 0.7);
    svg += svgText({ x: x + 15, y: y + 34, text: step.number, size: 16, fill: COLORS.gold, family: 'display', weight: 700 }).svg;
    svg += svgText({ x: x + 58, y: y + 28, text: step.title, width: 170, size: 7, fill: COLORS.text, weight: 700, uppercase: true }).svg;
    svg += svgText({ x: x + 15, y: y + 58, text: step.body, width: 215, size: 7.4, fill: COLORS.secondary, lineHeight: 1.3 }).svg;
  });
  svg += card({ x: 44, y: 495, width: 507, height: 95, title: 'YOUR LONG-TERM FILTER', body: data.long_term_filter, fill: COLORS.creamAlt, bodySize: 7.7 });
  svg += card({ x: 44, y: 620, width: 249, height: 88, title: 'WHAT CAN SLOW YOU DOWN', body: data.slow_down.join(' • '), bodySize: 7.5 });
  svg += card({ x: 302, y: 620, width: 249, height: 88, title: 'YOUR SIMPLE FORMULA', body: data.simple_formula.join('\n'), fill: COLORS.darkCard, dark: true, accent: false, bodySize: 8 });
  svg += footer(9, 'LONG-TERM DIRECTION');
  return svg + pageEnd();
}

function renderHiddenPatterns(data, numbers) {
  let svg = pageStart('light') + header(10, 'LO SHU GRID AND INTERNAL BALANCE', 'Your Hidden Patterns');
  const order = [[4,9,2],[3,5,7],[8,1,6]];
  order.forEach((row, r) => row.forEach((number, c) => {
    const x = 48 + c * 87;
    const y = 145 + r * 85;
    const count = numbers.lo_shu_grid.counts[number] || 0;
    const missing = count === 0;
    svg += rect(x, y, 78, 75, missing ? '#F2EEE7' : COLORS.creamAlt, 9, missing ? '#DDD4C7' : COLORS.gold, 0.9);
    svg += svgText({ x: x + 8, y: y + 14, text: String(number), size: 5.8, fill: '#8D8170' }).svg;
    svg += svgText({ x: x + 39, y: y + 48, text: missing ? 'MISSING' : String(number).repeat(count), size: missing ? 6.8 : 17, fill: missing ? '#8E867C' : COLORS.text, family: missing ? 'sans' : 'display', weight: missing ? 500 : 700, anchor: 'middle' }).svg;
  }));
  svg += card({ x: 327, y: 145, width: 224, height: 145, title: 'THE CENTRAL CONTRADICTION', body: data.central_contradiction, bodySize: 7.6 });
  svg += card({ x: 327, y: 305, width: 224, height: 115, title: 'REPEATED NUMBER PATTERN', body: data.repeated_number_pattern, fill: COLORS.creamAlt, bodySize: 7.5 });
  svg += svgText({ x: 44, y: 455, text: `Present numbers: ${Object.entries(numbers.lo_shu_grid.counts).filter(([,count]) => count > 0).map(([n,count]) => count > 1 ? `${n} ×${count}` : n).join(', ')}.`, width: 500, size: 7, fill: COLORS.secondary }).svg;
  svg += svgText({ x: 44, y: 470, text: `Missing numbers: ${numbers.lo_shu_grid.missing.join(', ')}.`, width: 500, size: 7, fill: COLORS.secondary }).svg;
  svg += svgText({ x: 44, y: 510, text: 'What the missing numbers ask you to build', size: 16, fill: COLORS.text, family: 'display', weight: 700 }).svg;
  data.missing_guidance.forEach((item, index) => {
    const x = 44 + index * 171;
    svg += rect(x, 535, 161, 115, COLORS.card, 10, '#DED6CA', 0.7);
    svg += svgText({ x: x + 15, y: 568, text: item.number, size: 20, fill: COLORS.gold, family: 'display', weight: 700 }).svg;
    svg += svgText({ x: x + 52, y: 562, text: item.title, width: 92, size: 7, fill: COLORS.text, weight: 700, uppercase: true }).svg;
    svg += svgText({ x: x + 15, y: 595, text: item.body, width: 130, size: 7.2, fill: COLORS.secondary, lineHeight: 1.28 }).svg;
  });
  svg += rect(44, 680, 507, 95, COLORS.darkCard, 10);
  svg += svgText({ x: 62, y: 702, text: 'YOUR THREE PLANES', size: 7, fill: COLORS.gold, weight: 700 }).svg;
  data.planes.forEach((item, index) => {
    const x = 62 + index * 162;
    svg += svgText({ x, y: 726, text: item.name, size: 6.5, fill: COLORS.gold, weight: 700, uppercase: true }).svg;
    svg += svgText({ x, y: 748, text: item.level, size: 13, fill: COLORS.white, family: 'display', weight: 700 }).svg;
    svg += svgText({ x, y: 768, text: item.body, width: 138, size: 6.1, fill: '#D7CFC5', lineHeight: 1.2 }).svg;
  });
  svg += footer(10, 'HIDDEN PATTERNS');
  return svg + pageEnd();
}

function renderGuidance(data) {
  let svg = pageStart('light') + header(11, 'USEFUL SUPPORTS, NOT RANDOM REMEDIES', 'Your Personal Guidance');
  svg += svgText({ x: 44, y: 145, text: data.intro, width: 500, size: 13, fill: COLORS.text, family: 'display', weight: 700, lineHeight: 1.3 }).svg;
  const positions = [[44, 215], [302, 215], [44, 340], [302, 340], [44, 465], [302, 465]];
  data.cards.forEach((item, index) => {
    const [x, y] = positions[index];
    svg += card({ x, y, width: 249, height: 108, title: item.title, body: item.body, fill: index % 2 ? COLORS.creamAlt : COLORS.card });
  });
  svg += darkBand({ y: 700, height: 68, title: 'GEMSTONE NOTE', body: data.gemstone_note, bodySize: 7.5 });
  svg += footer(11, 'GUIDANCE');
  return svg + pageEnd();
}

function renderActionPlan(data) {
  let svg = pageStart('light') + header(12, 'TURN THE REPORT INTO BEHAVIOUR', 'Your 30-Day Action Plan');
  svg += svgText({ x: 44, y: 135, text: data.intro, width: 500, size: 8.5, fill: COLORS.secondary, lineHeight: 1.4 }).svg;
  const positions = [[44, 175], [302, 175], [44, 455], [302, 455]];
  data.weeks.forEach((week, index) => {
    const [x, y] = positions[index];
    svg += rect(x, y, 249, 245, COLORS.card, 12, '#DED6CA', 0.7);
    svg += rect(x + 15, y + 15, 64, 22, COLORS.gold, 11);
    svg += svgText({ x: x + 47, y: y + 29, text: week.week, size: 6.5, fill: COLORS.dark, weight: 700, anchor: 'middle' }).svg;
    svg += svgText({ x: x + 15, y: y + 68, text: week.title, width: 215, size: 15, fill: COLORS.text, family: 'display', weight: 700, lineHeight: 1.08 }).svg;
    let yy = y + 105;
    week.actions.forEach(action => {
      svg += rect(x + 16, yy - 8, 8, 8, 'none', 1, COLORS.deepGold, 0.8);
      const t = svgText({ x: x + 34, y: yy, text: action, width: 195, size: 7.2, fill: COLORS.secondary, lineHeight: 1.28 });
      svg += t.svg;
      yy += Math.max(28, t.height + 8);
    });
  });
  svg += darkBand({ y: 730, height: 50, title: '', body: data.closing, bodySize: 7.4 });
  svg += footer(12, 'ACTION PLAN');
  return svg + pageEnd();
}

function renderDeeperReading(data) {
  let svg = pageStart('light') + header(13, 'WHERE A PERSONAL CONSULTATION ADDS REAL VALUE', 'What Deserves a Deeper Reading');
  svg += svgText({ x: 44, y: 140, text: data.intro, width: 500, size: 8.5, fill: COLORS.secondary, lineHeight: 1.4 }).svg;
  const positions = [[44, 195], [302, 195], [44, 325], [302, 325]];
  data.areas.forEach((item, index) => {
    const [x, y] = positions[index];
    svg += card({ x, y, width: 249, height: 115, title: item.title, body: item.body, fill: index === 3 ? COLORS.creamAlt : COLORS.card });
  });
  svg += rect(44, 500, 507, 165, COLORS.darkCard, 12);
  svg += svgText({ x: 62, y: 528, text: 'QUESTIONS DIVYA WOULD ASK YOU DIRECTLY', size: 7, fill: COLORS.gold, weight: 700 }).svg;
  data.questions.forEach((question, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 62 + col * 245;
    const y = 565 + row * 38;
    svg += circle(x + 2, y - 2, 2.2, COLORS.gold);
    svg += svgText({ x: x + 13, y, text: question, width: 215, size: 6.8, fill: '#E7E0D6', lineHeight: 1.25 }).svg;
  });
  svg += darkBand({ y: 700, height: 62, title: '', body: data.closing, bodySize: 7.7, goldFill: true });
  svg += footer(13, 'DEEPER READING');
  return svg + pageEnd();
}

function renderClosing(data, lead) {
  let svg = pageStart('dark');
  svg += brandMark(297, 112, 0.65);
  svg += svgText({ x: 297, y: 194, text: 'DIVYA BAJAJ', size: 22, fill: COLORS.gold, family: 'display', weight: 500, anchor: 'middle', letterSpacing: 2.2 }).svg;
  svg += svgText({ x: 297, y: 214, text: 'ASTRO - NUMEROLOGIST', size: 7.5, fill: COLORS.gold, weight: 500, anchor: 'middle', letterSpacing: 2.5 }).svg;
  svg += svgText({ x: 44, y: 295, text: 'A PERSONAL CLOSING FROM DIVYA', size: 7, fill: COLORS.gold, weight: 700 }).svg;
  svg += svgText({ x: 44, y: 345, text: data.hero, width: 505, size: 27, fill: COLORS.white, family: 'display', weight: 700, lineHeight: 1.1 }).svg;
  let y = 425;
  data.paragraphs.forEach((paragraph, index) => {
    const t = svgText({ x: 44, y, text: paragraph, width: 500, size: index === 0 ? 12 : 9, fill: index === 0 ? '#F0EAE2' : '#CFC7BD', family: index === 0 ? 'display' : 'sans', weight: index === 0 ? 700 : 400, lineHeight: 1.4 });
    svg += t.svg;
    y += t.height + 24;
  });
  svg += svgText({ x: 44, y: 665, text: data.signoff_name, size: 18, fill: COLORS.gold, family: 'display', weight: 700 }).svg;
  svg += svgText({ x: 44, y: 683, text: data.signoff_role, size: 6.5, fill: '#B8B0A4', weight: 600, uppercase: true }).svg;
  svg += rect(44, 705, 507, 62, COLORS.darkSoft, 10, '#302B26', 0.7);
  svg += svgText({ x: 62, y: 728, text: 'CONTINUE THE CONVERSATION', size: 6.5, fill: COLORS.gold, weight: 700 }).svg;
  svg += svgText({ x: 62, y: 750, text: 'divyabajaj.com', size: 7.5, fill: COLORS.white }).svg;
  svg += svgText({ x: 297, y: 750, text: 'instagram.com/divyabajaj', size: 7.5, fill: COLORS.white }).svg;
  svg += svgText({ x: 44, y: 790, text: `Prepared from submitted details: ${lead.dob}, ${lead.tob || 'time not provided'}, ${lead.pob || 'place not provided'}. This report is for guidance and self-reflection. Exact chart claims require verified astrology calculations.`, width: 505, size: 5.7, fill: '#8F877D', lineHeight: 1.25 }).svg;
  svg += footer(14, 'CLOSING', 'dark');
  return svg + pageEnd();
}

function renderAllPages({ pages, factLedger }) {
  const lead = factLedger.customer;
  const numbers = factLedger.numerology;
  const renderers = [
    () => renderCover(pages.page_1, lead),
    () => renderSummary(pages.page_2),
    () => renderCoreNumbers(pages.page_3),
    () => renderIdentity(pages.page_4),
    () => renderCareer(pages.page_5),
    () => renderRelationships(pages.page_6),
    () => renderCurrentYear(pages.page_7, numbers),
    () => renderNext12(pages.page_8),
    () => renderLongTerm(pages.page_9),
    () => renderHiddenPatterns(pages.page_10, numbers),
    () => renderGuidance(pages.page_11),
    () => renderActionPlan(pages.page_12),
    () => renderDeeperReading(pages.page_13),
    () => renderClosing(pages.page_14, lead)
  ];

  return renderers.map((render, index) => ({
    page_number: index + 1,
    meta: PAGE_META[index + 1],
    svg: render()
  }));
}

module.exports = { renderAllPages, wrapText, svgText };
