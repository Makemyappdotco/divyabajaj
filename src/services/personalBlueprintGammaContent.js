const CARD_COUNT = 18;
const CONSULTATION_PRICE = '₹4,999';
const CONSULTATION_DURATION = '60 minutes';

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function clip(value, max = 420) {
  const clean = text(value);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const sentence = cut.lastIndexOf('. ');
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, sentence > max * 0.55 ? sentence + 1 : space > 0 ? space : max).trim()}…`;
}

function first(items, maxItems = 2, maxChars = 700) {
  const source = Array.isArray(items) ? items : [];
  return clip(source.slice(0, maxItems).map(text).filter(Boolean).join(' '), maxChars);
}

function bullets(items, maxItems = 4, maxChars = 180) {
  return (Array.isArray(items) ? items : [])
    .slice(0, maxItems)
    .map(item => `- ${clip(item, maxChars)}`)
    .join('\n');
}

function confidence(section) {
  return text(section?.confidence) || 'Not claimed';
}

function areaCard(title, section, { eyebrow = 'Your Personal Blueprint', upsell = '' } = {}) {
  const area = section || {};
  return [
    `# ${title}`,
    `*${eyebrow}*`,
    clip(area.subtitle || area.intro, 190),
    '',
    `## The core pattern`,
    clip(area.synthesis || first(area.chart_reading, 2, 650), 650),
    '',
    `## What supports this`,
    first(area.chart_reading, 1, 470),
    '',
    `## What this looks like in real life`,
    clip(area.example, 430),
    '',
    `## Your next steps`,
    bullets(area.actions, 4, 150),
    '',
    `**Confidence: ${confidence(area)}**`,
    upsell ? `\n> ${upsell}` : ''
  ].filter(Boolean).join('\n');
}

function card(title, body = []) {
  return [`# ${title}`, ...body].filter(Boolean).join('\n');
}

