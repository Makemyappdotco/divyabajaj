const crypto = require('crypto');
const {
  getPlanets,
  getKpPlanets,
  getKpHouseCusps,
  getKpPlanetSignificators,
  getKpHouseSignificators,
  getCurrentVdasha,
  getCurrentVdashaAll,
  getNumerologicalNumbers,
  getNumeroTable
} = require('./astrologyApiV2');
const { calculateNumerology } = require('./numerologyEngine');
const { doubleConfirmation, scoreDominantPlanets } = require('./dominantPlanetScoring');
const { verifySourceBundle } = require('./reportVerification');
const { createStructuredResponse, getResponse } = require('./openAiResponses');

const CONTRACT_VERSION = 'client-master-blueprint-live-v2-background';
const CONFIDENCE = ['Very High', 'High', 'Medium', 'Not claimed'];

function getPaidModel() {
  return process.env.OPENAI_PAID_MODEL || 'gpt-5.5';
}

function str(description = '') { return { type: 'string', description }; }
function strArray(description = '', minItems, maxItems) {
  const schema = { type: 'array', items: { type: 'string' }, description };
  if (Number.isInteger(minItems)) schema.minItems = minItems;
  if (Number.isInteger(maxItems)) schema.maxItems = maxItems;
  return schema;
}
function obj(properties, required = Object.keys(properties), description = '') {
  return { type: 'object', additionalProperties: false, properties, required, description };
}
function confidence() { return { type: 'string', enum: CONFIDENCE }; }

function lifeAreaSchema() {
  return obj({
    title: str(),
    subtitle: str(),
    intro: str('Short plain-English explanation of how this area is judged.'),
    chart_reading: strArray('Exactly 3 to 5 substantive chart paragraphs.', 3, 5),
    planet_roles: strArray('2 to 5 concise statements classifying relevant planets as event-promoting, facilitator, obstructive or neutral.', 2, 5),
    numerology_reading: strArray('Exactly 2 to 3 independently calculated numerology paragraphs.', 2, 3),
    synthesis: str(),
    confidence: confidence(),
    double_confirmation_callout: obj({ title: str(), explanation: str() }),
    real_life_example: str('A recognisable 4 to 6 sentence scenario.'),
    actions: strArray('3 to 5 specific executable actions.', 3, 5)
  });
}

