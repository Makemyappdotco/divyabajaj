const { generateSourceBundle } = require('./astrologyApiV2');
const { calculateNumerology } = require('./numerologyEngine');
const { verifySourceBundle } = require('./reportVerification');

const LIFE_AREA_KEYS = [
  'personal_nature',
  'past_life_karma',
  'finances',
  'marriage',
  'health',
  'children',
  'property'
];

const REQUIRED_ASTROLOGY_GLANCE_ROWS = [
  'ascendant',
  'ascendant lord',
  'moon',
  'strongest house',
  'dominant planet',
  'current period',
  'next major shift'
];

const REQUIRED_NUMEROLOGY_GLANCE_ROWS = [
  'birth number',
  'destiny number',
  'name number',
  'personal year'
];

const CUSTOMER_FACING_FORBIDDEN_TERMS = [
  { pattern: /\bKP\b/i, label: 'KP' },
  { pattern: /Chaldean/i, label: 'Chaldean' },
  { pattern: /Pythagorean/i, label: 'Pythagorean' },
  { pattern: /AstrologyAPI/i, label: 'AstrologyAPI' },
  { pattern: /separate\s+Nadi\s+calculation/i, label: 'separate Nadi calculation' }
];

function getPaidModel() {
  return process.env.OPENAI_PAID_MODEL || 'gpt-5.5';
}

function extractText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data?.output || [])
    .flatMap(item => item.content || [])
    .map(item => item.text || '')
    .join('\n')
    .trim();
}

function compactKpPlanets(bundle) {
  if (!bundle?.kp_planets?.ok || !Array.isArray(bundle.kp_planets.data)) return null;
  return bundle.kp_planets.data.map(item => ({
    planet_id: item.planet_id,
    planet_name: item.planet_name || item.name,
    degree: item.degree,
    formatted_degree: item.formatted_degree,
    norm_degree: item.norm_degree ?? item.normDegree,
    formatted_norm_degree: item.formatted_norm_degree,
    house: item.house,
    sign: item.sign,
    sign_lord: item.sign_lord || item.signLord,
    nakshatra: item.nakshatra,
    nakshatra_lord: item.nakshatra_lord || item.nakshatraLord,
    charan: item.charan,
    sub_lord: item.sub_lord || item.subLord,
    sub_sub_lord: item.sub_sub_lord || item.subSubLord,
    retrograde: item.is_retro ?? item.isRetro
  }));
}

function compactKpCusps(bundle) {
  if (!bundle?.kp_house_cusps?.ok || !Array.isArray(bundle.kp_house_cusps.data)) return null;
  return bundle.kp_house_cusps.data.map(item => ({
    house_id: item.house_id,
    cusp_full_degree: item.cusp_full_degree,
    formatted_degree: item.formatted_degree,
    sign_id: item.sign_id,
    sign: item.sign,
    sign_lord: item.sign_lord,
    nakshatra: item.nakshatra,
    nakshatra_lord: item.nakshatra_lord,
    sub_lord: item.sub_lord,
    sub_sub_lord: item.sub_sub_lord
  }));
}

