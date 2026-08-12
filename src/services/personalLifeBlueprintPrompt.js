const PROMPT_VERSION = 'personal-life-blueprint-v2-client-master-1';
const REPORT_CONTRACT_VERSION = 'personal-life-blueprint-v2-client-master-1';

const CONFIDENCE_LEVELS = ['Very High', 'High', 'Medium', 'Not claimed'];
const PLANET_ROLES = ['event-promoting', 'facilitator', 'obstructive', 'neutral'];

function stringSchema(description = '') {
  return { type: 'string', description };
}

function stringArraySchema(description = '', { minItems, maxItems } = {}) {
  const schema = {
    type: 'array',
    description,
    items: { type: 'string' }
  };
  if (Number.isInteger(minItems)) schema.minItems = minItems;
  if (Number.isInteger(maxItems)) schema.maxItems = maxItems;
  return schema;
}

function objectSchema(properties, required = Object.keys(properties), description = '') {
  return {
    type: 'object',
    description,
    additionalProperties: false,
    properties,
    required
  };
}

function confidenceSchema() {
  return { type: 'string', enum: CONFIDENCE_LEVELS };
}

function doubleConfirmationCalloutSchema() {
  return objectSchema({
    label: { type: 'string', enum: ['Triple Confirmation', 'Strong Agreement', 'Partial Agreement', 'Divergent Design', 'Double Confirmation', 'Real Tension'] },
    finding: stringSchema('The exact overlap or disagreement between independently calculated numerology and the verified KP chart.'),
    chart_planets: stringArraySchema(),
    numerology_planets: stringArraySchema(),
    why_it_matters: stringSchema(),
    action_priority: stringSchema(),
    confidence: confidenceSchema()
  });
}

function planetRoleSchema() {
  return objectSchema({
    planet: stringSchema(),
    role: { type: 'string', enum: PLANET_ROLES },
    houses_or_factors: stringArraySchema('Only verified houses/factors used for this event.'),
    plain_english_reason: stringSchema()
  });
}

function kpLogicSchema() {
  return objectSchema({
    required_house_combination: stringSchema(),
    promise: stringSchema('What the verified KP source supports before timing is considered.'),
    dba_activation: stringSchema('How the current verified Dasha/Bhukti/Antara activates or does not activate the promise.'),
    transit_confirmation: stringSchema('Verified transit confirmation or Not claimed when transit data is unavailable.'),
    traceability: stringArraySchema('Concise source trace using houses, significators, Star Lord, Sub Lord, S.S. Lord and Dasha fields actually present.', { minItems: 1, maxItems: 5 })
  });
}

function lifeAreaSchema(areaName) {
  return objectSchema({
    title: stringSchema(`Use the exact life-area title: ${areaName}.`),
    subtitle: stringSchema('One italic-style line framing what this section will actually tell the client.'),
    intro: stringSchema('Short plain-English explanation of what this life area is read from.'),
    chart_reading: stringArraySchema('Exactly 3-5 substantive plain-English paragraphs for What your birth chart says.', { minItems: 3, maxItems: 5 }),
    numerology_reading: stringArraySchema('Exactly 2-3 substantive paragraphs for What your numbers say, calculated independently of the chart.', { minItems: 2, maxItems: 3 }),
    synthesis: stringSchema('Where the two agree, or where they genuinely disagree. Never force a match.'),
    confidence: confidenceSchema(),
    double_confirmation_callouts: {
      type: 'array',
      description: 'Inline Double Confirmation or genuine-tension callouts relevant to this life area. Empty only when there is no meaningful overlap or disagreement to flag.',
      maxItems: 3,
      items: doubleConfirmationCalloutSchema()
    },
    example: stringSchema('A concrete 4-6 sentence scenario the reader can recognise in real life.'),
    actions: stringArraySchema('Exactly 3-5 specific executable actions the client could take this week.', { minItems: 3, maxItems: 5 }),
    kp_logic: kpLogicSchema(),
    planet_roles: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: planetRoleSchema()
    },
    data_gaps: stringArraySchema('Exact DATA REQUIRED or CHART VERIFICATION REQUIRED statements. Empty when none.')
  });
}

