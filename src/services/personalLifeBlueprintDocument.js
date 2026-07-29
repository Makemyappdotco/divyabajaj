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

function lifeArea(title, area, extras = []) {
  const section = area || {};
  const blocks = [
    `## ${title}`,
    section.subtitle ? `*${text(section.subtitle)}*` : '',
    text(section.intro),
    '### What your birth chart says',
    paragraphs(section.chart_reading),
    '### What your numbers say',
    paragraphs(section.numerology_reading),
    '### Where the two agree',
    `${text(section.synthesis)}\n\n**Confidence: ${text(section.confidence) || 'Not claimed'}**`,
    callout('Example: what this looks like in real life', section.example),
    '### What to actually do',
    lines(section.actions),
    section.data_gaps?.length ? `### Data required\n${lines(section.data_gaps)}` : '',
    section.technical_basis?.length ? `### Technical basis\n${lines(section.technical_basis)}` : '',
    ...extras.filter(Boolean)
  ];
  return blocks.filter(Boolean).join('\n\n');
}

function composePersonalLifeBlueprint(stages = {}) {
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
    item.start,
    item.end,
    item.instruction,
    item.confidence
  ]);
  const confirmation = stage1.double_confirmation || {};

  const marriageDistinctions = stage3.marriage_event_distinctions || {};
  const marriageExtras = [
    `### Event distinctions\n${markdownTable(
      ['Event', 'What is supported'],
      [
        ['Finalisation', marriageDistinctions.finalisation],
        ['Engagement', marriageDistinctions.engagement],
        ['Marriage', marriageDistinctions.marriage]
      ]
    )}`
  ];

  const healthExtras = [stage3.health_professional_line ? callout('Health safety note', stage3.health_professional_line) : ''];
  const childrenExtras = [
    stage3.children_medical_line ? callout('Children and medical questions', stage3.children_medical_line) : '',
    stage3.obstruction_pattern_status ? `### Classical obstruction-pattern check\n${text(stage3.obstruction_pattern_status)}` : ''
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

  const sections = [
    `# ${text(cover.report_title) || 'Personal Life Blueprint'}`,
    `**${text(cover.client_name)}**\n\n${text(cover.birth_data_line)}\n\nReport date: ${text(cover.report_date)}\n\n${text(cover.methodology_line)}`,
    '## Chart verification',
    `**Status: ${text(verification.status)}**\n\nAscendant: ${text(verification.ascendant_degree)}\n\nMoon nakshatra: ${text(verification.moon_nakshatra)}\n\nMoon nakshatra lord: ${text(verification.moon_nakshatra_lord)}\n\nCurrent Mahadasha: ${text(verification.current_mahadasha)}\n\nCurrent Antardasha: ${text(verification.current_antardasha)}\n\nCurrent Pratyantar: ${text(verification.current_pratyantar)}\n\nCurrent Sookshma: ${text(verification.current_sookshma)}\n\nCurrent Prana: ${text(verification.current_prana)}`,
    verification.discrepancies?.length ? `### Discrepancies\n${lines(verification.discrepancies)}` : '',
    verification.data_required?.length ? `### Data required\n${lines(verification.data_required)}` : '',
    '## Before You Begin: How to Read This Report',
    text(howToRead.map_and_clock_explanation),
    text(howToRead.numerology_explanation),
    lines(howToRead.promises),
    '## Your Numbers at a Glance',
    markdownTable(['Number', 'Value', 'Planet', 'Plain-English meaning'], numberRows),
    '## The Big Picture: Where Everything Agrees',
    markdownTable(['Dominant planet', 'Score', 'Why it ranked'], dominantRows),
    `**Double Confirmation: ${text(confirmation.score)}/3, ${text(confirmation.label)}**\n\n${text(confirmation.explanation)}`,
    confirmation.callouts?.length ? confirmation.callouts.map(item => callout(item.title, `${item.finding}\n\nAction priority: ${item.action_priority}\n\nConfidence: ${item.confidence}`)).join('\n\n') : '',
    '## Where You Are Right Now',
    markdownTable(['Level', 'Planet', 'Start', 'End', 'Instruction', 'Confidence'], chapterRows),
    text(currentPeriod.current_sub_period_summary),
    callout('What this period instructs', currentPeriod.practical_instruction),
    currentPeriod.data_gaps?.length ? `### Data required\n${lines(currentPeriod.data_gaps)}` : '',
    lifeArea('1. Personal Nature', stage2.personal_nature, [
      stage2.personal_nature_weaknesses?.length ? `### Weaknesses to work with honestly\n${lines(stage2.personal_nature_weaknesses)}` : ''
    ]),
    lifeArea('2. Past Life Karma', stage2.past_life_karma, [
      stage2.past_life_symbolic_disclaimer ? callout('Important', stage2.past_life_symbolic_disclaimer) : ''
    ]),
    lifeArea('3. Finances', stage2.finances),
    lifeArea('4. Marriage', stage3.marriage, marriageExtras),
    lifeArea('5. Health', stage3.health, healthExtras),
    lifeArea('6. Children', stage3.children, childrenExtras),
    lifeArea('7. Property', stage3.property),
    '## Remedies',
    markdownTable(['Priority', 'Planet or pattern', 'Issue addressed', 'What to do', 'How often'], remediesRows),
    callout('If you do only one thing from this report', stage4.one_thing),
    '## What We Are Confident About, and What We Are Not',
    markdownTable(['Finding', 'Confidence', 'Basis', 'Limitation'], auditRows),
    '## Where This Report Ends, and What Comes Next',
    `### Finer timing precision\n${text(limitations.finer_timing_precision)}\n\n### Your next Mahadasha change\n${text(limitations.next_mahadasha_change)}\n\n### Gemstones and individual prescriptions\n${text(limitations.gemstones_and_individual_prescriptions)}`,
    text(stage4.closing)
  ];

  const markdown = sections.filter(Boolean).join('\n\n').trim();
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
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  callout,
  composePersonalLifeBlueprint,
  lifeArea,
  lines,
  markdownTable,
  paragraphs,
  text
};
