function text(value) {
  return String(value ?? '').trim();
}

function lines(items, prefix = '- ') {
  return (Array.isArray(items) ? items : [])
    .map(item => text(item))
    .filter(Boolean)
    .map(item => `${prefix}${item}`)
    .join('\n');
}

function paragraphs(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => text(item))
    .filter(Boolean)
    .join('\n\n');
}

function markdownTable(headers, rows) {
  const safe = value => text(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const header = `| ${headers.map(safe).join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.map(safe).join(' | ')} |`).join('\n');
  return [header, divider, body].filter(Boolean).join('\n');
}

function callout(title, body) {
  const content = text(body).split('\n').map(line => `> ${line}`).join('\n');
  return `> **${text(title)}**\n>\n${content}`;
}

function uniqueItems(items) {
  return [...new Set((Array.isArray(items) ? items : []).map(item => text(item)).filter(Boolean))];
}

function formatDateValue(value) {
  const raw = text(value);
  if (!raw) return '';

  const apiMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (apiMatch) {
    const [, day, month, year, hour, minute] = apiMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour || 0), Number(minute || 0)));
    const datePart = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
    return hour === undefined ? datePart : `${datePart}, ${String(hour).padStart(2, '0')}:${minute}`;
  }

  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(iso);
  }

  return raw;
}

function humaniseEmbeddedDates(value) {
  return text(value).replace(/\b(\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2})\b/g, match => formatDateValue(match));
}

function confirmationCallouts(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const title = text(item.label) || 'Double Confirmation';
      const body = [
        text(item.finding),
        text(item.why_it_matters),
        item.action_priority ? `Action priority: ${text(item.action_priority)}` : '',
        item.confidence ? `Confidence: ${text(item.confidence)}` : ''
      ].filter(Boolean).join('\n\n');
      return callout(title, body);
    })
    .filter(Boolean)
    .join('\n\n');
}

function lifeArea(title, area, { chartExtras = [] } = {}) {
  const section = area || {};
  const gaps = uniqueItems(section.data_gaps);
  const callouts = confirmationCallouts(section.double_confirmation_callouts);

  return [
    `## ${title}`,
    section.subtitle ? `*${text(section.subtitle)}*` : '',
    text(section.intro),
    '### What your birth chart says',
    paragraphs(section.chart_reading),
    ...chartExtras.filter(Boolean),
    '### What your numbers say',
    paragraphs(section.numerology_reading),
    '### Where the two agree',
    `${text(section.synthesis)}\n\n**Confidence: ${text(section.confidence) || 'Not claimed'}**`,
    callouts,
    callout('Example - what this looks like in real life', section.example),
    '### What to actually do',
    lines(section.actions),
    gaps.length ? `### Data required\n${lines(gaps)}` : ''
  ].filter(Boolean).join('\n\n');
}