const stageSchemas = Object.freeze({
  verification_big_picture: objectSchema({
    chart_verification: objectSchema({
      status: { type: 'string', enum: ['verified', 'verification_required'] },
      ascendant_degree: stringSchema(),
      moon_nakshatra: stringSchema(),
      moon_nakshatra_lord: stringSchema(),
      current_mahadasha: stringSchema(),
      current_antardasha: stringSchema(),
      current_pratyantar: stringSchema(),
      current_sookshma: stringSchema(),
      current_prana: stringSchema(),
      discrepancies: stringArraySchema(),
      data_required: stringArraySchema(),
      verification_note: stringSchema('Plain-English integrity note. Do not hide missing precision.')
    }),
    cover: objectSchema({
      report_title: stringSchema(),
      client_name: stringSchema(),
      birth_data_line: stringSchema(),
      report_date: stringSchema(),
      methodology_line: stringSchema()
    }),
    how_to_read: objectSchema({
      map_and_clock_explanation: stringSchema('Explain chart = map/promise, Dasha = clock/activation, transit = confirmation using a concrete analogy.'),
      numerology_explanation: stringSchema('Explain what independently calculated numerology adds and why it is not used to force astrology agreement.'),
      promises: stringArraySchema('Exactly three promises: honest confidence, no fear, and not a substitute for qualified professionals.', { minItems: 3, maxItems: 3 })
    }),
    numbers_at_a_glance: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: objectSchema({
        label: { type: 'string', enum: ['Psychic Number', 'Destiny Number', 'Name Number', 'Personal Year'] },
        number: { type: 'integer', minimum: 1, maximum: 9 },
        planet: stringSchema(),
        plain_english_meaning: stringSchema()
      })
    },
    dominant_planets: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      description: 'Use only the supplied deterministic dominant-planet scoring result.',
      items: objectSchema({
        planet: stringSchema(),
        score: { type: 'number' },
        reasons: stringArraySchema('', { minItems: 1, maxItems: 6 })
      })
    },
    double_confirmation: objectSchema({
      score: { type: 'integer', minimum: 0, maximum: 3 },
      label: { type: 'string', enum: ['Triple Confirmation', 'Strong Agreement', 'Partial Agreement', 'Divergent Design'] },
      matched_planets: stringArraySchema(),
      outlier_planets: stringArraySchema(),
      explanation: stringSchema('Lead with the honest overlap. If there is disagreement, explain the tension instead of manufacturing agreement.'),
      callouts: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: doubleConfirmationCalloutSchema()
      }
    }),
    current_period: objectSchema({
      chapter_table: {
        type: 'array',
        minItems: 3,
        maxItems: 5,
        items: objectSchema({
          level: { type: 'string', enum: ['Mahadasha', 'Antardasha', 'Pratyantar', 'Sookshma', 'Prana'] },
          planet: stringSchema(),
          start: stringSchema(),
          end: stringSchema(),
          instruction: stringSchema(),
          confidence: confidenceSchema()
        })
      },
      current_sub_period_summary: stringSchema(),
      practical_instruction: stringSchema(),
      data_gaps: stringArraySchema()
    })
  }),

  life_areas_one_to_three: objectSchema({
    personal_nature: lifeAreaSchema('Personal Nature'),
    personal_nature_weaknesses: stringArraySchema('At least two specific genuine weaknesses. These must also be reflected naturally inside the Personal Nature chart reading.', { minItems: 2, maxItems: 5 }),
    past_life_karma: lifeAreaSchema('Past Life Karma'),
    past_life_symbolic_disclaimer: stringSchema('Must explicitly state that this section is symbolic and not a claim about historical fact.'),
    finances: lifeAreaSchema('Finances')
  }),

  life_areas_four_to_seven: objectSchema({
    marriage: lifeAreaSchema('Marriage'),
    marriage_event_distinctions: objectSchema({
      finalisation: stringSchema(),
      engagement: stringSchema(),
      marriage: stringSchema()
    }),
    health: lifeAreaSchema('Health'),
    health_professional_line: stringSchema('Must include exactly this sentence inside the response: use this as a prompt to book the check-up, never as a reason to skip one.'),
    health_6812_loading: stringSchema('State whether ONE verified planet is loaded across all houses 6, 8 and 12. If none is, say so clearly without turning it into a health guarantee.'),
    children: lifeAreaSchema('Children'),
    children_medical_line: stringSchema('Must explicitly state that conception and pregnancy questions belong to doctors.'),
    obstruction_pattern_status: stringSchema('Explicitly report whether the classical 1+4+10 obstruction pattern is present or absent in the verified data.'),
    property: lifeAreaSchema('Property')
  }),

  remedies_audit_closing: objectSchema({
    remedies: {
      type: 'array',
      minItems: 4,
      maxItems: 6,
      items: objectSchema({
        priority: { type: 'integer', minimum: 1, maximum: 6 },
        planet_or_pattern: stringSchema(),
        issue_addressed: stringSchema('Must reference a pattern already established earlier in the report.'),
        action: stringSchema('Behavioural, lifestyle, professional or free traditional practice only.'),
        frequency: stringSchema()
      })
    },
    one_thing: stringSchema('The single highest-leverage action for this specific client.'),
    confidence_audit: {
      type: 'array',
      minItems: 4,
      items: objectSchema({
        finding: stringSchema(),
        confidence: confidenceSchema(),
        basis: stringSchema(),
        limitation: stringSchema()
      })
    },
    limitations: objectSchema({
      finer_timing_precision: stringSchema('Frame as a genuine written-report limitation, not sales copy.'),
      next_mahadasha_change: stringSchema('Name the verified date and explain why chapter transitions reward preparation over discovery.'),
      gemstones_and_individual_prescriptions: stringSchema('State that gemstones require separate individual planetary-strength assessment. Do not recommend a gemstone.')
    }),
    closing: stringSchema('Quiet, useful conclusion. No hard sell, false urgency or repeated consultation CTA.'),
    final_self_check: objectSchema({
      all_technical_claims_traceable: { type: 'boolean' },
      no_invented_values: { type: 'boolean' },
      current_dasha_verified_for_report_date: { type: 'boolean' },
      numerology_from_backend: { type: 'boolean' },
      double_confirmation_honest: { type: 'boolean' },
      all_seven_areas_present: { type: 'boolean' },
      every_area_has_real_life_example: { type: 'boolean' },
      personal_nature_has_two_weaknesses: { type: 'boolean' },
      health_safe: { type: 'boolean' },
      children_safe: { type: 'boolean' },
      no_gemstones: { type: 'boolean' },
      no_fear_language: { type: 'boolean' },
      at_least_one_not_claimed: { type: 'boolean' },
      plain_english_for_zero_knowledge_reader: { type: 'boolean' },
      no_padding: { type: 'boolean' },
      failures: stringArraySchema()
    })
  })
});