function compactSource(bundle, deterministicNumerology, verification) {
  const planets = bundle?.planets?.ok && Array.isArray(bundle.planets.data)
    ? bundle.planets.data.map(item => ({
        name: item.name,
        sign: item.sign,
        house: item.house,
        degree: item.normDegree,
        nakshatra: item.nakshatra,
        nakshatra_lord: item.nakshatraLord,
        retrograde: item.isRetro
      }))
    : [];

  const charts = {};
  Object.entries(bundle?.charts || {}).forEach(([id, result]) => {
    charts[id] = result?.ok ? result.data : { unavailable: result?.error || true };
  });

  return {
    source_generated_at: bundle?.generated_at || null,
    source_verification: verification,
    planets,
    kp_source_status: {
      kp_planets: Boolean(bundle?.kp_planets?.ok),
      kp_house_cusps: Boolean(bundle?.kp_house_cusps?.ok),
      kp_planet_significators: Boolean(bundle?.kp_planet_significators?.ok),
      kp_house_significators: Boolean(bundle?.kp_house_significators?.ok)
    },
    kp_planets: compactKpPlanets(bundle),
    kp_house_cusps: compactKpCusps(bundle),
    kp_planet_significators: bundle?.kp_planet_significators?.ok ? bundle.kp_planet_significators.data : null,
    kp_house_significators: bundle?.kp_house_significators?.ok ? bundle.kp_house_significators.data : null,
    current_vdasha: bundle?.current_vdasha?.ok ? bundle.current_vdasha.data : null,
    current_vdasha_all: bundle?.current_vdasha_all?.ok ? bundle.current_vdasha_all.data : null,
    deterministic_numerology: deterministicNumerology,
    astrologyapi_numerological_numbers: bundle?.numerological_numbers?.ok ? bundle.numerological_numbers.data : null,
    astrologyapi_numero_table: bundle?.numero_table?.ok ? bundle.numero_table.data : null,
    charts
  };
}

