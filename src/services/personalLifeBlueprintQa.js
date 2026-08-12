const CONFIDENCE_LEVELS = new Set(['Very High', 'High', 'Medium', 'Not claimed']);
const AREA_KEYS = [
  ['personal_nature', 'Personal Nature'],
  ['past_life_karma', 'Past Life Karma'],
  ['finances', 'Finances'],
  ['marriage', 'Marriage'],
  ['health', 'Health'],
  ['children', 'Children'],
  ['property', 'Property']
];

function text(value) {
  return String(value ?? '').trim();
}

function sentenceCount(value) {
  return text(value)
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(Boolean).length;
}

function allText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(allText).join('\n');
  if (typeof value === 'object') return Object.values(value).map(allText).join('\n');
  return String(value);
}

function push(failures, condition, message) {
  if (!condition) failures.push(message);
}

function validateLifeArea(area, label, failures) {
  push(failures, area && typeof area === 'object', `${label}: section missing.`);
  if (!area || typeof area !== 'object') return;

  push(failures, Boolean(text(area.title)), `${label}: title missing.`);
  push(failures, Boolean(text(area.subtitle)), `${label}: one-line subtitle missing.`);
  push(failures, Boolean(text(area.intro)), `${label}: short intro missing.`);
  push(failures, Array.isArray(area.chart_reading) && area.chart_reading.length >= 3 && area.chart_reading.length <= 5,
    `${label}: What your birth chart says must contain 3-5 paragraphs.`);
  push(failures, Array.isArray(area.numerology_reading) && area.numerology_reading.length >= 2 && area.numerology_reading.length <= 3,
    `${label}: What your numbers say must contain 2-3 paragraphs.`);
  push(failures, Boolean(text(area.synthesis)), `${label}: Where the two agree synthesis missing.`);
  push(failures, CONFIDENCE_LEVELS.has(text(area.confidence)), `${label}: valid confidence level missing.`);
  const exampleSentences = sentenceCount(area.example);
  push(failures, exampleSentences >= 4 && exampleSentences <= 7,
    `${label}: real-life example must be approximately 4-6 sentences.`);
  push(failures, Array.isArray(area.actions) && area.actions.length >= 3 && area.actions.length <= 5,
    `${label}: What to actually do must contain 3-5 executable actions.`);
  push(failures, area.kp_logic && typeof area.kp_logic === 'object', `${label}: traceable KP logic missing.`);
  push(failures, Array.isArray(area.planet_roles) && area.planet_roles.length >= 1,
    `${label}: event-promoting/facilitator/obstructive/neutral planet classification missing.`);
}

function getAreas(stages) {
  const stage2 = stages.life_areas_one_to_three || {};
  const stage3 = stages.life_areas_four_to_seven || {};
  return {
    personal_nature: stage2.personal_nature,
    past_life_karma: stage2.past_life_karma,
    finances: stage2.finances,
    marriage: stage3.marriage,
    health: stage3.health,
    children: stage3.children,
    property: stage3.property
  };
}