const ROOT_PROPERTIES = {
  chart_verification: obj({
    status: { type: 'string', enum: ['verified', 'verification_required'] },
    ascendant: str(), moon_nakshatra: str(), moon_nakshatra_lord: str(),
    current_mahadasha: str(), current_antardasha: str(), current_pratyantar: str(),
    current_sookshma: str(), current_prana: str(), discrepancies: strArray(), timing_limitation: str()
  }),
  cover: obj({ report_title: str(), client_name: str(), birth_details: str(), report_date: str(), methodology: str() }),
  before_you_begin: obj({
    map_and_clock: str(), numerology_role: str(), honest_confidence_promise: str(),
    no_fear_promise: str(), professional_advice_limit: str()
  }),
  numbers_at_a_glance: {
    type: 'array', minItems: 4, maxItems: 4,
    items: obj({
      label: { type: 'string', enum: ['Psychic Number', 'Destiny Number', 'Name Number', 'Personal Year'] },
      number: { type: 'integer', minimum: 1, maximum: 9 }, planet: str(), meaning: str()
    })
  },
  big_picture: obj({
    dominant_planets: {
      type: 'array', minItems: 2, maxItems: 4,
      items: obj({ planet: str(), score: { type: 'number' }, why_it_ranked: str() })
    },
    double_confirmation: obj({
      score: { type: 'integer', minimum: 0, maximum: 3 },
      label: { type: 'string', enum: ['Triple Confirmation', 'Strong Agreement', 'Partial Agreement', 'Divergent Design'] },
      matched_planets: strArray(), outlier_planets: strArray(), explanation: str(), central_instruction: str()
    })
  }),
  current_period: obj({
    periods: {
      type: 'array', minItems: 5, maxItems: 5,
      items: obj({
        level: { type: 'string', enum: ['Mahadasha', 'Antardasha', 'Pratyantar', 'Sookshma', 'Prana'] },
        planet: str(), start: str(), end: str(), instruction: str(), confidence: confidence()
      })
    },
    summary: str(), practical_instruction: str()
  }),
  personal_nature: obj({ area: lifeAreaSchema(), weaknesses: strArray('At least two specific genuine weaknesses.', 2, 4) }),
  past_life_karma: obj({ area: lifeAreaSchema(), symbolic_disclaimer: str() }),
  finances: obj({
    area: lifeAreaSchema(), earning_2_10_11: str(), accumulation_2_11: str(), drains_6_8_12: str(), dominant_financial_pattern: str()
  }),
  marriage: obj({ area: lifeAreaSchema(), event_distinctions: obj({ finalisation: str(), engagement: str(), marriage: str() }) }),
  health: obj({ area: lifeAreaSchema(), loaded_6_8_12_check: str(), safety_line: str() }),
  children: obj({ area: lifeAreaSchema(), obstruction_1_4_10_check: str(), medical_line: str() }),
  property: obj({ area: lifeAreaSchema(), leading_planet_buying_style: str() }),
  remedies: obj({
    items: {
      type: 'array', minItems: 4, maxItems: 6,
      items: obj({
        priority: { type: 'integer', minimum: 1, maximum: 6 }, planet_or_pattern: str(),
        specific_issue: str(), what_to_do: str(), how_often: str()
      })
    },
    one_thing: str()
  }),
  confidence_audit: {
    type: 'array', minItems: 5, maxItems: 9,
    items: obj({ finding: str(), confidence: confidence(), basis: str(), limitation: str() })
  },
  closing: obj({
    finer_timing_precision: str(), next_mahadasha_change: str(), gemstones_and_individual_prescriptions: str(),
    final_highest_leverage_action: str(), closing_note: str()
  })
};

const STAGES = [
  {
    id: 'foundation',
    keys: ['chart_verification', 'cover', 'before_you_begin', 'numbers_at_a_glance', 'big_picture', 'current_period', 'personal_nature', 'past_life_karma'],
    target: 'about 3,000 to 3,500 useful words'
  },
  {
    id: 'core_life_areas',
    keys: ['finances', 'marriage', 'health'],
    target: 'about 3,000 to 3,500 useful words'
  },
  {
    id: 'completion',
    keys: ['children', 'property', 'remedies', 'confidence_audit', 'closing'],
    target: 'about 2,800 to 3,300 useful words'
  }
];

function responseFormatFor(stage) {
  const properties = {};
  stage.keys.forEach(key => { properties[key] = ROOT_PROPERTIES[key]; });
  return {
    type: 'json_schema',
    name: `divya_blueprint_${stage.id}_v2`,
    strict: true,
    schema: obj(properties)
  };
}

function settledResult(settled) {
  return settled.status === 'fulfilled'
    ? { ok: true, data: settled.value }
    : { ok: false, error: settled.reason?.message || 'Unknown AstrologyAPI error' };
}

async function buildLeanSourceBundle(input) {
  const jobs = await Promise.allSettled([
    getPlanets(input),
    getKpPlanets(input),
    getKpHouseCusps(input),
    getKpPlanetSignificators(input),
    getKpHouseSignificators(input),
    getCurrentVdasha(input),
    getCurrentVdashaAll(input),
    getNumerologicalNumbers(input),
    getNumeroTable(input)
  ]);
  let i = 0;
  return {
    mode: 'live-lean',
    generated_at: new Date().toISOString(),
    planets: settledResult(jobs[i++]),
    kp_planets: settledResult(jobs[i++]),
    kp_house_cusps: settledResult(jobs[i++]),
    kp_planet_significators: settledResult(jobs[i++]),
    kp_house_significators: settledResult(jobs[i++]),
    current_vdasha: settledResult(jobs[i++]),
    current_vdasha_all: settledResult(jobs[i++]),
    numerological_numbers: settledResult(jobs[i++]),
    numero_table: settledResult(jobs[i++]),
    charts: {}, chart_images: {}, pdfs: {}
  };
}