function buildPrompt(input, source) {
  const reportYear = source?.deterministic_numerology?.calculation_date?.slice(0, 4) || new Date().getUTCFullYear();

  return `You are preparing The Integrated Life Report for Divya Bajaj.

CLIENT
Name: ${input.name}
Gender: ${input.gender}
Date of birth: ${input.dob}
Time of birth: ${input.tob}
Place of birth: ${input.pob}
Birth-time accuracy: ${input.birth_time_accuracy || 'not stated'}
Main concern: ${input.question || 'Complete life clarity'}

VERIFIED INTERNAL SOURCE DATA
${JSON.stringify(source, null, 2)}

SOURCE OF TRUTH
The client-approved report format is the Integrated Life Report structure. Follow its order, teaching style, convergence method and seven life-area rhythm. Do not copy the sample client's conclusions. Every conclusion must be freshly derived from the verified source above for this customer.
The client has explicitly confirmed that the requested Nadi Astrology and Vedic Numerology change is customer-facing terminology only. Do not recalculate, alter or reinterpret any supplied number or astrological source value merely because of the terminology change.

REPORT CONTRACT
The report must contain these sections in this exact order:
1. How To Read This Report
2. Your Chart And Numbers At A Glance
3. Personal Nature: Strengths And Weaknesses
4. Past Life Karma
5. Finances
6. Marriage And Partnership
7. Health And Constitution
8. Children
9. Property Purchase
10. Remedies
11. Your Timing Map
12. Closing Summary
13. Scope And Limitations

SECTION 1 MUST TEACH THE METHOD IN THIS ORDER
- Why the report shows its working.
- The two customer-facing systems are Nadi Astrology and Vedic Numerology.
- Four plain-language ideas: Houses are life departments; Planets are the officers in charge; Dasha is whose turn it is; The chain of command explains sign lord, star lord and sub lord.
- The convergence method: Convergence, Tension and Silence.
- What the report will not do, including health, irreversible-event, guarantee and fear-based-prediction limits.
- A short plain disclaimer that astrology and numerology are traditional interpretive systems and are not medical, legal or financial advice.
- In primer.systems, begin directly with Nadi Astrology and Vedic Numerology. Do not repeat the heading or begin with phrases such as "Two systems are used here".

SECTION 2 MUST USE THESE FIXED ROWS
Astrological layer, exactly seven rows in this order:
1. Ascendant
2. Ascendant lord
3. Moon
4. Strongest house
5. Dominant planet
6. Current period
7. Next major shift
If a row cannot be supported from verified data, keep the row and say that the available source does not support a stronger conclusion. Never invent it.

Numerological layer, exactly four rows in this order:
1. Birth Number
2. Destiny Number
3. Name Number
4. Personal Year ${reportYear}
Use deterministic_numerology as the primary internal number source. Present the customer-facing numerology system as Vedic Numerology. Show the derivation briefly and accurately without exposing internal calculation labels.
End this section with one headline finding that names the strongest genuine cross-system confirmation. If there is no strong convergence, say that plainly instead of manufacturing one.

THE SEVEN LIFE AREAS
The seven life areas are Personal Nature, Past Life Karma, Finances, Marriage, Health, Children and Property. For every life area use this same rhythm and these exact subheadings:
- a short introduction
- What your birth chart shows
- What your numbers show
- Where the two systems agree
- Where they pull against each other, or where one system is silent
- Timing, only when supported
- What to actually do about it
- Confidence, with a short reason for that confidence

CUSTOMER-FACING METHOD LABELS
- Present the astrology system as Nadi Astrology throughout the report.
- Present the numerology system as Vedic Numerology throughout the report.
- Numerology is an independent second opinion, not a replacement for astrology.
- Treat deterministic_numerology as an internal data source only. Do not expose that implementation label to the customer.
- Use the five supplied values in personal_years for the core timing map without changing their calculations.
- The report may describe convergence, tension and silence. Never force agreement.
- Never mention KP, Chaldean, Pythagorean, AstrologyAPI, internal source keys, backend implementation names, or whether a separate Nadi calculation was or was not performed anywhere in the customer-facing JSON.

TIMING MAP CONTRACT
- Produce exactly five core timing rows, one for each deterministic personal_years entry, in chronological order.
- For each row compare the verified astrological chapter with that Personal Year.
- If astrology is silent for a year, say so.
- Add an optional major_shift object only when the verified Dasha source clearly contains a meaningful major-period change outside those five rows.
- Do not create dates or events that the verified source does not support.

REMEDIES CONTRACT
- Behavioural first.
- Professional or structural second.
- Optional traditional observance last.
- No gemstone recommendation. State that gemstone prescription requires a separate dedicated planetary-strength assessment.
- Explain the practical purpose of each remedy. Do not present a remedy as a mechanism that guarantees an external event.

ACCURACY RULES
- Use only facts supported by the supplied source data.
- Never invent a planet, house, sign, nakshatra, dasha, date, degree, Star Lord, Sub Lord, Sub-Sub Lord, cusp, significator or numerology number.
- Read source_verification before writing. Never override a blocking issue or discrepancy.
- Internally use planetary, cusp and significator source fields only when their corresponding source-status value is true and the actual data is present. Never expose internal source-field names to the customer.
- When evidence is insufficient, say so plainly. Do not fill the gap with a generic prediction.
- Do not create exact event dates unless the verified dasha source genuinely supports that precision.
- Past Life Karma must be presented as symbolic traditional interpretation, not documented historical fact.
- Health: no diagnosis, disease prediction, medication advice or treatment advice. Encourage qualified medical guidance for real symptoms or concerns.
- Children: no fertility guarantees and no claim that someone definitely can or cannot conceive.
- Finances: no guaranteed income, returns or investment outcomes.
- Marriage: no guaranteed marriage date or guaranteed relationship outcome.
- No prediction of death or a date for an irreversible event.
- No fear-based language, curses, threats or remedy sales tactics.

WRITING STYLE AND LENGTH
- Plain, natural English that a normal customer can understand.
- Warm, direct and practical, as if Divya is explaining the report personally.
- No em dashes.
- Avoid robotic phrases and vague spiritual filler.
- Every paragraph should add interpretation, evidence, limitation, action or useful synthesis.
- Do not repeat the same observation in multiple sections unless the new section adds a different implication.
- Scope And Limitations must stay customer-facing. Do not describe APIs, backend verification, internal calculation systems or implementation details there.
- Main target: 4,500 to 5,300 words for the rendered report.
- Acceptable final range: 4,000 to 5,800 words. Do not exceed it.
- Suggested balance: primer 450-550 words; glance 300-400; each life area 350-450; remedies 350-450; timing map 250-350; closing summary 200-300; limitations 180-260.
- The client's sample is deliberately longer. Keep the same logic and depth, but edit tightly.

Return ONLY valid JSON with exactly this shape:
{
  "primer": {
    "purpose": "",
    "systems": "",
    "four_ideas": {
      "houses": "",
      "planets": "",
      "dasha": "",
      "chain_of_command": ""
    },
    "convergence_method": "",
    "limits": ["", "", "", ""],
    "disclaimer": ""
  },
  "glance": {
    "astrology": [
      {"element":"Ascendant", "position":"", "plain_meaning":""},
      {"element":"Ascendant lord", "position":"", "plain_meaning":""},
      {"element":"Moon", "position":"", "plain_meaning":""},
      {"element":"Strongest house", "position":"", "plain_meaning":""},
      {"element":"Dominant planet", "position":"", "plain_meaning":""},
      {"element":"Current period", "position":"", "plain_meaning":""},
      {"element":"Next major shift", "position":"", "plain_meaning":""}
    ],
    "numerology": [
      {"label":"Birth Number", "value":"", "ruling_planet":"", "derived_from":"", "plain_meaning":""},
      {"label":"Destiny Number", "value":"", "ruling_planet":"", "derived_from":"", "plain_meaning":""},
      {"label":"Name Number", "value":"", "ruling_planet":"", "derived_from":"", "plain_meaning":""},
      {"label":"Personal Year ${reportYear}", "value":"", "ruling_planet":"", "derived_from":"", "plain_meaning":""}
    ],
    "headline_finding": ""
  },
  "life_areas": {
    "personal_nature": {"intro":"", "birth_chart":"", "numbers":"", "convergence":"", "tension_or_silence":"", "timing":[""], "actions":[""], "confidence":""},
    "past_life_karma": {"intro":"", "birth_chart":"", "numbers":"", "convergence":"", "tension_or_silence":"", "timing":[""], "actions":[""], "confidence":""},
    "finances": {"intro":"", "birth_chart":"", "numbers":"", "convergence":"", "tension_or_silence":"", "timing":[""], "actions":[""], "confidence":""},
    "marriage": {"intro":"", "birth_chart":"", "numbers":"", "convergence":"", "tension_or_silence":"", "timing":[""], "actions":[""], "confidence":""},
    "health": {"intro":"", "birth_chart":"", "numbers":"", "convergence":"", "tension_or_silence":"", "timing":[""], "actions":[""], "confidence":""},
    "children": {"intro":"", "birth_chart":"", "numbers":"", "convergence":"", "tension_or_silence":"", "timing":[""], "actions":[""], "confidence":""},
    "property": {"intro":"", "birth_chart":"", "numbers":"", "convergence":"", "tension_or_silence":"", "timing":[""], "actions":[""], "confidence":""}
  },
  "remedies": {
    "intro":"",
    "behavioural":[{"pattern":"", "practice":"", "rhythm":"", "purpose":""}],
    "professional_structural":[""],
    "traditional_observance":[{"planet":"", "why":"", "observance":""}],
    "gemstone_note":""
  },
  "timing_map": [
    {"period":"", "astrology":"", "numerology":"", "combined_reading":"", "confidence":""},
    {"period":"", "astrology":"", "numerology":"", "combined_reading":"", "confidence":""},
    {"period":"", "astrology":"", "numerology":"", "combined_reading":"", "confidence":""},
    {"period":"", "astrology":"", "numerology":"", "combined_reading":"", "confidence":""},
    {"period":"", "astrology":"", "numerology":"", "combined_reading":"", "confidence":""}
  ],
  "major_shift": {"period":"", "reading":"", "confidence":""},
  "closing_summary":["", "", "", "", ""],
  "scope_limitations":["", "", "", ""]
}`;
}