function composePersonalLifeBlueprint(stages = {}, qa = null) {
  const stage1 = stages.verification_big_picture || {};
  const stage2 = stages.life_areas_one_to_three || {};
  const stage3 = stages.life_areas_four_to_seven || {};
  const stage4 = stages.remedies_audit_closing || {};
  const cover = stage1.cover || {};
  const verification = stage1.chart_verification || {};
  const howToRead = stage1.how_to_read || {};
  const currentPeriod = stage1.current_period || {};

  const numberRows = (stage1.numbers_at_a_glance || []).map(item => [
    item.label,
    item.number,
    item.planet,
    item.plain_english_meaning
  ]);
  const dominantRows = (stage1.dominant_planets || []).map(item => [
    item.planet,
    item.score,
    (item.reasons || []).join('; ')
  ]);
  const chapterRows = (currentPeriod.chapter_table || []).map(item => [
    item.level,
    item.planet,
    formatDateValue(item.start),
    formatDateValue(item.end),
    item.instruction,
    item.confidence
  ]);
  const confirmation = stage1.double_confirmation || {};

  const marriageDistinctions = stage3.marriage_event_distinctions || {};
  const marriageChartExtras = [
    `#### Finalisation, engagement and marriage are separate\n${markdownTable(
      ['Event', 'What the verified pattern supports'],
      [
        ['Finalisation', marriageDistinctions.finalisation],
        ['Engagement', marriageDistinctions.engagement],
        ['Marriage', marriageDistinctions.marriage]
      ]
    )}`
  ];

  const personalNatureChartExtras = stage2.personal_nature_weaknesses?.length
    ? [`#### Weaknesses this report will not flatter away\n${lines(stage2.personal_nature_weaknesses)}`]
    : [];
  const pastLifeChartExtras = stage2.past_life_symbolic_disclaimer
    ? [callout('Important', stage2.past_life_symbolic_disclaimer)]
    : [];
  const healthChartExtras = [
    stage3.health_6812_loading ? `#### 6 + 8 + 12 loading check\n${text(stage3.health_6812_loading)}` : '',
    stage3.health_professional_line ? callout('Health safety note', stage3.health_professional_line) : ''
  ];
  const childrenChartExtras = [
    stage3.obstruction_pattern_status ? `#### Classical 1 + 4 + 10 obstruction check\n${text(stage3.obstruction_pattern_status)}` : '',
    stage3.children_medical_line ? callout('Children and medical questions', stage3.children_medical_line) : ''
  ];

  const remediesRows = (stage4.remedies || []).map(item => [
    item.priority,
    item.planet_or_pattern,
    item.issue_addressed,
    item.action,
    item.frequency
  ]);
  const auditRows = (stage4.confidence_audit || []).map(item => [
    item.finding,
    item.confidence,
    item.basis,
    item.limitation
  ]);
  const limitations = stage4.limitations || {};

  const verificationBlock = [
    '# Chart Verification',
    `**Status: ${text(verification.status)}**`,
    `Ascendant degree: ${text(verification.ascendant_degree)}`,
    `Moon nakshatra: ${text(verification.moon_nakshatra)}`,
    `Moon nakshatra lord: ${text(verification.moon_nakshatra_lord)}`,
    `Current Mahadasha: ${humaniseEmbeddedDates(verification.current_mahadasha)}`,
    `Current Antardasha: ${humaniseEmbeddedDates(verification.current_antardasha)}`,
    `Current Pratyantar: ${humaniseEmbeddedDates(verification.current_pratyantar)}`,
    verification.current_sookshma ? `Current Sookshma: ${humaniseEmbeddedDates(verification.current_sookshma)}` : '',
    verification.current_prana ? `Current Prana: ${humaniseEmbeddedDates(verification.current_prana)}` : '',
    text(verification.verification_note),
    verification.discrepancies?.length ? `## Discrepancies\n${lines(uniqueItems(verification.discrepancies))}` : '',
    verification.data_required?.length ? `## Data required\n${lines(uniqueItems(verification.data_required))}` : ''
  ].filter(Boolean).join('\n\n');

  const sections = [
    verificationBlock,
    `# ${text(cover.report_title) || 'Personal Life Blueprint'}`,
    `**${text(cover.client_name)}**\n\n${text(cover.birth_data_line)}\n\nReport date: ${formatDateValue(cover.report_date)}\n\n${text(cover.methodology_line)}`,
    '## Before You Begin: How to Read This Report',
    text(howToRead.map_and_clock_explanation),
    text(howToRead.numerology_explanation),
    lines(howToRead.promises),
    '## Your Numbers at a Glance',
    markdownTable(['Number', 'Value', 'Planet', 'Plain-English meaning'], numberRows),
    '## The Big Picture: Where Everything Agrees',
    markdownTable(['Dominant planet', 'Score', 'Why it ranked'], dominantRows),
    `**Double Confirmation: ${text(confirmation.score)}/3 - ${text(confirmation.label)}**\n\n${text(confirmation.explanation)}`,
    confirmationCallouts(confirmation.callouts),
    '## Where You Are Right Now',
    markdownTable(['Level', 'Planet', 'Start', 'End', 'What it instructs', 'Confidence'], chapterRows),
    text(currentPeriod.current_sub_period_summary),
    callout('What this period instructs', currentPeriod.practical_instruction),
    currentPeriod.data_gaps?.length ? `### Data required\n${lines(uniqueItems(currentPeriod.data_gaps))}` : '',
    lifeArea('1. Personal Nature', stage2.personal_nature, { chartExtras: personalNatureChartExtras }),
    lifeArea('2. Past Life Karma', stage2.past_life_karma, { chartExtras: pastLifeChartExtras }),
    lifeArea('3. Finances', stage2.finances),
    lifeArea('4. Marriage', stage3.marriage, { chartExtras: marriageChartExtras }),
    lifeArea('5. Health', stage3.health, { chartExtras: healthChartExtras }),
    lifeArea('6. Children', stage3.children, { chartExtras: childrenChartExtras }),
    lifeArea('7. Property', stage3.property),
    '## Remedies',
    markdownTable(['Priority', 'Planet or pattern', 'Specific issue addressed', 'What to actually do', 'How often'], remediesRows),
    callout('If you do only one thing from this report', stage4.one_thing),
    '## What We Are Confident About, and What We Are Not',
    markdownTable(['Finding', 'Confidence', 'Basis', 'Limitation'], auditRows),
    '## Where This Report Ends, and What Comes Next',
    `### Finer timing precision\n${text(limitations.finer_timing_precision)}\n\n### Your next Mahadasha change\n${text(limitations.next_mahadasha_change)}\n\n### Gemstones and individual prescriptions\n${text(limitations.gemstones_and_individual_prescriptions)}`,
    text(stage4.closing)
  ];

  const includedSections = sections.filter(Boolean);
  const markdown = includedSections.join('\n\n').trim();
  const plainText = markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^\|.*\|$/gm, line => line.replace(/^\|\s*|\s*\|$/g, '').split('|').map(cell => cell.trim()).join(' | '))
    .replace(/^\s*---(?:\s*\|\s*---)+\s*$/gm, '')
    .replace(/<br>/g, '; ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    markdown,
    plain_text: plainText,
    character_count: plainText.length,
    word_count: plainText.split(/\s+/).filter(Boolean).length,
    section_count: includedSections.length,
    life_area_count: 7,
    client_master_structure: 'exact-structure-v1',
    qa: qa || null,
    technical_audit_retained_in_structured_data: true,
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  callout,
  composePersonalLifeBlueprint,
  confirmationCallouts,
  formatDateValue,
  humaniseEmbeddedDates,
  lifeArea,
  lines,
  markdownTable,
  paragraphs,
  text,
  uniqueItems
};