function compactResult(result) {
  return result?.ok ? result.data : { unavailable: result?.error || 'Source unavailable' };
}

function compactKpPlanet(row = {}) {
  return {
    planet_name: row.planet_name || row.name || '', sign: row.sign || '', house: row.house ?? null,
    degree: row.degree ?? null, norm_degree: row.norm_degree ?? row.normDegree ?? null,
    formatted_degree: row.formatted_degree || '', sign_lord: row.sign_lord || '',
    nakshatra: row.nakshatra || '', nakshatra_lord: row.nakshatra_lord || row.nakshatraLord || '',
    sub_lord: row.sub_lord || '', sub_sub_lord: row.sub_sub_lord || ''
  };
}

function buildVerifiedContext(bundle, deterministicNumerology, verification, dominant, confirmation, reportDate) {
  const kpPlanets = compactResult(bundle.kp_planets);
  return {
    report_date: reportDate.toISOString(),
    verification,
    deterministic_numerology: deterministicNumerology,
    dominant_planets: dominant,
    double_confirmation: confirmation,
    kp_planets: Array.isArray(kpPlanets) ? kpPlanets.map(compactKpPlanet) : kpPlanets,
    kp_house_cusps: compactResult(bundle.kp_house_cusps),
    kp_planet_significators: compactResult(bundle.kp_planet_significators),
    kp_house_significators: compactResult(bundle.kp_house_significators),
    current_vdasha: compactResult(bundle.current_vdasha),
    current_vdasha_all: compactResult(bundle.current_vdasha_all),
    numerology_provider_cross_check: {
      numerological_numbers: compactResult(bundle.numerological_numbers),
      numero_table: compactResult(bundle.numero_table)
    },
    transit: {
      available: false,
      rule: 'Verified current-residence transit confirmation is not connected. Exact external event dates must be Not claimed.'
    }
  };
}

function basePrompt(input, source) {
  return `You are writing Divya Bajaj's paid PERSONAL LIFE BLUEPRINT. The reader has paid real money and has zero technical astrology knowledge. This is not a generic horoscope, textbook or sales brochure. Be specific, honest, practical and genuinely useful.

CLIENT
Name: ${input.name}
Gender: ${input.gender}
Date of birth: ${input.dob}
Time of birth: ${input.tob}
Place of birth: ${input.pob}
Birth-time accuracy: ${input.birth_time_accuracy || 'not stated'}
Main concern: ${input.question || 'Complete life clarity'}

VERIFIED SOURCE AND BACKEND CALCULATIONS
${JSON.stringify(source, null, 2)}

SOURCE RULE
Use only verified source and backend calculations. Never invent a degree, cusp, house, Star Lord, Sub Lord, Sub-Sub Lord, Dasha date, transit position or numerology number. Missing precision must be Not claimed. Never hide a discrepancy.

CLIENT MASTER METHOD
Internally follow Houses -> Significators -> Star Lord -> Sub Lord -> Sub-Sub Lord -> Dasha/Bhukti/Antara -> Transit. The governing logic is Promise -> Dasha activation -> Transit confirmation. Current transit confirmation is unavailable, so never fabricate exact external event dates.

SEVEN REQUIRED AREAS
Personal Nature: Ascendant, Ascendant lord, Moon and verified planets affecting Ascendant.
Past Life Karma: Ketu, Rahu, houses 5, 9, 12. Symbolic only, never historical fact.
Finances: 2+10+11 earning; 2+11 accumulation; 6/8/12 drains. State which side dominates.
Marriage: 2+7+11. Finalisation, engagement and marriage are separate events.
Health: 6+8+12. Explicitly check whether one planet covers all three. Never diagnose.
Children: 2+5+11. Check 1+4+10 obstruction separately. Never make fertility claims.
Property: 4+11+12. Mars/Saturn are natural significators only; verified leading planet defines buying style.

MANDATORY RHYTHM FOR EACH LIFE AREA
Short intro -> 3 to 5 birth-chart paragraphs -> planet roles -> 2 to 3 independently calculated numerology paragraphs -> where the systems agree/disagree -> explicit confidence -> Double Confirmation or genuine-tension callout -> one recognisable 4 to 6 sentence real-life example -> 3 to 5 executable actions.

DOUBLE CONFIRMATION
Use the supplied deterministic ranking and Psychic, Destiny and Name Number planet mapping. 3/3 Triple Confirmation, 2/3 Strong Agreement, 1/3 Partial Agreement, 0/3 Divergent Design. Never manufacture a match. Genuine disagreement is valuable.

VOICE
Second person. Simple natural Indian English. Explain technical terms immediately. Use useful analogies. Sound like Divya explaining one person's chart across a table. No padding, flattery, mystical fear, generic AI language, textbook tone or em dashes. Do not over-focus on the client's main concern at the expense of the seven required areas.

SAFETY
Health must include exactly: 'Use this as a prompt to book the check-up, never as a reason to skip one.'
Children must never state whether the client will or will not have children and must say conception and pregnancy questions belong to qualified medical professionals.
Past-life material is symbolic only. No death, criminal, violence or scandal prediction. No gemstone recommendation, paid ritual or product. This report does not replace medical, legal, financial or psychological advice.

REMEDIES AND CLOSING
Give 4 to 6 priority remedies only, each tied to a problem already established, with planet/pattern, issue, exact action and frequency. Include 'If you do only one thing from this report'. Closing must honestly explain finer timing limits, next verified Mahadasha transition, and why gemstone/individual prescriptions require separate assessment. Consultation must arise naturally from real limits, never fear or scarcity.`;
}