function buildRepairPrompt(input, source, report, issues, wordCount) {
  return `Repair the Integrated Life Report JSON below so it follows the exact contract.

CLIENT
Name: ${input.name}
Date of birth: ${input.dob}
Time of birth: ${input.tob}
Place of birth: ${input.pob}
Main concern: ${input.question || 'Complete life clarity'}

VERIFIED SOURCE
${JSON.stringify(source, null, 2)}

CURRENT JSON
${JSON.stringify(report, null, 2)}

VALIDATION ISSUES
${issues.map(item => `- ${item}`).join('\n')}
Current rendered word count: ${wordCount}

RULES
- Return ONLY corrected valid JSON in the exact same schema used by CURRENT JSON.
- Preserve all supported facts already present unless they conflict with VERIFIED SOURCE.
- Do not add any unsupported factual claim.
- Make all required sections complete.
- Keep exactly seven fixed life areas.
- Keep exactly seven fixed astrology glance rows and four fixed numerology glance rows.
- Keep exactly five core timing rows corresponding to deterministic personal_years.
- Keep exactly five closing summary points and at least four scope limitations.
- Present the customer-facing systems only as Nadi Astrology and Vedic Numerology.
- This is a terminology/presentation change only. Do not recalculate or alter supplied values.
- Never mention KP, Chaldean, Pythagorean, AstrologyAPI, backend implementation names, internal source keys, or whether a separate Nadi calculation was or was not performed.
- primer.systems must begin directly with Nadi Astrology and Vedic Numerology and must not repeat the heading with phrases such as "Two systems are used here".
- Scope And Limitations must contain only useful customer-facing boundaries, not technical implementation notes.
- Target 4,500 to 5,300 rendered words; acceptable 4,000 to 5,800.
- If shortening, remove repetition before removing evidence, limitations, actions or timing.
- If expanding, add explanation only where supported by VERIFIED SOURCE. Never pad with generic astrology language.
- No em dashes.`;
}