function validatePersonalLifeBlueprint(stages = {}, sourceContext = {}) {
  const failures = [];
  const stage1 = stages.verification_big_picture || {};
  const stage2 = stages.life_areas_one_to_three || {};
  const stage3 = stages.life_areas_four_to_seven || {};
  const stage4 = stages.remedies_audit_closing || {};

  push(failures, Boolean(stage1.chart_verification), 'Chart verification block missing.');
  push(failures, Boolean(text(stage1.chart_verification?.ascendant_degree)), 'Ascendant degree missing from chart verification.');
  push(failures, Boolean(text(stage1.chart_verification?.moon_nakshatra)), 'Moon nakshatra missing from chart verification.');
  push(failures, Boolean(text(stage1.chart_verification?.moon_nakshatra_lord)), 'Moon nakshatra lord missing from chart verification.');
  push(failures, Boolean(text(stage1.chart_verification?.current_mahadasha)), 'Current Mahadasha missing from chart verification.');
  push(failures, Boolean(text(stage1.chart_verification?.current_antardasha)), 'Current Antardasha missing from chart verification.');
  push(failures, Boolean(text(stage1.chart_verification?.current_pratyantar)), 'Current Pratyantar missing from chart verification.');
  push(failures, Boolean(stage1.cover), 'Cover content missing.');
  push(failures, Array.isArray(stage1.how_to_read?.promises) && stage1.how_to_read.promises.length === 3,
    'Before You Begin must contain exactly three promises.');
  push(failures, Array.isArray(stage1.numbers_at_a_glance) && stage1.numbers_at_a_glance.length === 4,
    'Numbers at a Glance must contain exactly four numbers.');
  push(failures, Array.isArray(stage1.dominant_planets) && stage1.dominant_planets.length >= 2 && stage1.dominant_planets.length <= 4,
    'Big Picture must contain 2-4 dominant planets.');

  const expectedDouble = sourceContext?.double_confirmation || {};
  if (Number.isInteger(expectedDouble.score)) {
    push(failures, stage1.double_confirmation?.score === expectedDouble.score,
      `Double Confirmation score changed from deterministic backend value ${expectedDouble.score}.`);
  }
  if (text(expectedDouble.label)) {
    push(failures, text(stage1.double_confirmation?.label) === text(expectedDouble.label),
      `Double Confirmation label changed from deterministic backend value ${expectedDouble.label}.`);
  }

  const areas = getAreas(stages);
  for (const [key, label] of AREA_KEYS) validateLifeArea(areas[key], label, failures);

  push(failures, Array.isArray(stage2.personal_nature_weaknesses) && stage2.personal_nature_weaknesses.length >= 2,
    'Personal Nature must name at least two genuine weaknesses.');
  push(failures, /symbolic/i.test(text(stage2.past_life_symbolic_disclaimer)) && /historical fact/i.test(text(stage2.past_life_symbolic_disclaimer)),
    'Past Life Karma must explicitly state that it is symbolic, not historical fact.');

  push(failures,
    Boolean(text(stage3.marriage_event_distinctions?.finalisation)) &&
    Boolean(text(stage3.marriage_event_distinctions?.engagement)) &&
    Boolean(text(stage3.marriage_event_distinctions?.marriage)),
    'Marriage must separate finalisation, engagement and marriage.');

  const healthLine = text(stage3.health_professional_line).toLowerCase();
  push(failures, healthLine.includes('use this as a prompt to book the check-up, never as a reason to skip one'),
    'Health section is missing the mandatory check-up safety line.');

  const childrenLine = text(stage3.children_medical_line).toLowerCase();
  push(failures, childrenLine.includes('conception') && childrenLine.includes('pregnancy') && childrenLine.includes('doctor'),
    'Children section must state that conception and pregnancy questions belong to doctors.');
  push(failures, Boolean(text(stage3.obstruction_pattern_status)),
    'Children section must explicitly report the 1+4+10 obstruction-pattern check.');

  push(failures, Array.isArray(stage4.remedies) && stage4.remedies.length >= 4 && stage4.remedies.length <= 6,
    'Remedies must contain 4-6 prioritised remedies.');
  push(failures, Boolean(text(stage4.one_thing)), 'Highest-leverage one-thing callout missing.');
  push(failures, Array.isArray(stage4.confidence_audit) && stage4.confidence_audit.length >= 1,
    'Confidence audit table missing.');
  push(failures, (stage4.confidence_audit || []).some(item => text(item.confidence) === 'Not claimed'),
    'Confidence audit must contain at least one Not claimed row.');
  push(failures,
    Boolean(text(stage4.limitations?.finer_timing_precision)) &&
    Boolean(text(stage4.limitations?.next_mahadasha_change)) &&
    Boolean(text(stage4.limitations?.gemstones_and_individual_prescriptions)),
    'Closing must contain all three genuine limitations.');

  const customerText = allText(stages);
  push(failures, !customerText.includes('—'), 'Em dash found in report output.');
  push(failures, !/\b(the native|native's)\b/i.test(customerText), 'Third-person native language found; report must use second person.');
  push(failures, !/dangerous period|doom|curse|cursed|terminal illness|predict(?:s|ed)? death/i.test(customerText),
    'Fear-based or prohibited health language found.');
  push(failures, !/\b(?:wear|buy|purchase|use)\b.{0,40}\b(?:ruby|emerald|sapphire|diamond|pearl|coral|hessonite|cat'?s eye|gemstone)\b/i.test(customerText),
    'Gemstone recommendation detected.');
  push(failures, !/\byou (?:will|won't|will not|cannot|can never) have children\b/i.test(customerText),
    'Children section contains a prohibited outcome claim.');

  const finalCheck = stage4.final_self_check || {};
  const requiredChecks = [
    'all_technical_claims_traceable',
    'no_invented_values',
    'current_dasha_verified_for_report_date',
    'numerology_from_backend',
    'double_confirmation_honest',
    'all_seven_areas_present',
    'every_area_has_real_life_example',
    'personal_nature_has_two_weaknesses',
    'health_safe',
    'children_safe',
    'no_gemstones',
    'no_fear_language',
    'at_least_one_not_claimed',
    'plain_english_for_zero_knowledge_reader',
    'no_padding'
  ];
  for (const key of requiredChecks) {
    push(failures, finalCheck[key] === true, `Final self-check failed or omitted: ${key}.`);
  }

  return {
    passed: failures.length === 0,
    failures,
    checked_at: new Date().toISOString(),
    area_count: AREA_KEYS.length,
    contract: 'client-master-prompt-exact-structure-v1'
  };
}

module.exports = {
  AREA_KEYS,
  allText,
  sentenceCount,
  validateLifeArea,
  validatePersonalLifeBlueprint
};