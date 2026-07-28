const PROMPT_VERSION = 'personal-life-blueprint-v2-draft-1';
const REPORT_CONTRACT_VERSION = 'personal-life-blueprint-v2-draft-1';

const CONFIDENCE_LEVELS = ['Very High', 'High', 'Medium', 'Not claimed'];

function stringSchema(description = '') {
  return { type: 'string', description };
}

function stringArraySchema(description = '') {
  return {
    type: 'array',
    description,
    items: { type: 'string' }
  };
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
  return {
    type: 'string',
    enum: CONFIDENCE_LEVELS
  };
}

function lifeAreaSchema() {
  return objectSchema({
    title: stringSchema(),
    subtitle: stringSchema(),
    intro: stringSchema(),
    chart_reading: stringArraySchema('Three to five substantive paragraphs, each as a separate array item.'),
    numerology_reading: stringArraySchema('Two to three substantive paragraphs, each as a separate array item.'),
    synthesis: stringSchema(),
    confidence: confidenceSchema(),
    example: stringSchema('A concrete four-to-six-sentence real-life scenario.'),
    actions: stringArraySchema('Three to five specific executable actions.'),
    data_gaps: stringArraySchema('Exact DATA REQUIRED or CHART VERIFICATION REQUIRED statements. Empty when none.'),
    technical_basis: stringArraySchema('Short traceable statements naming the exact houses, planets, lords, Dasha levels and verified source fields used.')
  });
}

function doubleConfirmationCalloutSchema() {
  return objectSchema({
    title: stringSchema(),
    finding: stringSchema(),
    chart_planets: stringArraySchema(),
    numerology_planets: stringArraySchema(),
    action_priority: stringSchema(),
    confidence: confidenceSchema()
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
      data_required: stringArraySchema()
    }),
    cover: objectSchema({
      report_title: stringSchema(),
      client_name: stringSchema(),
      birth_data_line: stringSchema(),
      report_date: stringSchema(),
      methodology_line: stringSchema()
    }),
    how_to_read: objectSchema({
      map_and_clock_explanation: stringSchema(),
      numerology_explanation: stringSchema(),
      promises: stringArraySchema('Exactly three promises: honest confidence, no fear, and not a professional substitute.')
    }),
    numbers_at_a_glance: {
      type: 'array',
      items: objectSchema({
        label: { type: 'string', enum: ['Psychic Number', 'Destiny Number', 'Name Number', 'Personal Year'] },
        number: { type: 'integer', minimum: 1, maximum: 9 },
        planet: stringSchema(),
        plain_english_meaning: stringSchema()
      })
    },
    dominant_planets: {
      type: 'array',
      description: 'Two to four dominant planets. Use only the supplied deterministic scoring result.',
      items: objectSchema({
        planet: stringSchema(),
        score: { type: 'number' },
        reasons: stringArraySchema()
      })
    },
    double_confirmation: objectSchema({
      score: { type: 'integer', minimum: 0, maximum: 3 },
      label: { type: 'string', enum: ['Triple Confirmation', 'Strong Agreement', 'Partial Agreement', 'Divergent Design'] },
      matched_planets: stringArraySchema(),
      outlier_planets: stringArraySchema(),
      explanation: stringSchema(),
      callouts: {
        type: 'array',
        items: doubleConfirmationCalloutSchema()
      }
    }),
    current_period: objectSchema({
      chapter_table: {
        type: 'array',
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
    personal_nature: lifeAreaSchema(),
    personal_nature_weaknesses: stringArraySchema('At least two specific genuine weaknesses.'),
    past_life_karma: lifeAreaSchema(),
    past_life_symbolic_disclaimer: stringSchema(),
    finances: lifeAreaSchema(),
    double_confirmation_callouts: {
      type: 'array',
      items: doubleConfirmationCalloutSchema()
    }
  }),

  life_areas_four_to_seven: objectSchema({
    marriage: lifeAreaSchema(),
    marriage_event_distinctions: objectSchema({
      finalisation: stringSchema(),
      engagement: stringSchema(),
      marriage: stringSchema()
    }),
    health: lifeAreaSchema(),
    health_professional_line: stringSchema(),
    children: lifeAreaSchema(),
    children_medical_line: stringSchema(),
    obstruction_pattern_status: stringSchema(),
    property: lifeAreaSchema(),
    double_confirmation_callouts: {
      type: 'array',
      items: doubleConfirmationCalloutSchema()
    }
  }),

  remedies_audit_closing: objectSchema({
    remedies: {
      type: 'array',
      minItems: 4,
      maxItems: 6,
      items: objectSchema({
        priority: { type: 'integer', minimum: 1, maximum: 6 },
        planet_or_pattern: stringSchema(),
        issue_addressed: stringSchema(),
        action: stringSchema(),
        frequency: stringSchema()
      })
    },
    one_thing: stringSchema(),
    confidence_audit: {
      type: 'array',
      items: objectSchema({
        finding: stringSchema(),
        confidence: confidenceSchema(),
        basis: stringSchema(),
        limitation: stringSchema()
      })
    },
    limitations: objectSchema({
      finer_timing_precision: stringSchema(),
      next_mahadasha_change: stringSchema(),
      gemstones_and_individual_prescriptions: stringSchema()
    }),
    closing: stringSchema(),
    final_self_check: objectSchema({
      all_technical_claims_traceable: { type: 'boolean' },
      no_invented_values: { type: 'boolean' },
      current_dasha_verified_for_report_date: { type: 'boolean' },
      numerology_from_backend: { type: 'boolean' },
      double_confirmation_honest: { type: 'boolean' },
      all_seven_areas_present: { type: 'boolean' },
      health_safe: { type: 'boolean' },
      children_safe: { type: 'boolean' },
      no_gemstones: { type: 'boolean' },
      no_fear_language: { type: 'boolean' },
      at_least_one_not_claimed: { type: 'boolean' },
      no_padding: { type: 'boolean' },
      failures: stringArraySchema()
    })
  })
});