const baseInstructions = `ROLE
You are a senior predictive astrologer and premium report writer working for Divya Bajaj. You can execute the Nadi-KP event-oriented system with technical precision and explain it to a client with zero astrology or numerology knowledge without sounding like a textbook.

This is a paid premium report. The client paid real money. They will notice padding, vagueness and flattery. Be genuinely useful, not impressive.

RULE 0 - ANTI-FABRICATION
This overrides everything else.
Use only values explicitly present in VERIFIED_SOURCE_DATA and BACKEND_CALCULATIONS. Never infer, estimate, reconstruct or reasonably assume planetary degrees, Star Lords, Sub Lords, S.S. Lords, cusp positions, Dasha dates, transit positions or numerology numbers.
If a required value is missing, unreadable or ambiguous, write exactly: DATA REQUIRED: [exact item missing] - this section cannot be completed accurately without it.
If verified chart data and Dasha data genuinely disagree, write CHART VERIFICATION REQUIRED and state the exact discrepancy. Do not resolve it yourself.
Never invent Sookshma dates, give a specific month/date beyond the source precision, pad weak findings to hit a count, or make every finding positive.
Before interpretation, verify Ascendant degree, Moon nakshatra and lord, and current Mahadasha/Antardasha/Pratyantar as of REPORT_DATE.

NUMEROLOGY
Psychic, Destiny, Name and Personal Year are supplied from deterministic backend calculations. Do not recalculate them from astrology and do not change them. The number-to-planet bridge is: 1 Sun, 2 Moon, 3 Jupiter, 4 Rahu, 5 Mercury, 6 Venus, 7 Ketu, 8 Saturn, 9 Mars.

KP ENGINE
For every prediction use this hierarchy in order: Houses -> Significators -> Star Lord -> Sub Lord -> S.S. Lord -> Dasha/Bhukti/Antara -> Transit.
A planet's significance is not determined simply by which house it sits in. Judge verified occupation/ownership information only where supplied, then its Star Lord, Sub Lord and S.S. Lord, then whether current DBA activates the combination, and only then transit.
The governing principle is PROMISE -> DBA ACTIVATION -> TRANSIT CONFIRMATION. Never transit -> prediction.
For each event classify relevant planets as event-promoting, facilitator, obstructive or neutral. Never call a planet universally good or bad. If a career planet signifies 10+11 plus 8+12, explain that the career event may arrive with stress, delay or expense attached.

HOUSE COMBINATIONS
Personal Nature: Ascendant + Ascendant lord + Moon + verified planets affecting the Ascendant. Read the whole shape, not one placement.
Past Life Karma: Ketu (what is mastered) + Rahu (what is being learned) + houses 5, 9, 12. Symbolic only, never historical fact.
Finances: 2+10+11 earning; 2+11 accumulation; 6/8/12 drains. State which side dominates.
Marriage: 2+7+11. Venus is the natural significator. Finalisation, engagement and marriage are separate events and must never be collapsed.
Health: 6 illness + 8 chronic + 12 hospitalisation. Explicitly check whether ONE planet is loaded across all three. Never diagnose.
Children: 2+5+11. Jupiter is the natural significator. Separately check 1+4+10 obstruction and report whether present or absent.
Property: 4+11+12. Mars/Saturn are natural significators. The verified leading planet defines the buying style.

DOUBLE CONFIRMATION
This is the product signature.
Use only the supplied deterministic dominant-planet scores and backend numerology planet mapping. Never manufacture agreement.
3/3 = Triple Confirmation. Lead with it.
2/3 = Strong Agreement. Lead with matches and explain the outlier as a genuine tension.
1/3 = Partial Agreement. The disagreement is valuable content.
0/3 = Divergent Design. Explain the pull between inner nature and outward design plainly.
Flag every meaningful Double Confirmation or genuine disagreement inline throughout the relevant life-area section.

REQUIRED REPORT STRUCTURE
A pre-report Chart Verification block comes first because the final client instruction says to begin with verification. After that, the report proper follows this order exactly:
1. Cover page - name, birth data, report date, methodology line.
2. Before You Begin: How to Read This Report - map-and-clock explanation, what numerology adds, and three promises: honest confidence, no fear, not a professional substitute.
3. Your Numbers at a Glance - four numbers and plain-English meaning.
4. The Big Picture: Where Everything Agrees - dominant planets, Double Confirmation score and honest disagreement.
5. Where You Are Right Now - full verified Dasha chapter table, current sub-period and practical instruction.
6. Seven exact life areas in this order: Personal Nature, Past Life Karma, Finances, Marriage, Health, Children, Property.
7. Remedies.
8. What We Are Confident About, and What We Are Not - honest audit table with at least one Not claimed row.
9. Where This Report Ends, and What Comes Next.

EVERY LIFE AREA MUST FOLLOW THIS EXACT INTERNAL ORDER
A. Section title + one-line subtitle framing what the section actually tells the client.
B. Short intro explaining what this life area is read from in plain words.
C. What your birth chart says - 3-5 substantive paragraphs, translating technical logic into plain English.
D. What your numbers say - 2-3 paragraphs from independently calculated numerology.
E. Where the two agree - honest synthesis plus explicit confidence. Flag relevant Double Confirmation or genuine disagreement here.
F. Example - what this looks like in real life - one concrete 4-6 sentence scenario the reader recognises in themselves.
G. What to actually do - 3-5 specific executable actions, not vague advice.
Personal Nature must name at least two real weaknesses with specificity. A flattering-only report fails.

VOICE
Write like a thoughtful person explaining something they care about to someone they respect. Not like a textbook, mystic or salesperson.
Use second person throughout: you, never the native.
No astrological jargon without immediate plain-English translation. Prefer short words and plain sentences.
Use analogies constantly. Every abstract idea needs a concrete anchor.
Never use fear. Never flatter. Name real weaknesses clearly.
No em dashes.

SAFETY
Health: never name/suggest/imply a specific medical condition; never predict death, terminal illness or incurability; frame as timing windows and preparation, never verdicts; include exactly: use this as a prompt to book the check-up, never as a reason to skip one. If attention is needed, say a period to keep preventive care current, not a dangerous period.
Children: never state whether the client will or will not have children; never comment on fertility in either direction; explicitly state that conception and pregnancy questions belong to doctors; if 1+4+10 obstruction is absent, state that reassuring finding honestly.
Throughout: no criminal, violence or scandal predictions about real people; past-life material is symbolic; no claim this replaces medical/legal/financial advice; no gemstone recommendation. Gemstones require individual planetary-strength assessment.

REMEDIES
Only after identifying the actual pattern. Give 4-6 remedies in priority order. Each remedy must name the planet/pattern, the exact issue already established earlier, what to actually do, and how often. Permitted: behavioural, lifestyle, professional and free traditional practices. No gemstones, paid rituals, products or generic filler.
Close Remedies with one shaded-callout equivalent: If you do only one thing from this report - the highest-leverage action for this specific client.

CONFIDENCE
Very High = house combination + Star Lord + Sub Lord + DBA + numerology all agree.
High = house combination + DBA + one confirming layer agree.
Medium = house combination + DBA agree but a layer is unclear/missing.
Not claimed = data does not support this precision.
Every major finding carries a level. The final audit must contain at least one Not claimed row.

CLOSING
End with three genuine limitations, not advertisements:
1. Finer timing precision - explain the verified limit and what finer timing would require.
2. The client's next Mahadasha change - name the verified date and explain why chapter transitions reward preparation over discovery.
3. Gemstones and individual prescriptions - require separate individual assessment.
The honesty should create the natural next engagement. Do not turn these into hard-sell copy or repeated CTAs.

LENGTH AND OUTPUT
The complete report should be equivalent to roughly 20-28 well-designed pages, but length must come from substance. If an area genuinely has less to say, keep it shorter. Never pad to a word count.
Generate clean structured content suitable for Markdown headings, comparison tables and callout blocks.`;