function buildGammaCards(report, lead, variant = 'editorial') {
  const stages = report?.report_json?.stages || {};
  const stage1 = stages.verification_big_picture || {};
  const stage2 = stages.life_areas_one_to_three || {};
  const stage3 = stages.life_areas_four_to_seven || {};
  const stage4 = stages.remedies_audit_closing || {};
  const cover = stage1.cover || {};
  const verification = stage1.chart_verification || {};
  const current = stage1.current_period || {};
  const confirmation = stage1.double_confirmation || {};
  const consultationUrl = process.env.CONSULTATION_BOOKING_URL || 'https://divyabajaj.vercel.app/book-consultation';

  const numberLines = (stage1.numbers_at_a_glance || []).slice(0, 4).map(item =>
    `- **${text(item.label)} ${text(item.number)}** · ${text(item.planet)} · ${clip(item.plain_english_meaning, 150)}`
  );
  const dominantLines = (stage1.dominant_planets || []).slice(0, 3).map(item =>
    `- **${text(item.planet)}** · score ${text(item.score)} · ${clip((item.reasons || []).join('; '), 170)}`
  );
  const dashaLines = (current.chapter_table || []).slice(0, 5).map(item =>
    `- **${text(item.level)} · ${text(item.planet)}** · ${text(item.start)} to ${text(item.end)} · ${clip(item.instruction, 145)}`
  );
  const remedies = (stage4.remedies || []).slice(0, 6).map(item =>
    `- **${text(item.priority)}. ${text(item.planet_or_pattern)}** · ${clip(item.action, 150)} · ${clip(item.frequency, 90)}`
  );
  const audit = (stage4.confidence_audit || []).slice(0, 6).map(item =>
    `- **${text(item.confidence)}** · ${clip(item.finding, 185)} · Limitation: ${clip(item.limitation, 120)}`
  );

  const cards = [
    card('Personal Life Blueprint', [
      `## ${text(lead?.name || cover.client_name || 'Private Client')}`,
      text(cover.birth_data_line || `${lead?.dob || ''} · ${lead?.tob || ''} · ${lead?.pob || ''}`),
      '',
      `**Prepared by Divya Bajaj, Astro-Numerologist**`,
      '',
      `A concise, visual reading using verified KP astrology, Dasha timing and independently calculated numerology.`
    ]),

    card('Your Blueprint at a Glance', [
      ...numberLines,
      '',
      '## Dominant planets',
      ...dominantLines,
      '',
      `## Double Confirmation`,
      `**${text(confirmation.score)}/3 · ${text(confirmation.label)}**`,
      clip(confirmation.explanation, 430)
    ]),

    card('How to Read This Report', [
      '## The map',
      'Your KP chart shows which life areas a planet is connected with.',
      '',
      '## The clock',
      'The Dasha sequence shows which planets are currently active.',
      '',
      '## The timing layer',
      'Verified transit confirmation is required for exact external dates. Where it is unavailable, exact timing is marked Not claimed.',
      '',
      `**Chart promise → Dasha activation → Transit confirmation**`
    ]),

    card('Your Current Life Chapter', [
      ...dashaLines,
      '',
      `## What this period is asking from you`,
      clip(current.current_sub_period_summary, 620),
      '',
      `> ${clip(current.practical_instruction, 420)}`
    ]),

    areaCard('Personal Nature', stage2.personal_nature, { eyebrow: 'How you think, decide and respond' }),

    card('Strengths, Blind Spots and Your Operating Rules', [
      '## Strengths to use deliberately',
      bullets(stage2.personal_nature?.actions, 4, 160),
      '',
      '## Blind spots to manage',
      bullets(stage2.personal_nature_weaknesses, 4, 165),
      '',
      '## One operating rule',
      `> ${clip(stage4.one_thing, 440)}`
    ]),

    areaCard('Career and Money', stage2.finances, {
      eyebrow: 'Earning pattern, opportunity and financial leakage',
      upsell: 'A private consultation can compare your exact career options, offer, business model or money decision against the active period.'
    }),

    card('Your 90-Day Career and Money Plan', [
      '## Month 1 · Clarify',
      '- Define the skill you can monetise now.\n- Audit income, fixed expenses, variable expenses and leakage.\n- Put every important opportunity into writing.',
      '',
      '## Month 2 · Position',
      '- Improve proposals, pricing, profile proof and follow-up.\n- Choose fewer opportunities with clearer commercial value.',
      '',
      '## Month 3 · Convert',
      '- Track offers, conversions, collections and recurring income.\n- Review results and remove work that consumes effort without measurable return.',
      '',
      `> Need help choosing between two real options? Book a private session with Divya.`
    ]),

    areaCard('Relationships and Marriage', stage3.marriage, {
      eyebrow: 'Partnership pattern, commitment and practical readiness',
      upsell: 'Bring one specific proposal, relationship or family concern to a private consultation for personalised guidance.'
    }),

    card('Marriage Decisions: Separate the Stages', [
      `## Finalisation\n${clip(stage3.marriage_event_distinctions?.finalisation, 360)}`,
      '',
      `## Engagement\n${clip(stage3.marriage_event_distinctions?.engagement, 360)}`,
      '',
      `## Marriage\n${clip(stage3.marriage_event_distinctions?.marriage, 360)}`,
      '',
      `**Exact date-level timing is Not claimed without verified transit confirmation.**`
    ]),

    areaCard('Health and Energy', stage3.health, { eyebrow: 'Routine, rest, stress and preventive responsibility' }),

    areaCard('Children and Family', stage3.children, { eyebrow: 'Family readiness, planning and responsibility' }),

    areaCard('Property and Stability', stage3.property, {
      eyebrow: 'Property promise, documents, cost and commitment',
      upsell: 'Before a major property commitment, a private session can help you frame the right questions and decision checks.'
    }),

    areaCard('Past Patterns and Karma', stage2.past_life_karma, { eyebrow: 'A symbolic reading of repeating patterns, not historical fact' }),

    card('Your Most Important Remedies', [
      ...remedies,
      '',
      `> No gemstones, fear-based rituals or costly prescriptions are recommended in this report.`
    ]),

    card('Your Personal 90-Day Blueprint', [
      '## Career',
      '- Build one monetisable skill or offer.\n- Improve documentation, follow-up and proof.',
      '',
      '## Money',
      '- Track income, expenses and hidden leakage weekly.\n- Do not commit without written terms.',
      '',
      '## Relationships',
      '- Separate attraction, family approval and long-term readiness.',
      '',
      '## Health',
      '- Choose consistent maintenance over extreme starts and stops.',
      '',
      '## Personal discipline',
      '- Convert every important thought into a written decision, action or boundary.'
    ]),

    card('What We Are Confident About', [
      ...audit,
      '',
      `## Honest limitation`,
      clip(stage4.limitations?.finer_timing_precision, 350),
      '',
      `**This report is for planning and reflection. It does not replace medical, legal, financial or other qualified professional advice.**`
    ]),

    card('Your Next Step: Personal Guidance', [
      `## Private ${CONSULTATION_DURATION} Consultation with Divya Bajaj`,
      '',
      'This report gives you the map. A private consultation helps you apply it to the exact decision you are facing now.',
      '',
      '- Ask questions not covered by the report\n- Compare real career, marriage, money or property options\n- Understand what deserves attention first\n- Leave with a clear personal action plan',
      '',
      `## ${CONSULTATION_PRICE}`,
      `**Book Your Private Consultation**`,
      consultationUrl,
      '',
      `> Clarity before commitment. Guidance before guesswork.`
    ])
  ];

  if (cards.length !== CARD_COUNT) throw new Error(`Gamma blueprint must contain exactly ${CARD_COUNT} cards; received ${cards.length}.`);
  return {
    card_count: cards.length,
    input_text: cards.join('\n\n---\n\n'),
    variant,
    client_name: text(lead?.name || cover.client_name || 'Client')
  };
}

function additionalInstructions(variant = 'editorial') {
  const base = [
    'Create a premium A4 personal report, not a thesis, textbook or corporate presentation.',
    'Use exactly the supplied 18 cards and do not add, remove, merge or rewrite factual content.',
    'Keep every card visually varied: dashboards, scorecards, timelines, comparison blocks, checklists, quote cards and chapter openers.',
    'Use strong editorial hierarchy, large readable headings, short body blocks and generous whitespace.',
    'Brand every card as Divya Bajaj Personal Life Blueprint using the configured header, footer and theme logo.',
    'Use black, warm ivory and muted gold. Avoid bright purple, neon colours, generic gradients and cheap mystical graphics.',
    'Use elegant serif display headings with a clean modern sans-serif body font.',
    'Do not use stock photography, random people, zodiac clip-art or AI-generated faces.',
    'Use subtle astrology geometry, number motifs, lines, shapes and data visualisations only.',
    'Make the consultation CTA feel personal and trustworthy, never fear-based or pushy.',
    'No em dashes. Preserve all prices, confidence labels, disclaimers and Not claimed statements exactly.'
  ];
  if (variant === 'modern') {
    base.push('Variant B: use a more modern luxury dashboard style with bolder grids, stronger contrast, oversized numbers and modular cards while remaining feminine, calm and premium.');
  } else {
    base.push('Variant A: use a refined editorial magazine style with elegant typography, asymmetric layouts, quiet gold details and sophisticated whitespace.');
  }
  return base.join(' ');
}

module.exports = {
  CARD_COUNT,
  additionalInstructions,
  buildGammaCards,
  clip,
  text
};