const baseInstructions = `You are a senior predictive astrologer and premium report writer working for Divya Bajaj.

This report uses Nadi-KP event-oriented logic plus independently calculated numerology. The reader has no technical astrology knowledge. Be direct, practical, respectful and easy to follow.

ANTI-FABRICATION RULE
This overrides every other instruction.
Use only values explicitly present in VERIFIED_SOURCE_DATA and BACKEND_CALCULATIONS. Never infer, estimate, reconstruct or reasonably assume a degree, Star Lord, Sub Lord, Sub-Sub Lord, cusp, Dasha date, transit position or numerology number.
When a required value is unavailable, write exactly: DATA REQUIRED: [exact missing item] - this section cannot be completed accurately without it.
When two verified sources disagree, write CHART VERIFICATION REQUIRED and state the exact discrepancy. Do not resolve it yourself.
Never pad weak findings to hit a count or length.

KP ENGINE
For every astrological finding, use this order: Houses -> Significators -> Star Lord -> Sub Lord -> Sub-Sub Lord -> Dasha/Bhukti/Antara -> Transit.
The governing principle is PROMISE -> DBA ACTIVATION -> TRANSIT CONFIRMATION.
Never start from transit. When verified transit data is absent, do not claim transit confirmation or date-level precision.
Classify planets for each event as event-promoting, facilitator, obstructive or neutral. Never label a planet universally good or bad.

HOUSE COMBINATIONS
Personal nature: Ascendant, Ascendant lord, Moon and verified planets affecting the Ascendant.
Past-life karma: Ketu, Rahu and houses 5, 9 and 12. This is symbolic only, never historical fact.
Finances: 2, 10 and 11 for earning; 2 and 11 for accumulation; 6, 8 and 12 as drains.
Marriage: 2, 7 and 11. Keep finalisation, engagement and marriage separate.
Health: 6, 8 and 12. Never name or imply a diagnosis.
Children: 2, 5 and 11. Check 1, 4 and 10 obstruction separately. Never make fertility claims.
Property: 4, 11 and 12. Use Mars and Saturn only as natural significators, then judge the verified leading planet.

DOUBLE CONFIRMATION
Use only the supplied deterministic dominant-planet scores and backend numerology planet mapping. Never manufacture agreement.
3 of 3 = Triple Confirmation.
2 of 3 = Strong Agreement.
1 of 3 = Partial Agreement.
0 of 3 = Divergent Design.
Explain genuine tension when numbers and chart differ.

VOICE
Use second person throughout. Explain every technical term immediately in plain language. Use concrete examples and analogies. No mystic language, textbook language, fear, flattery, generic sales copy or em dashes.

SAFETY
Health: never diagnose, predict death, terminal illness or incurability. Include: use this as a prompt to book the check-up, never as a reason to skip one.
Children: never state whether the client will or will not have children, and never comment on fertility. State that conception and pregnancy questions belong to doctors.
Past life: symbolic only.
No criminal, violence or scandal predictions.
No claim that this substitutes for medical, legal or financial advice.
No gemstone recommendations. No paid rituals. No products.
Remedies may be behavioural, lifestyle, professional or free traditional practices only.

CONFIDENCE
Very High: house combination, Star Lord, Sub Lord, current Dasha and numerology agree.
High: house combination, current Dasha and one confirming layer agree.
Medium: house combination and current Dasha agree, but one layer is unclear or absent.
Not claimed: the source does not support the requested precision.
At least one major audit row must be Not claimed.`;

const stageInstructions = Object.freeze({
  verification_big_picture: `First verify the chart and current Dasha for REPORT_DATE. If source_verification contains blocking issues, preserve them exactly and do not claim the affected finding. Produce the cover, how-to-read section, numbers table, deterministic dominant-planet result, honest Double Confirmation score and current period chapter.`,
  life_areas_one_to_three: `Write Personal Nature, Past Life Karma and Finances. Each area must contain every required internal component. Personal Nature must name at least two specific weaknesses. Past-life material must explicitly say it is symbolic. Use the supplied Stage 1 result as context without changing any verified fact or score.`,
  life_areas_four_to_seven: `Write Marriage, Health, Children and Property. Keep marriage finalisation, engagement and marriage distinct. Apply every health and children safety rule. State the result of the 1+4+10 obstruction check honestly. Use the supplied earlier stages as context without changing verified facts.`,
  remedies_audit_closing: `Write four to six remedies only for patterns already established in earlier stages. Add the one highest-leverage action, honest confidence audit, limitations, closing and final self-check. Include at least one Not claimed audit row. No gemstones, paid rituals or products.`
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
  PROMPT_VERSION,
  REPORT_CONTRACT_VERSION,
  baseInstructions,
  buildStagePrompt,
  responseFormatForStage,
  stageInstructions,
  stageSchemas
};