async function callOpenAI(prompt, { timeoutMs = 170000, maxOutputTokens = 10000 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getPaidModel(),
        reasoning: { effort: 'none' },
        input: prompt,
        max_output_tokens: maxOutputTokens
      })
    });

    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (error) { data = { raw }; }

    if (!response.ok) throw new Error(data?.error?.message || data?.raw || `OpenAI returned ${response.status}`);
    const text = extractText(data);
    if (!text) throw new Error('OpenAI returned an empty report');
    return text;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Integrated Life Report generation took too long');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch (firstError) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('The structured report response was not valid JSON');
  }
}

function list(items) {
  return (Array.isArray(items) ? items : []).filter(Boolean).map(item => `• ${item}`).join('\n');
}

function normalizedLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+\d{4}$/, '');
}

function formatGlanceRows(rows, kind) {
  return (Array.isArray(rows) ? rows : []).filter(Boolean).map(item => {
    if (kind === 'numerology') {
      return `• ${item.label}: ${item.value}${item.ruling_planet ? ` (${item.ruling_planet})` : ''}\n  Derived from: ${item.derived_from || 'Verified calculation'}\n  ${item.plain_meaning || ''}`.trim();
    }
    return `• ${item.element}: ${item.position}\n  ${item.plain_meaning || ''}`.trim();
  }).join('\n\n');
}

function lifeAreaText(area = {}) {
  const timing = list(area.timing);
  const actions = list(area.actions);
  return [
    area.intro,
    `What your birth chart shows:\n${area.birth_chart || 'The verified source does not support a stronger chart-level statement here.'}`,
    `What your numbers show:\n${area.numbers || 'Numerology is silent on this point.'}`,
    `Where the two systems agree:\n${area.convergence || 'There is no strong independent convergence to claim here.'}`,
    `Where they pull against each other, or where one system is silent:\n${area.tension_or_silence || 'No meaningful tension is supported by the available data.'}`,
    timing ? `Timing:\n${timing}` : 'Timing:\nNo timing claim is made because the verified data does not support one.',
    `What to actually do about it:\n${actions || '• Use this section as reflection rather than a fixed prediction.'}`,
    `Confidence: ${area.confidence || 'Limited by the available verified data.'}`
  ].filter(Boolean).join('\n\n');
}

