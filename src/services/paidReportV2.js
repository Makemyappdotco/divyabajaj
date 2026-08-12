const { generateSourceBundle } = require('./astrologyApiV2');
const { calculateNumerology } = require('./numerologyEngine');
const { doubleConfirmation, scoreDominantPlanets } = require('./dominantPlanetScoring');
const { verifySourceBundle } = require('./reportVerification');
const { createStructuredResponse } = require('./openAiResponses');

const CONTRACT_VERSION = 'client-master-blueprint-live-v1';
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

const RESPONSE_SCHEMA = obj({
  chart_verification: obj({
    status: { type: 'string', enum: ['verified', 'verification_required'] },
    ascendant: str(),
    moon_nakshatra: str(),
    moon_nakshatra_lord: str(),
    current_mahadasha: str(),
    current_antardasha: str(),
    current_pratyantar: str(),
    current_sookshma: str(),
    current_prana: str(),
    discrepancies: strArray(),
    timing_limitation: str()
  }),
  cover: obj({
    report_title: str(),
    client_name: str(),
    birth_details: str(),
    report_date: str(),
    methodology: str()
  }),
  before_you_begin: obj({
    map_and_clock: str(),
    numerology_role: str(),
    honest_confidence_promise: str(),
    no_fear_promise: str(),
    professional_advice_limit: str()
  }),
  numbers_at_a_glance: {
    type: 'array', minItems: 4, maxItems: 4,
    items: obj({
      label: { type: 'string', enum: ['Psychic Number', 'Destiny Number', 'Name Number', 'Personal Year'] },
      number: { type: 'integer', minimum: 1, maximum: 9 },
      planet: str(),
      meaning: str()
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
      matched_planets: strArray(),
      outlier_planets: strArray(),
      explanation: str(),
      central_instruction: str()
    })
  }),
  current_period: obj({
    periods: {
      type: 'array', minItems: 5, maxItems: 5,
      items: obj({
        level: { type: 'string', enum: ['Mahadasha', 'Antardasha', 'Pratyantar', 'Sookshma', 'Prana'] },
        planet: str(),
        start: str(),
        end: str(),
        instruction: str(),
        confidence: confidence()
      })
    },
    summary: str(),
    practical_instruction: str()
  }),
  personal_nature: obj({
    area: lifeAreaSchema(),
    weaknesses: strArray('At least two specific genuine weaknesses.', 2, 4)
  }),
  past_life_karma: obj({
    area: lifeAreaSchema(),
    symbolic_disclaimer: str()
  }),
  finances: obj({
    area: lifeAreaSchema(),
    earning_2_10_11: str(),
    accumulation_2_11: str(),
    drains_6_8_12: str(),
    dominant_financial_pattern: str()
  }),
  marriage: obj({
    area: lifeAreaSchema(),
    event_distinctions: obj({ finalisation: str(), engagement: str(), marriage: str() })
  }),
  health: obj({
    area: lifeAreaSchema(),
    loaded_6_8_12_check: str(),
    safety_line: str()
  }),
  children: obj({
    area: lifeAreaSchema(),
    obstruction_1_4_10_check: str(),
    medical_line: str()
  }),
  property: obj({
    area: lifeAreaSchema(),
    leading_planet_buying_style: str()
  }),
  remedies: obj({
    items: {
      type: 'array', minItems: 4, maxItems: 6,
      items: obj({
        priority: { type: 'integer', minimum: 1, maximum: 6 },
        planet_or_pattern: str(),
        specific_issue: str(),
        what_to_do: str(),
        how_often: str()
      })
    },
    one_thing: str()
  }),
  confidence_audit: {
    type: 'array', minItems: 5, maxItems: 9,
    items: obj({ finding: str(), confidence: confidence(), basis: str(), limitation: str() })
  },
  closing: obj({
    finer_timing_precision: str(),
    next_mahadasha_change: str(),
    gemstones_and_individual_prescriptions: str(),
    final_highest_leverage_action: str(),
    closing_note: str()
  })
});