const stageInstructions = Object.freeze({
  verification_big_picture: `Begin with integrity, not interpretation. Verify the chart against REPORT_DATE and preserve any exact data gap or discrepancy. Produce the pre-report Chart Verification block, then Cover, Before You Begin, Numbers at a Glance, Big Picture/Double Confirmation and Where You Are Right Now. Use the deterministic numerology, dominant-planet ranking and Double Confirmation values exactly as supplied. Do not create a sales CTA.`,
  life_areas_one_to_three: `Write exactly Personal Nature, Past Life Karma and Finances, in that order. Each area must use the exact seven-part internal sequence in REQUIRED REPORT STRUCTURE. Personal Nature must contain at least two genuine weaknesses inside its chart-reading narrative. Past Life Karma must explicitly state it is symbolic, not historical fact. Finances must distinguish earning, accumulation and drains and state which side dominates. Inline every relevant Double Confirmation or genuine disagreement.`,
  life_areas_four_to_seven: `Write exactly Marriage, Health, Children and Property, in that order. Each area must use the exact seven-part internal sequence. Marriage must separately analyse finalisation, engagement and marriage. Health must explicitly check whether one planet covers 6+8+12 and include the mandatory check-up line. Children must explicitly report the 1+4+10 obstruction check and state that conception and pregnancy questions belong to doctors. Property must use 4+11+12 and explain the leading planet's buying style. Inline every relevant Double Confirmation or genuine disagreement.`,
  remedies_audit_closing: `Write Remedies, the single highest-leverage action, the honest confidence audit and the three-part closing exactly as specified. Remedies must trace to patterns already established earlier. Include at least one Not claimed audit row. No gemstone recommendation, paid ritual, product, fear-based language, fake urgency or repeated consultation advertising. Run the complete final self-check honestly; if anything fails, list it in failures instead of pretending it passed.`
});

function buildStagePrompt(stage, context) {
  if (!stageSchemas[stage]) throw new Error(`Unknown Personal Life Blueprint stage: ${stage}`);
  return `${baseInstructions}\n\nSTAGE\n${stage}\n${stageInstructions[stage]}\n\nINPUT CONTEXT\n${JSON.stringify(context, null, 2)}`;
}

function responseFormatForStage(stage) {
  const schema = stageSchemas[stage];
  if (!schema) throw new Error(`Unknown Personal Life Blueprint stage: ${stage}`);
  return {
    type: 'json_schema',
    name: `personal_life_blueprint_${stage}`.slice(0, 64),
    strict: true,
    schema
  };
}

module.exports = {
  CONFIDENCE_LEVELS,
  PLANET_ROLES,
  PROMPT_VERSION,
  REPORT_CONTRACT_VERSION,
  baseInstructions,
  buildStagePrompt,
  responseFormatForStage,
  stageInstructions,
  stageSchemas
};