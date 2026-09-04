function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function para(text) {
  if (!text) return null;
  return { kind: 'para', atomic: false, html: `<p class="body-text">${esc(text)}</p>` };
}

function sub(text) {
  return { kind: 'sub', atomic: true, glueToNext: true, html: `<div class="subheading">${esc(text)}</div>` };
}

function bullets(items) {
  if (!items || !items.filter(Boolean).length) return null;
  return {
    kind: 'bullets', atomic: false,
    html: `<ul class="bullets">${items.filter(Boolean).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
  };
}

function callout(title, body) {
  if (!body) return null;
  return {
    kind: 'callout', atomic: true,
    html: `<div class="callout"><div class="callout-title">${esc(title)}</div><div class="callout-body">${esc(body)}</div></div>`
  };
}

function heading(number, title, sectionKey, label) {
  return {
    kind: 'heading', atomic: true, glueToNext: true, section: sectionKey, label,
    html: `<div class="section-title-row">${number ? `<div class="section-number">${esc(number)}</div>` : ''}<span class="section-title">${esc(title)}</span></div><div class="section-rule"></div>`
  };
}

function table(headers, rows) {
  const cleanRows = (rows || []).filter(r => r && r.length);
  if (!cleanRows.length) return null;
  const headRowHtml = `<tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
  return {
    kind: 'table', atomic: false,
    headRowHtml,
    headHtml: `<table class="dtable"><thead>${headRowHtml}</thead><tbody>`,
    tailHtml: `</tbody></table>`,
    rows: cleanRows.map(cells => `<tr>${cells.map((c, i) => `<td${i === 0 ? ' class="col-label"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
  };
}

function numberedList(items) {
  const clean = (items || []).filter(Boolean);
  if (!clean.length) return null;
  return {
    kind: 'numbered', atomic: false,
    rows: clean.map((text, i) => `<div class="numbered-row"><span class="numbered-num">${String(i + 1).padStart(2, '0')}</span><p class="body-text" style="margin-bottom:0">${esc(text)}</p></div><div class="numbered-rule"></div>`)
  };
}

function lifeAreaBlocks(number, title, key, data) {
  const blocks = [heading(number, title, key, title)];
  if (data.intro) blocks.push(para(data.intro));
  if (data.birth_chart) { blocks.push(sub('What your birth chart shows')); blocks.push(para(data.birth_chart)); }
  if (data.numbers) { blocks.push(sub('What your numbers show')); blocks.push(para(data.numbers)); }
  if (data.convergence) { blocks.push(sub('Where the two systems agree')); blocks.push(para(data.convergence)); }
  if (data.tension_or_silence) { blocks.push(sub('Where they pull against each other, or where one system is silent')); blocks.push(para(data.tension_or_silence)); }
  if (data.timing && data.timing.filter(Boolean).length) { blocks.push(sub('Timing')); data.timing.filter(Boolean).forEach(t => blocks.push(para(t))); }
  if (data.actions && data.actions.length) { blocks.push(sub('What to actually do about it')); blocks.push(bullets(data.actions)); }
  if (data.confidence) blocks.push(callout('Confidence', data.confidence));
  return blocks.filter(Boolean);
}

const LIFE_AREA_ORDER = [
  ['Personal Nature: Strengths And Weaknesses', 'personal_nature'],
  ['Past Life Karma', 'past_life_karma'],
  ['Finances', 'finances'],
  ['Marriage And Partnership', 'marriage'],
  ['Health And Constitution', 'health'],
  ['Children', 'children'],
  ['Property Purchase', 'property']
];

// Section list in fixed reading order. Numbers are assigned dynamically so the
// whole report renumbers cleanly whether or not the "Your Report In One Page"
// cover page has data (see hasOnePage in render.js) - that page currently has
// no corresponding field in the paidReportV2 report_json contract, so the
// renderer must not assume it is always present.
const SECTION_DEFS = [
  { key: 'how_to_read', label: 'How To Read This Report' },
  { key: 'glance', label: 'Your Chart And Numbers At A Glance' },
  ...LIFE_AREA_ORDER.map(([label, key]) => ({ key, label })),
  { key: 'remedies', label: 'Remedies' },
  { key: 'timing_map', label: 'Your Timing Map' },
  { key: 'closing_summary', label: 'Closing Summary' },
  { key: 'scope_limitations', label: 'Scope And Limitations' }
];

function numberedSectionDefs(hasOnePage) {
  // "Your Report In One Page" occupies TOC slot 01 when present; everything
  // else shifts down by one slot when it is not.
  const start = hasOnePage ? 2 : 1;
  return SECTION_DEFS.map((def, i) => ({ ...def, number: String(start + i).padStart(2, '0') }));
}

function buildFlowSections(report, hasOnePage) {
  const defs = numberedSectionDefs(hasOnePage);
  const byKey = Object.fromEntries(defs.map(d => [d.key, d]));
  const sections = [];

  sections.push({
    key: 'how_to_read', label: byKey.how_to_read.label,
    blocks: [
      heading(byKey.how_to_read.number, byKey.how_to_read.label, 'how_to_read', byKey.how_to_read.label),
      para(report.primer.purpose),
      sub('The two systems used in your report'),
      para(report.primer.systems),
      sub('The four ideas you need'),
      numberedList([
        `Houses are life departments. ${report.primer.four_ideas.houses}`,
        `Planets are the officers in charge. ${report.primer.four_ideas.planets}`,
        `Dasha is whose turn it is. ${report.primer.four_ideas.dasha}`,
        `The chain of command. ${report.primer.four_ideas.chain_of_command}`
      ]),
      sub('The convergence method'),
      para(report.primer.convergence_method),
      sub('What this report will not do'),
      bullets(report.primer.limits)
    ].filter(Boolean)
  });

  sections.push({
    key: 'glance', label: byKey.glance.label,
    blocks: [
      heading(byKey.glance.number, byKey.glance.label, 'glance', byKey.glance.label),
      sub('The astrological layer'),
      table(['Element', 'Position / Signal', 'Plain Meaning'], (report.glance.astrology || []).map(r => [r.element, r.position, r.plain_meaning])),
      sub('The numerological layer'),
      table(['Number', 'Value', 'Plain Meaning'], (report.glance.numerology || []).map(r => [r.label, r.value, r.plain_meaning])),
      callout('The headline finding', report.glance.headline_finding)
    ].filter(Boolean)
  });

  LIFE_AREA_ORDER.forEach(([title, key]) => {
    sections.push({ key, label: byKey[key].label, blocks: lifeAreaBlocks(byKey[key].number, byKey[key].label, key, report.life_areas[key] || {}) });
  });

  // Matches the real paidReportV2 remedies contract: behavioural and
  // traditional_observance are arrays of objects, professional_structural is
  // a plain string list.
  const remedies = report.remedies || {};
  sections.push({
    key: 'remedies', label: byKey.remedies.label,
    blocks: [
      heading(byKey.remedies.number, byKey.remedies.label, 'remedies', byKey.remedies.label),
      para(remedies.intro),
      (remedies.behavioural || []).length ? sub('Behavioural practices') : null,
      bullets((remedies.behavioural || []).map(b =>
        [b.pattern, b.practice, b.rhythm ? `(${b.rhythm})` : '', b.purpose].filter(Boolean).join(' ')
      )),
      (remedies.professional_structural || []).length ? sub('Professional and structural') : null,
      bullets(remedies.professional_structural),
      (remedies.traditional_observance || []).length ? sub('Traditional observance (optional)') : null,
      bullets((remedies.traditional_observance || []).map(t =>
        [t.planet ? `${t.planet}:` : '', t.observance, t.why ? `(${t.why})` : ''].filter(Boolean).join(' ')
      )),
      remedies.gemstone_note ? sub('Gemstones') : null,
      remedies.gemstone_note ? para(remedies.gemstone_note) : null
    ].filter(Boolean)
  });

  const majorShift = report.major_shift && report.major_shift.reading ? report.major_shift : null;
  sections.push({
    key: 'timing_map', label: byKey.timing_map.label,
    blocks: [
      heading(byKey.timing_map.number, byKey.timing_map.label, 'timing_map', byKey.timing_map.label),
      table(['Period', 'Astrology', 'Numerology', 'Combined Reading', 'Conf.'],
        (report.timing_map || []).map(r => [r.period, r.astrology, r.numerology, r.combined_reading, r.confidence])),
      majorShift ? callout(`Major shift${majorShift.period ? ' - ' + majorShift.period : ''}`, majorShift.reading) : null
    ].filter(Boolean)
  });

  sections.push({
    key: 'closing_summary', label: byKey.closing_summary.label,
    blocks: [
      heading(byKey.closing_summary.number, byKey.closing_summary.label, 'closing_summary', byKey.closing_summary.label),
      numberedList(report.closing_summary)
    ].filter(Boolean)
  });

  sections.push({
    key: 'scope_limitations', label: byKey.scope_limitations.label,
    blocks: [
      heading(byKey.scope_limitations.number, byKey.scope_limitations.label, 'scope_limitations', byKey.scope_limitations.label),
      bullets(report.scope_limitations)
    ].filter(Boolean)
  });

  return sections;
}

function tocEntries(hasOnePage) {
  const defs = numberedSectionDefs(hasOnePage);
  const rows = hasOnePage ? [['01', 'Your Report In One Page']] : [];
  defs.forEach(d => rows.push([d.number, d.label]));
  return rows;
}

module.exports = { buildFlowSections, tocEntries, esc };