const RESPONSE_FORMAT = {
  type: 'json_schema',
  name: 'divya_paid_full_blueprint_live_v1',
  strict: true,
  schema: RESPONSE_SCHEMA
};

function compactResult(result) {
  return result?.ok ? result.data : { unavailable: result?.error || 'Source unavailable' };
}

function compactKpPlanet(row = {}) {
  return {
    planet_name: row.planet_name || row.name || '',
    sign: row.sign || '',
    house: row.house ?? null,
    degree: row.degree ?? null,
    norm_degree: row.norm_degree ?? row.normDegree ?? null,
    formatted_degree: row.formatted_degree || '',
    sign_lord: row.sign_lord || '',
    nakshatra: row.nakshatra || '',
    nakshatra_lord: row.nakshatra_lord || row.nakshatraLord || '',
    sub_lord: row.sub_lord || '',
    sub_sub_lord: row.sub_sub_lord || ''
  };
}

function buildVerifiedContext(bundle, deterministicNumerology, verification, dominant, confirmation, reportDate) {
  return {
    report_date: reportDate.toISOString(),
    verification,
    deterministic_numerology: deterministicNumerology,
    dominant_planets: dominant,
    double_confirmation: confirmation,
    kp_planets: Array.isArray(compactResult(bundle.kp_planets)) ? compactResult(bundle.kp_planets).map(compactKpPlanet) : compactResult(bundle.kp_planets),
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

function buildPrompt(input, source) {
  return `You are writing Divya Bajaj's paid PERSONAL LIFE BLUEPRINT. This is not a generic horoscope, not a textbook and not a sales brochure. The reader has paid real money and has zero technical astrology knowledge. The report must be genuinely useful, specific, honest and practical.

CLIENT
Name: ${input.name}
Gender: ${input.gender}
Date of birth: ${input.dob}
Time of birth: ${input.tob}
Place of birth: ${input.pob}
Birth-time accuracy: ${input.birth_time_accuracy || 'not stated'}
Main concern supplied by client: ${input.question || 'Complete life clarity'}

VERIFIED SOURCE AND BACKEND CALCULATIONS
${JSON.stringify(source, null, 2)}

NON-NEGOTIABLE SOURCE RULE
Use only the verified source and backend calculations above. Never infer, estimate or invent a degree, cusp, house, Star Lord, Sub Lord, Sub-Sub Lord, Dasha date, transit position or numerology number. If a requested precision is not supported, say Not claimed. If a verified discrepancy exists, preserve it as CHART VERIFICATION REQUIRED. Never hide a gap to make the report sound complete.

REPORT ORDER
1. Chart Verification first.
2. Cover.
3. Before You Begin: How to Read This Report.
4. Your Numbers at a Glance.
5. The Big Picture: Where Everything Agrees.
6. Where You Are Right Now.
7. Personal Nature.
8. Past Life Karma.
9. Finances.
10. Marriage.
11. Health.
12. Children.
13. Property.
14. Remedies.
15. What We Are Confident About, and What We Are Not.
16. Where This Report Ends, and What Comes Next.

KP METHOD
For every astrological conclusion use this reasoning order internally: Houses -> Significators -> Star Lord -> Sub Lord -> Sub-Sub Lord -> Dasha/Bhukti/Antara -> Transit. The governing principle is Promise -> Dasha activation -> Transit confirmation. Never start from transit. Current transit is unavailable, therefore never fabricate exact external event timing.

AREA HOUSE RULES
Personal Nature: Ascendant, Ascendant lord, Moon and verified planets affecting the Ascendant.
Past Life Karma: Ketu, Rahu and houses 5, 9 and 12. Symbolic only, never historical fact.
Finances: 2+10+11 for earning; 2+11 for accumulation; 6/8/12 for drains. Explicitly say which side dominates.
Marriage: 2+7+11. Keep finalisation, engagement and marriage separate.
Health: 6+8+12. Explicitly state whether one verified planet covers all three. Never diagnose.
Children: 2+5+11. Check 1+4+10 obstruction separately. Never make fertility claims.
Property: 4+11+12. Mars and Saturn are natural significators only; the verified leading planet defines the buying style.

MANDATORY INTERNAL RHYTHM FOR ALL SEVEN AREAS
Every area must contain, in this order: short intro -> 3 to 5 birth-chart paragraphs -> planet roles -> 2 to 3 numerology paragraphs -> where the two agree -> explicit confidence -> Double Confirmation or genuine-tension callout -> one recognisable 4 to 6 sentence real-life example -> 3 to 5 executable actions. Do not skip any part in any area.

DOUBLE CONFIRMATION IS THE PRODUCT SIGNATURE
Use the supplied deterministic dominant-planet ranking and backend Psychic, Destiny and Name Number planet mapping. Do not manufacture agreement. 3/3 = Triple Confirmation. 2/3 = Strong Agreement. 1/3 = Partial Agreement. 0/3 = Divergent Design. A genuine disagreement is valuable and must be explained, not repaired. Carry relevant agreement or tension into each life-area callout.

VOICE
Write in second person. Explain every technical term immediately in plain English. Use analogies where useful. Sound like Divya sitting across a table explaining one person's chart. No mystical padding, flattery, generic personality copy, AI phrases, textbook prose, fear or em dashes. Do not let the client's stated concern cause other required life areas to be shortened.

SAFETY
Health: never diagnose, predict death, terminal illness or incurability. The exact line 'Use this as a prompt to book the check-up, never as a reason to skip one.' must appear.
Children: never say whether the client will or will not have children and never comment on fertility. State that conception and pregnancy questions belong to qualified medical professionals.
Past life: symbolic only.
No criminal, violence or scandal predictions.
No claim that this substitutes for medical, legal, financial or psychological advice.
No gemstone recommendation. No paid rituals. No products.

REMEDIES
Exactly 4 to 6 remedies, priority ordered. Every remedy must trace back to a problem already established earlier and must state planet/pattern, specific issue, exact action and frequency. Remedies may be behavioural, lifestyle, professional or free traditional practices only. End with one shaded-box-style 'If you do only one thing from this report' highest-leverage action.

CLOSING
The final section must explain three genuine written-report boundaries: finer timing precision, the next verified Mahadasha transition, and why gemstones/individual prescriptions require separate assessment. This is not a hard sell. Let deeper consultation arise naturally from genuine limitations, not fear or manufactured scarcity.

LENGTH
Aim for the substance of a 20 to 28 A4-page premium report, generally around 8,500 to 11,000 useful words. Never pad to hit length. Every paragraph must add a conclusion, evidence, example, limitation or action.

Return only the required structured JSON.`;
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
    `${number}. ${name}`,
    area.subtitle || '',
    area.intro || '',
    'What your birth chart says',
    paragraphs(area.chart_reading),
    area.planet_roles?.length ? `How the relevant planets behave here\n${lines(area.planet_roles)}` : '',
    ...extras.filter(Boolean),
    'What your numbers say',
    paragraphs(area.numerology_reading),
    'Where the two agree',
    area.synthesis || '',
    `Confidence: ${area.confidence || 'Not claimed'}`,
    area.double_confirmation_callout ? `DOUBLE CONFIRMATION / REAL TENSION\n${area.double_confirmation_callout.title}\n${area.double_confirmation_callout.explanation}` : '',
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
    `CHART VERIFICATION\nStatus: ${verification.status}\nAscendant: ${verification.ascendant}\nMoon nakshatra: ${verification.moon_nakshatra}\nMoon nakshatra lord: ${verification.moon_nakshatra_lord}\nCurrent Mahadasha: ${verification.current_mahadasha}\nCurrent Antardasha: ${verification.current_antardasha}\nCurrent Pratyantar: ${verification.current_pratyantar}\nCurrent Sookshma: ${verification.current_sookshma}\nCurrent Prana: ${verification.current_prana}\n${verification.discrepancies?.length ? `Discrepancies\n${lines(verification.discrepancies)}` : ''}\nTiming limitation: ${verification.timing_limitation}`,
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
  ].filter(Boolean).join('\n\n');
}

function assertQa(report, reportText) {
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
  if (/recommend(?:ed|ing)?\s+(?:a\s+)?(?:gemstone|ruby|emerald|sapphire|diamond|pearl|coral)/i.test(reportText)) failures.push('Gemstone recommendation detected');
  if (/guaranteed marriage|guaranteed money|you will have children|you will not have children/i.test(reportText)) failures.push('Unsupported guarantee detected');
  if (reportText.includes('—')) failures.push('Em dash detected');
  if (failures.length) throw new Error(`Paid Full Blueprint failed client-master QA: ${failures.join(' | ')}`);
  return { passed: true, checks: 12, failures: [] };
}

async function generatePaidReportV2(input, { includePdfs = false } = {}) {
  const startedAt = Date.now();
  const reportDate = new Date();
  const sourceBundle = await generateSourceBundle(input, { includePdfs });
  const deterministicNumerology = calculateNumerology({ name: input.name, dob: input.dob, reportDate });
  const verification = verifySourceBundle(sourceBundle, deterministicNumerology, { reportDate });
  if (!verification.ready_for_personal_life_blueprint) {
    throw new Error(`Full Blueprint source verification failed: ${verification.blocking_issues.join(' | ')}`);
  }
  const dominant = scoreDominantPlanets(sourceBundle, { limit: 3 });
  const confirmation = doubleConfirmation(dominant, deterministicNumerology);
  const verifiedContext = buildVerifiedContext(sourceBundle, deterministicNumerology, verification, dominant, confirmation, reportDate);
  const response = await createStructuredResponse({
    model: getPaidModel(),
    prompt: buildPrompt(input, verifiedContext),
    responseFormat: RESPONSE_FORMAT,
    maxOutputTokens: 18000,
    reasoningEffort: 'none',
    metadata: {
      report_contract: CONTRACT_VERSION,
      report_date: reportDate.toISOString().slice(0, 10),
      double_confirmation: `${confirmation.score}/3`
    }
  });
  const reportJson = response.output;
  const reportText = reportTextFromJson(reportJson, input).replace(/—/g, ' - ');
  const qa = assertQa(reportJson, reportText);
  return {
    generated: true,
    model: getPaidModel(),
    report_contract_version: CONTRACT_VERSION,
    report_json: reportJson,
    report_text: reportText,
    source_verification: verification,
    deterministic_numerology: deterministicNumerology,
    dominant_planets: dominant,
    double_confirmation: confirmation,
    astrology_data: {
      provider: 'AstrologyAPI',
      verification,
      kp_planets: sourceBundle.kp_planets,
      kp_house_cusps: sourceBundle.kp_house_cusps,
      kp_planet_significators: sourceBundle.kp_planet_significators,
      kp_house_significators: sourceBundle.kp_house_significators,
      current_vdasha: sourceBundle.current_vdasha,
      current_vdasha_all: sourceBundle.current_vdasha_all
    },
    numerology_data: {
      provider_cross_check: {
        numerological_numbers: sourceBundle.numerological_numbers,
        numero_table: sourceBundle.numero_table
      },
      deterministic: deterministicNumerology
    },
    source_pdfs: sourceBundle.pdfs,
    generation_ms: Date.now() - startedAt,
    qa,
    insights: { concerns: input.question ? [input.question] : [] }
  };
}

module.exports = { CONTRACT_VERSION, generatePaidReportV2, getPaidModel, reportTextFromJson };