function stagePrompt(input, source, stage) {
  return `${basePrompt(input, source)}

PARALLEL WRITING STAGE: ${stage.id}
Return ONLY these root fields: ${stage.keys.join(', ')}.
Write ${stage.target}. This stage will be merged with two other independently generated sections, so make every assigned section complete and self-contained without repeating sections assigned elsewhere. Return only the strict JSON required by the schema.`;
}

function jobSecret() {
  const secret = process.env.REPORT_JOB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENAI_API_KEY;
  if (!secret) throw new Error('No server secret is available for report job signing');
  return secret;
}

function signJobState(state) {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const signature = crypto.createHmac('sha256', jobSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readJobState(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) throw new Error('Invalid report job token');
  const expected = crypto.createHmac('sha256', jobSecret()).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid report job signature');
  const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const age = Date.now() - new Date(state.created_at).getTime();
  if (!Number.isFinite(age) || age > 30 * 60 * 1000) throw new Error('This report job has expired. Please generate it again.');
  return state;
}

function pdfNumbers(deterministic = {}) {
  return {
    ruling_number: deterministic.psychic_number || '',
    destiny_number: deterministic.destiny_number || '',
    name_number: deterministic.name_number || '',
    personal_year: deterministic.personal_year || ''
  };
}

function lines(items) {
  return (Array.isArray(items) ? items : []).filter(Boolean).map(item => `- ${item}`).join('\n');
}
function paragraphs(items) {
  return (Array.isArray(items) ? items : []).filter(Boolean).join('\n\n');
}
function areaText(number, name, wrapper, extras = []) {
  const area = wrapper?.area || wrapper || {};
  return [
    `${number}. ${name}`, area.subtitle || '', area.intro || '',
    'What your birth chart says', paragraphs(area.chart_reading),
    area.planet_roles?.length ? `How the relevant planets behave here\n${lines(area.planet_roles)}` : '',
    ...extras.filter(Boolean),
    'What your numbers say', paragraphs(area.numerology_reading),
    'Where the two agree', area.synthesis || '', `Confidence: ${area.confidence || 'Not claimed'}`,
    area.double_confirmation_callout
      ? `DOUBLE CONFIRMATION / REAL TENSION\n${area.double_confirmation_callout.title}\n${area.double_confirmation_callout.explanation}`
      : '',
    `Example: what this looks like in real life\n${area.real_life_example || ''}`,
    `What to actually do\n${lines(area.actions)}`
  ].filter(Boolean).join('\n\n');
}

function reportTextFromJson(report, input) {
  const verification = report.chart_verification || {};
  const cover = report.cover || {};
  const before = report.before_you_begin || {};
  const big = report.big_picture || {};
  const current = report.current_period || {};
  const numberRows = (report.numbers_at_a_glance || []).map(item => `${item.label}: ${item.number} · ${item.planet}\n${item.meaning}`).join('\n\n');
  const dominantRows = (big.dominant_planets || []).map(item => `${item.planet} · Score ${item.score}\n${item.why_it_ranked}`).join('\n\n');
  const periods = (current.periods || []).map(item => `${item.level}: ${item.planet}\n${item.start} to ${item.end}\n${item.instruction}\nConfidence: ${item.confidence}`).join('\n\n');
  const remedies = (report.remedies?.items || []).map(item => `${item.priority}. ${item.planet_or_pattern}\nIssue: ${item.specific_issue}\nWhat to do: ${item.what_to_do}\nHow often: ${item.how_often}`).join('\n\n');
  const audit = (report.confidence_audit || []).map(item => `${item.finding}\nConfidence: ${item.confidence}\nBasis: ${item.basis}\nLimitation: ${item.limitation}`).join('\n\n');

  return [
    `CHART VERIFICATION\nStatus: ${verification.status}\nAscendant: ${verification.ascendant}\nMoon nakshatra: ${verification.moon_nakshatra}\nMoon nakshatra lord: ${verification.moon_nakshatra_lord}\nCurrent Mahadasha: ${verification.current_mahadasha}\nCurrent Antardasha: ${verification.current_antardasha}\nCurrent Pratyantar: ${verification.current_pratyantar}\nCurrent Sookshma: ${verification.current_sookshma}\nCurrent Prana: ${verification.current_prana}\nTiming limitation: ${verification.timing_limitation}`,
    `PERSONAL LIFE BLUEPRINT\n${cover.client_name || input.name}\n${cover.birth_details}\nReport date: ${cover.report_date}\n${cover.methodology}`,
    `BEFORE YOU BEGIN: HOW TO READ THIS REPORT\n${before.map_and_clock}\n\n${before.numerology_role}\n\n${before.honest_confidence_promise}\n${before.no_fear_promise}\n${before.professional_advice_limit}`,
    `YOUR NUMBERS AT A GLANCE\n${numberRows}`,
    `THE BIG PICTURE: WHERE EVERYTHING AGREES\n${dominantRows}\n\nDouble Confirmation: ${big.double_confirmation?.score}/3 · ${big.double_confirmation?.label}\n${big.double_confirmation?.explanation}\n\nCentral instruction: ${big.double_confirmation?.central_instruction}`,
    `WHERE YOU ARE RIGHT NOW\n${periods}\n\n${current.summary}\n\nWhat this period instructs\n${current.practical_instruction}`,
    areaText(1, 'PERSONAL NATURE', report.personal_nature, [report.personal_nature?.weaknesses?.length ? `Weaknesses this report will not flatter away\n${lines(report.personal_nature.weaknesses)}` : '']),
    areaText(2, 'PAST LIFE KARMA', report.past_life_karma, [`Important\n${report.past_life_karma?.symbolic_disclaimer || ''}`]),
    areaText(3, 'FINANCES', report.finances, [
      `Earning 2+10+11\n${report.finances?.earning_2_10_11 || ''}`,
      `Accumulation 2+11\n${report.finances?.accumulation_2_11 || ''}`,
      `Drains 6/8/12\n${report.finances?.drains_6_8_12 || ''}`,
      `Dominant financial pattern\n${report.finances?.dominant_financial_pattern || ''}`
    ]),
    areaText(4, 'MARRIAGE', report.marriage, [`Finalisation\n${report.marriage?.event_distinctions?.finalisation || ''}\n\nEngagement\n${report.marriage?.event_distinctions?.engagement || ''}\n\nMarriage\n${report.marriage?.event_distinctions?.marriage || ''}`]),
    areaText(5, 'HEALTH', report.health, [`6+8+12 loading check\n${report.health?.loaded_6_8_12_check || ''}\n\nHealth safety note\n${report.health?.safety_line || ''}`]),
    areaText(6, 'CHILDREN', report.children, [`Classical 1+4+10 obstruction check\n${report.children?.obstruction_1_4_10_check || ''}\n\nChildren and medical questions\n${report.children?.medical_line || ''}`]),
    areaText(7, 'PROPERTY', report.property, [`How the leading planet shapes your buying style\n${report.property?.leading_planet_buying_style || ''}`]),
    `REMEDIES\n${remedies}\n\nIF YOU DO ONLY ONE THING FROM THIS REPORT\n${report.remedies?.one_thing || ''}`,
    `WHAT WE ARE CONFIDENT ABOUT, AND WHAT WE ARE NOT\n${audit}`,
    `WHERE THIS REPORT ENDS, AND WHAT COMES NEXT\nFiner timing precision\n${report.closing?.finer_timing_precision || ''}\n\nYour next Mahadasha change\n${report.closing?.next_mahadasha_change || ''}\n\nGemstones and individual prescriptions\n${report.closing?.gemstones_and_individual_prescriptions || ''}\n\nHighest-leverage action\n${report.closing?.final_highest_leverage_action || ''}\n\n${report.closing?.closing_note || ''}`
  ].filter(Boolean).join('\n\n').replace(/—/g, ' - ');
}

function expectedDashaPlanet(verification, level) {
  return verification?.verified_facts?.dasha?.[level]?.direct_planet || verification?.verified_facts?.dasha?.[level]?.date_selected_planet || '';
}

function applyDeterministicFacts(report, state) {
  const deterministic = state.deterministic_numerology;
  const confirmation = state.double_confirmation;
  const dominant = state.dominant_planets;
  const verification = state.verification;
  const facts = verification?.verified_facts || {};

  const numberMap = {
    'Psychic Number': [deterministic.psychic_number, deterministic.number_planets.psychic],
    'Destiny Number': [deterministic.destiny_number, deterministic.number_planets.destiny],
    'Name Number': [deterministic.name_number, deterministic.number_planets.name],
    'Personal Year': [deterministic.personal_year, deterministic.number_planets.personal_year]
  };
  report.numbers_at_a_glance = (report.numbers_at_a_glance || []).map(item => {
    const expected = numberMap[item.label];
    return expected ? { ...item, number: expected[0], planet: expected[1] } : item;
  });

  if (report.big_picture) {
    report.big_picture.dominant_planets = (dominant?.dominant_planets || []).map(item => ({
      planet: item.planet,
      score: item.score,
      why_it_ranked: (item.reasons || []).join(' ')
    }));
    report.big_picture.double_confirmation = {
      ...(report.big_picture.double_confirmation || {}),
      score: confirmation.score,
      label: confirmation.label,
      matched_planets: confirmation.matched_planets,
      outlier_planets: confirmation.outlier_planets
    };
  }

  if (report.chart_verification) {
    report.chart_verification.status = verification.status;
    report.chart_verification.ascendant = [facts.ascendant?.sign, facts.ascendant?.formatted_degree || facts.ascendant?.norm_degree].filter(Boolean).join(' ');
    report.chart_verification.moon_nakshatra = facts.moon?.nakshatra || report.chart_verification.moon_nakshatra;
    report.chart_verification.moon_nakshatra_lord = facts.moon?.nakshatra_lord || report.chart_verification.moon_nakshatra_lord;
    report.chart_verification.current_mahadasha = expectedDashaPlanet(verification, 'major');
    report.chart_verification.current_antardasha = expectedDashaPlanet(verification, 'minor');
    report.chart_verification.current_pratyantar = expectedDashaPlanet(verification, 'sub_minor');
    report.chart_verification.current_sookshma = expectedDashaPlanet(verification, 'sub_sub_minor');
    report.chart_verification.current_prana = expectedDashaPlanet(verification, 'sub_sub_sub_minor');
    report.chart_verification.discrepancies = verification.blocking_issues || [];
    report.chart_verification.timing_limitation = 'Verified current-residence transit confirmation is not connected. Exact external event dates are Not claimed.';
  }

  const levelMap = {
    Mahadasha: 'major', Antardasha: 'minor', Pratyantar: 'sub_minor', Sookshma: 'sub_sub_minor', Prana: 'sub_sub_sub_minor'
  };
  if (Array.isArray(report.current_period?.periods)) {
    report.current_period.periods = report.current_period.periods.map(period => {
      const key = levelMap[period.level];
      const verified = verification?.verified_facts?.dasha?.[key] || {};
      return {
        ...period,
        planet: verified.direct_planet || verified.date_selected_planet || period.planet,
        start: verified.direct_start || verified.date_selected_start || period.start,
        end: verified.direct_end || verified.date_selected_end || period.end
      };
    });
  }
  if (report.cover) {
    report.cover.client_name = state.input.name;
    report.cover.report_date = String(state.report_date || '').slice(0, 10);
  }
  return report;
}

function assertQa(report, reportText, state) {
  const failures = [];
  const areaNames = ['personal_nature', 'past_life_karma', 'finances', 'marriage', 'health', 'children', 'property'];
  areaNames.forEach(name => {
    const area = report?.[name]?.area;
    if (!area) failures.push(`${name} missing`);
    else {
      if ((area.chart_reading || []).length < 3) failures.push(`${name} chart reading too short`);
      if ((area.numerology_reading || []).length < 2) failures.push(`${name} numerology reading too short`);
      if (!area.real_life_example) failures.push(`${name} real-life example missing`);
      if ((area.actions || []).length < 3) failures.push(`${name} actions missing`);
      if (!area.double_confirmation_callout?.explanation) failures.push(`${name} Double Confirmation/tension callout missing`);
    }
  });
  if ((report.personal_nature?.weaknesses || []).length < 2) failures.push('Personal Nature needs at least two genuine weaknesses');
  if (!/symbolic/i.test(report.past_life_karma?.symbolic_disclaimer || '')) failures.push('Past Life Karma symbolic disclaimer missing');
  if (!/book the check-up, never as a reason to skip one/i.test(report.health?.safety_line || '')) failures.push('Mandatory health safety line missing');
  if (!/qualified medical professionals/i.test(report.children?.medical_line || '')) failures.push('Children medical line missing');
  if ((report.remedies?.items || []).length < 4 || (report.remedies?.items || []).length > 6) failures.push('Remedy count must be 4 to 6');
  if (!(report.confidence_audit || []).some(item => item.confidence === 'Not claimed')) failures.push('Confidence audit needs at least one Not claimed row');
  if (report.big_picture?.double_confirmation?.score !== state.double_confirmation.score) failures.push('Double Confirmation score changed from deterministic calculation');
  if (/recommend(?:ed|ing)?\s+(?:a\s+)?(?:gemstone|ruby|emerald|sapphire|diamond|pearl|coral)/i.test(reportText)) failures.push('Gemstone recommendation detected');
  if (/guaranteed marriage|guaranteed money|you will have children|you will not have children/i.test(reportText)) failures.push('Unsupported guarantee detected');
  if (reportText.includes('—')) failures.push('Em dash detected');
  if (failures.length) throw new Error(`Paid Full Blueprint failed client-master QA: ${failures.join(' | ')}`);
  return {
    passed: true,
    checks: 14,
    failures: [],
    word_count: reportText.split(/\s+/).filter(Boolean).length
  };
}

async function preparePaidReport(input) {
  const reportDate = new Date();
  const sourceBundle = await buildLeanSourceBundle(input);
  const deterministicNumerology = calculateNumerology({ name: input.name, dob: input.dob, reportDate });
  const verification = verifySourceBundle(sourceBundle, deterministicNumerology, { reportDate });
  if (!verification.ready_for_personal_life_blueprint) {
    throw new Error(`Full Blueprint source verification failed: ${verification.blocking_issues.join(' | ')}`);
  }
  const dominant = scoreDominantPlanets(sourceBundle, { limit: 3 });
  const confirmation = doubleConfirmation(dominant, deterministicNumerology);
  const context = buildVerifiedContext(sourceBundle, deterministicNumerology, verification, dominant, confirmation, reportDate);
  return { reportDate, sourceBundle, deterministicNumerology, verification, dominant, confirmation, context };
}

async function startPaidReportV2(input) {
  const prepared = await preparePaidReport(input);
  const jobId = crypto.randomUUID();
  const responses = await Promise.all(STAGES.map(stage => createStructuredResponse({
    model: getPaidModel(),
    prompt: stagePrompt(input, prepared.context, stage),
    responseFormat: responseFormatFor(stage),
    maxOutputTokens: 7000,
    reasoningEffort: 'none',
    background: true,
    metadata: {
      report_contract: CONTRACT_VERSION,
      job_id: jobId,
      stage: stage.id,
      double_confirmation: `${prepared.confirmation.score}/3`
    }
  })));

  const state = {
    job_id: jobId,
    created_at: new Date().toISOString(),
    report_date: prepared.reportDate.toISOString(),
    input,
    deterministic_numerology: prepared.deterministicNumerology,
    verification: prepared.verification,
    dominant_planets: prepared.dominant,
    double_confirmation: prepared.confirmation
  };

  return {
    job_id: jobId,
    job_token: signJobState(state),
    response_ids: Object.fromEntries(STAGES.map((stage, index) => [stage.id, responses[index].response_id])),
    statuses: Object.fromEntries(STAGES.map((stage, index) => [stage.id, responses[index].status])),
    numbers: pdfNumbers(prepared.deterministicNumerology),
    source_verified: true,
    double_confirmation: prepared.confirmation,
    started_at: state.created_at
  };
}

async function pollPaidReportV2({ job_token, response_ids }) {
  const state = readJobState(job_token);
  const ids = response_ids || {};
  for (const stage of STAGES) {
    if (!ids[stage.id]) throw new Error(`Missing background response ID for ${stage.id}`);
  }

  const results = await Promise.all(STAGES.map(stage => getResponse(ids[stage.id])));
  const statuses = Object.fromEntries(STAGES.map((stage, index) => [stage.id, results[index].status]));
  const failed = results.find(result => ['failed', 'cancelled', 'incomplete'].includes(result.status));
  if (failed) {
    const detail = failed.error?.message || failed.incomplete_details?.reason || failed.status;
    throw new Error(`Report writing stage failed: ${detail}`);
  }

  const completedCount = results.filter(result => result.status === 'completed').length;
  if (completedCount !== STAGES.length) {
    return {
      completed: false,
      status: 'generating',
      completed_stages: completedCount,
      total_stages: STAGES.length,
      statuses
    };
  }

  let reportJson = {};
  results.forEach(result => { reportJson = { ...reportJson, ...(result.output || {}) }; });
  reportJson = applyDeterministicFacts(reportJson, state);
  const reportText = reportTextFromJson(reportJson, state.input);
  const qa = assertQa(reportJson, reportText, state);

  return {
    completed: true,
    status: 'completed',
    job_id: state.job_id,
    model: getPaidModel(),
    report_contract_version: CONTRACT_VERSION,
    report_json: reportJson,
    report_text: reportText,
    numbers: pdfNumbers(state.deterministic_numerology),
    astrology_data: {
      provider: 'AstrologyAPI',
      verification: state.verification,
      double_confirmation: state.double_confirmation,
      dominant_planets: state.dominant_planets
    },
    numerology_data: { deterministic: state.deterministic_numerology },
    qa,
    input: state.input,
    generation_ms: Date.now() - new Date(state.created_at).getTime()
  };
}

module.exports = {
  CONTRACT_VERSION,
  getPaidModel,
  pollPaidReportV2,
  reportTextFromJson,
  startPaidReportV2
};