function remediesText(remedies = {}) {
  const behavioural = (Array.isArray(remedies.behavioural) ? remedies.behavioural : []).map(item =>
    `• Pattern: ${item.pattern}\n  Practice: ${item.practice}\n  Rhythm: ${item.rhythm}\n  Purpose: ${item.purpose}`
  ).join('\n\n');

  const traditional = (Array.isArray(remedies.traditional_observance) ? remedies.traditional_observance : []).map(item =>
    `• ${item.planet}: ${item.why}\n  Optional observance: ${item.observance}`
  ).join('\n\n');

  return [
    remedies.intro,
    `Priority one, behavioural:\n${behavioural || '• No additional behavioural remedy was supported.'}`,
    `Priority two, professional and structural:\n${list(remedies.professional_structural) || '• No additional structural remedy was supported.'}`,
    `Priority three, optional traditional observance:\n${traditional || '• No traditional observance is necessary to use the practical guidance in this report.'}`,
    `Gemstones:\n${remedies.gemstone_note || 'No gemstone is recommended in this report. A gemstone prescription requires a separate dedicated planetary-strength assessment.'}`
  ].filter(Boolean).join('\n\n');
}

function timingMapText(items, majorShift) {
  const core = (Array.isArray(items) ? items : []).filter(Boolean).map(item =>
    `${item.period}\nAstrological chapter: ${item.astrology}\nNumerological year: ${item.numerology}\nCombined reading: ${item.combined_reading}\nConfidence: ${item.confidence}`
  ).join('\n\n');

  const shift = majorShift && majorShift.period && majorShift.reading
    ? `\n\nMajor shift beyond the five-year map:\n${majorShift.period}\n${majorShift.reading}\nConfidence: ${majorShift.confidence || 'Based on the verified Dasha source.'}`
    : '';

  return `${core}${shift}`.trim();
}

function reportTextFromJson(report) {
  const primer = report.primer || {};
  const ideas = primer.four_ideas || {};
  const glance = report.glance || {};
  const areas = report.life_areas || {};

  return [
    `1. How To Read This Report\n${primer.purpose || ''}\n\nThe two systems used in your report\n${primer.systems || ''}\n\nThe four ideas you need\n1. Houses are life departments\n${ideas.houses || ''}\n\n2. Planets are the officers in charge\n${ideas.planets || ''}\n\n3. Dasha is whose turn it is\n${ideas.dasha || ''}\n\n4. The chain of command\n${ideas.chain_of_command || ''}\n\nThe convergence method\n${primer.convergence_method || ''}\n\nWhat this report will not do\n${list(primer.limits)}\n\n${primer.disclaimer || ''}`,
    `2. Your Chart And Numbers At A Glance\nThe astrological layer\n${formatGlanceRows(glance.astrology, 'astrology')}\n\nThe numerological layer\n${formatGlanceRows(glance.numerology, 'numerology')}\n\nThe headline finding\n${glance.headline_finding || ''}`,
    `3. Personal Nature: Strengths And Weaknesses\n${lifeAreaText(areas.personal_nature)}`,
    `4. Past Life Karma\n${lifeAreaText(areas.past_life_karma)}`,
    `5. Finances\n${lifeAreaText(areas.finances)}`,
    `6. Marriage And Partnership\n${lifeAreaText(areas.marriage)}`,
    `7. Health And Constitution\n${lifeAreaText(areas.health)}`,
    `8. Children\n${lifeAreaText(areas.children)}`,
    `9. Property Purchase\n${lifeAreaText(areas.property)}`,
    `10. Remedies\n${remediesText(report.remedies)}`,
    `11. Your Timing Map\n${timingMapText(report.timing_map, report.major_shift)}`,
    `12. Closing Summary\n${list(report.closing_summary)}`,
    `13. Scope And Limitations\n${list(report.scope_limitations)}`
  ].join('\n\n');
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function validateReport(report) {
  const issues = [];

  if (!report || typeof report !== 'object') return ['Report JSON is missing.'];

  const primer = report.primer || {};
  const ideas = primer.four_ideas || {};
  ['purpose', 'systems', 'convergence_method', 'disclaimer'].forEach(key => {
    if (!String(primer[key] || '').trim()) issues.push(`Primer field ${key} is missing.`);
  });
  ['houses', 'planets', 'dasha', 'chain_of_command'].forEach(key => {
    if (!String(ideas[key] || '').trim()) issues.push(`Primer four_ideas.${key} is missing.`);
  });
  if (!Array.isArray(primer.limits) || primer.limits.filter(Boolean).length < 4) {
    issues.push('Primer must include at least four explicit limits.');
  }
  if (/^\s*(?:the\s+)?two\s+systems\b/i.test(String(primer.systems || ''))) {
    issues.push('Primer systems repeats the section heading instead of beginning directly with the system names.');
  }
  if (!/Nadi Astrology/i.test(String(primer.systems || '')) || !/Vedic Numerology/i.test(String(primer.systems || ''))) {
    issues.push('Primer systems must identify Nadi Astrology and Vedic Numerology.');
  }

  const astrologyRows = Array.isArray(report.glance?.astrology) ? report.glance.astrology : [];
  const astrologyLabels = astrologyRows.map(item => normalizedLabel(item?.element));
  if (astrologyRows.length !== 7) issues.push('Astrology glance must contain exactly seven rows.');
  REQUIRED_ASTROLOGY_GLANCE_ROWS.forEach(label => {
    if (!astrologyLabels.includes(label)) issues.push(`Astrology glance row missing: ${label}.`);
  });

  const numerologyRows = Array.isArray(report.glance?.numerology) ? report.glance.numerology : [];
  const numerologyLabels = numerologyRows.map(item => normalizedLabel(item?.label));
  if (numerologyRows.length !== 4) issues.push('Numerology glance must contain exactly four rows.');
  REQUIRED_NUMEROLOGY_GLANCE_ROWS.forEach(label => {
    if (!numerologyLabels.includes(label)) issues.push(`Numerology glance row missing: ${label}.`);
  });
  if (!String(report.glance?.headline_finding || '').trim()) issues.push('Headline finding is missing.');

  const areas = report.life_areas || {};
  LIFE_AREA_KEYS.forEach(key => {
    const area = areas[key];
    if (!area || typeof area !== 'object') {
      issues.push(`Life area ${key} is missing.`);
      return;
    }
    ['intro', 'birth_chart', 'numbers', 'convergence', 'tension_or_silence', 'confidence'].forEach(field => {
      if (!String(area[field] || '').trim()) issues.push(`Life area ${key}.${field} is missing.`);
    });
    if (!Array.isArray(area.actions) || !area.actions.filter(Boolean).length) issues.push(`Life area ${key}.actions is missing.`);
    if (!Array.isArray(area.timing)) issues.push(`Life area ${key}.timing must be an array.`);
  });

  if (!report.remedies || typeof report.remedies !== 'object') issues.push('Remedies section is missing.');
  if (!Array.isArray(report.timing_map) || report.timing_map.length !== 5) issues.push('Timing map must contain exactly five core rows.');
  if (!Array.isArray(report.closing_summary) || report.closing_summary.filter(Boolean).length !== 5) issues.push('Closing Summary must contain exactly five points.');
  if (!Array.isArray(report.scope_limitations) || report.scope_limitations.filter(Boolean).length < 4) issues.push('Scope And Limitations must contain at least four points.');

  const customerFacingText = reportTextFromJson(report);
  CUSTOMER_FACING_FORBIDDEN_TERMS.forEach(({ pattern, label }) => {
    if (pattern.test(customerFacingText)) issues.push(`Customer-facing report must not mention ${label}.`);
  });

  return issues;
}

async function generatePaidReportV2(input, { includePdfs = false } = {}) {
  const startedAt = Date.now();
  const reportDate = new Date();
  const sourceBundle = await generateSourceBundle(input, { includePdfs });
  const deterministicNumerology = calculateNumerology({
    name: input.name,
    dob: input.dob,
    reportDate
  });
  const verification = verifySourceBundle(sourceBundle, deterministicNumerology, { reportDate });
  const requireVerifiedSource = process.env.PAID_REPORT_REQUIRE_VERIFIED_SOURCE === 'true';
  if (requireVerifiedSource && !verification.ready_for_personal_life_blueprint) {
    throw new Error(`Source verification failed: ${verification.blocking_issues.join(' | ')}`);
  }

  const compact = compactSource(sourceBundle, deterministicNumerology, verification);
  const raw = await callOpenAI(buildPrompt(input, compact), { timeoutMs: 170000, maxOutputTokens: 10000 });
  let reportJson = parseJson(raw);
  let reportText = reportTextFromJson(reportJson);
  let issues = validateReport(reportJson);
  let wordCount = countWords(reportText);

  if (wordCount < 4000 || wordCount > 5800) {
    issues.push(`Rendered report word count ${wordCount} is outside the 4,000 to 5,800 contract.`);
  }

  if (issues.length) {
    const repairedRaw = await callOpenAI(
      buildRepairPrompt(input, compact, reportJson, issues, wordCount),
      { timeoutMs: 70000, maxOutputTokens: 10000 }
    );
    reportJson = parseJson(repairedRaw);
    reportText = reportTextFromJson(reportJson);
    issues = validateReport(reportJson);
    wordCount = countWords(reportText);
    if (wordCount < 4000 || wordCount > 5800) {
      issues.push(`Repaired report word count ${wordCount} is outside the 4,000 to 5,800 contract.`);
    }
  }

  if (issues.length) {
    throw new Error(`Integrated Life Report contract validation failed: ${issues.slice(0, 6).join(' | ')}`);
  }

  return {
    generated: true,
    model: getPaidModel(),
    report_contract_version: 'integrated-life-report-v1',
    report_json: reportJson,
    report_text: reportText,
    report_word_count: wordCount,
    verification,
    astrology_data: {
      provider: 'AstrologyAPI',
      note: 'Prepared from the submitted birth details and verified astrological source data.',
      planets: sourceBundle.planets,
      kp_planets: sourceBundle.kp_planets,
      kp_house_cusps: sourceBundle.kp_house_cusps,
      kp_planet_significators: sourceBundle.kp_planet_significators,
      kp_house_significators: sourceBundle.kp_house_significators,
      current_vdasha: sourceBundle.current_vdasha,
      current_vdasha_all: sourceBundle.current_vdasha_all,
      charts: sourceBundle.charts,
      chart_images: sourceBundle.chart_images
    },
    numerology_data: {
      provider: 'backend_deterministic_chaldean_with_astrologyapi_cross_check',
      deterministic: deterministicNumerology,
      numerological_numbers: sourceBundle.numerological_numbers,
      numero_table: sourceBundle.numero_table
    },
    source_pdfs: sourceBundle.pdfs,
    source_bundle: sourceBundle,
    generation_ms: Date.now() - startedAt,
    insights: {
      concerns: input.question ? [input.question] : [],
      source_verification: verification
    }
  };
}

module.exports = {
  generatePaidReportV2,
  getPaidModel,
  reportTextFromJson,
  validateReport,
  countWords
};
