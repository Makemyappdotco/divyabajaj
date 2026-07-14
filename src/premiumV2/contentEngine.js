const { FORBIDDEN_PHRASES, FIELD_LIMITS } = require('./spec');

function str(description = '') {
  return { type: 'string', description };
}

function stringArray(count, description = '') {
  return {
    type: 'array',
    description,
    minItems: count,
    maxItems: count,
    items: { type: 'string' }
  };
}

function object(properties) {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties)
  };
}

function objectArray(count, properties) {
  return {
    type: 'array',
    minItems: count,
    maxItems: count,
    items: object(properties)
  };
}

const MASTER_SCHEMA = object({
  executive_summary: object({
    core_pattern: str(),
    strongest_asset: str(),
    biggest_challenge: str(),
    current_priority: str()
  }),
  identity: object({
    outer_personality: str(),
    inner_pattern: str(),
    decision_pattern: str(),
    strengths: stringArray(6),
    blind_spots: stringArray(5)
  }),
  career_money: object({
    work_style: str(),
    suitable_directions: stringArray(5),
    business_fit: str(),
    money_pattern: str(),
    money_risks: stringArray(4),
    money_system: stringArray(5)
  }),
  relationships: object({
    emotional_need: str(),
    love_style: str(),
    triggers: str(),
    conflict_pattern: str(),
    communication_pattern: str(),
    improvements: stringArray(6)
  }),
  current_year: object({
    theme: str(),
    explanation: str(),
    career: str(),
    money: str(),
    relationships: str(),
    health_routine: str(),
    focus: stringArray(4),
    avoid: stringArray(4)
  }),
  next_12_months: object({
    intro: str(),
    phases: objectArray(4, {
      label: str(),
      title: str(),
      body: str()
    }),
    decision_rule: str()
  }),
  long_term: object({
    intro: str(),
    steps: objectArray(4, {
      title: str(),
      body: str()
    }),
    long_term_filter: str(),
    slow_down_factors: stringArray(5),
    simple_formula: stringArray(4)
  }),
  hidden_patterns: object({
    central_contradiction: str(),
    repeated_number_pattern: str(),
    missing_number_guidance: objectArray(3, {
      number: str(),
      title: str(),
      body: str()
    }),
    planes: objectArray(3, {
      name: str(),
      level: str(),
      body: str()
    })
  }),
  guidance: object({
    intro: str(),
    habit_to_build: str(),
    pattern_to_stop: str(),
    environment_change: str(),
    number_guidance: str(),
    spiritual_practice: str(),
    personal_reminder: str(),
    gemstone_note: str()
  }),
  action_plan: object({
    intro: str(),
    weeks: objectArray(4, {
      title: str(),
      actions: stringArray(4)
    }),
    day_30_commitment: str()
  }),
  deeper_reading: object({
    intro: str(),
    areas: objectArray(4, {
      title: str(),
      body: str()
    }),
    direct_questions: stringArray(6),
    closing: str()
  }),
  closing: object({
    hero: str(),
    paragraph_1: str(),
    paragraph_2: str(),
    paragraph_3: str()
  })
});

const PAGE_SCHEMA = object({
  page_1: object({
    subtitle: str(),
    prepared_for_label: str()
  }),
  page_2: object({
    hero_statement: str(),
    insights: objectArray(8, {
      key: str(),
      title: str(),
      body: str()
    })
  }),
  page_3: object({
    number_cards: objectArray(4, {
      label: str(),
      value: str(),
      short_meaning: str(),
      interpretation: str()
    }),
    interplay_headline: str(),
    interplay_body: str(),
    success_formula: str(),
    contradiction: str()
  }),
  page_4: object({
    how_people_see_you: str(),
    what_is_happening_inside: str(),
    strengths: stringArray(6),
    decision_steps: objectArray(4, {
      title: str(),
      body: str()
    }),
    blind_spots: stringArray(5),
    birth_detail_lens: str()
  }),
  page_5: object({
    hero_quote: str(),
    work_best_when: stringArray(4),
    what_to_avoid: stringArray(4),
    career_directions: objectArray(5, {
      title: str(),
      body: str()
    }),
    job_vs_business: str(),
    money_system: stringArray(5)
  }),
  page_6: object({
    hero_statement: str(),
    cards: objectArray(4, {
      title: str(),
      body: str()
    }),
    communication_pattern: str(),
    improvements: stringArray(6),
    strongest_fit: str()
  }),
  page_7: object({
    year_label: str(),
    theme_title: str(),
    intro: str(),
    cards: objectArray(4, {
      title: str(),
      body: str()
    }),
    focus: stringArray(4),
    avoid: stringArray(4),
    decision_filter: str()
  }),
  page_8: object({
    intro: str(),
    phases: objectArray(4, {
      label: str(),
      title: str(),
      body: str()
    }),
    rule_72_hour: str()
  }),
  page_9: object({
    intro: str(),
    steps: objectArray(4, {
      number: str(),
      title: str(),
      body: str()
    }),
    long_term_filter: str(),
    slow_down: stringArray(5),
    simple_formula: stringArray(4)
  }),
  page_10: object({
    central_contradiction: str(),
    repeated_number_pattern: str(),
    missing_guidance: objectArray(3, {
      number: str(),
      title: str(),
      body: str()
    }),
    planes: objectArray(3, {
      name: str(),
      level: str(),
      body: str()
    })
  }),
  page_11: object({
    intro: str(),
    cards: objectArray(6, {
      title: str(),
      body: str()
    }),
    gemstone_note: str()
  }),
  page_12: object({
    intro: str(),
    weeks: objectArray(4, {
      week: str(),
      title: str(),
      actions: stringArray(4)
    }),
    closing: str()
  }),
  page_13: object({
    intro: str(),
    areas: objectArray(4, {
      title: str(),
      body: str()
    }),
    questions: stringArray(6),
    closing: str()
  }),
  page_14: object({
    hero: str(),
    paragraphs: stringArray(3),
    signoff_name: str(),
    signoff_role: str()
  })
});

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data.output || [])
    .flatMap(item => item.content || [])
    .map(item => item.text || '')
    .join('\n')
    .trim();
}

async function callStructured({ name, schema, system, user, maxOutputTokens = 9000 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  const model = process.env.OPENAI_PAID_MODEL || 'gpt-5.5';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'none' },
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name,
          strict: true,
          schema
        }
      }
    })
  });

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch (error) { throw new Error(`OpenAI returned invalid JSON envelope: ${raw.slice(0, 300)}`); }

  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI ${model} request failed with ${response.status}`);
  }

  const text = extractOutputText(data);
  if (!text) throw new Error('OpenAI returned no structured output text');

  try {
    return { data: JSON.parse(text), model };
  } catch (error) {
    throw new Error(`Structured output could not be parsed: ${text.slice(0, 300)}`);
  }
}

function styleRules() {
  return `
WRITING VOICE:
- Natural, direct, grounded Indian English.
- Sound like Divya personally studied the person and is explaining patterns clearly.
- No em dash character anywhere. Use commas, full stops, semicolons or parentheses instead.
- Never use generic AI vocabulary or motivational filler.
- Avoid these phrases and close variants: ${FORBIDDEN_PHRASES.join(', ')}.
- Do not repeatedly begin sentences with "You may", "This suggests", "This indicates" or "It is important to".
- Do not repeat the same insight across sections. Explain the core pattern once, then apply it to career, money or relationships without restating it fully.
- Every line must explain a pattern, clarify a decision or give practical guidance.
- Never claim exact houses, dashas, planetary positions, fixed event dates or fixed gemstone prescriptions unless the fact ledger explicitly marks astrology as verified.
- No fear-based predictions. No guaranteed outcomes. No medical diagnosis.
`;
}

async function createMasterInterpretation(factLedger) {
  const system = `You are the senior interpretation editor for Divya Bajaj's premium personal report. Create one central interpretation that becomes the single source of truth for every report page.${styleRules()}`;
  const user = `Build the master interpretation from this immutable fact ledger. Do not alter any deterministic number. Connect the numbers together instead of writing textbook definitions. The customer's main concern should influence emphasis but must not distort the facts.\n\nFACT LEDGER:\n${JSON.stringify(factLedger, null, 2)}`;
  return callStructured({
    name: 'divya_master_interpretation_v2',
    schema: MASTER_SCHEMA,
    system,
    user,
    maxOutputTokens: 10500
  });
}

async function createPageContent(factLedger, masterInterpretation) {
  const system = `You are the page-content editor for a fixed 14-page premium Divya Bajaj report. You write FOR THE DESIGN, not as an essay. Use the master interpretation as the source of meaning and the fact ledger as the source of truth.${styleRules()}

STRICT DESIGN-COPY RULES:
- Keep every field concise enough for the page it belongs to.
- Do not repeat core numbers outside Page 3 unless a number is essential to explain a current-year or hidden-pattern point.
- Page 2 must give immediate value in less than two minutes of reading.
- Page 8 must use four broad phases, not fake month-by-month predictions.
- Page 10 must use the exact deterministic Lo Shu values from the fact ledger.
- Page 13 must identify genuinely useful deeper-reading questions based on this customer, not generic sales copy.
- Page 14 must sound personal and memorable.
- Never use an em dash.

FIELD LIMIT GUIDE:\n${JSON.stringify(FIELD_LIMITS, null, 2)}`;

  const user = `Create the final structured content for all 14 pages.\n\nFACT LEDGER:\n${JSON.stringify(factLedger, null, 2)}\n\nMASTER INTERPRETATION:\n${JSON.stringify(masterInterpretation, null, 2)}`;

  return callStructured({
    name: 'divya_premium_pages_v2',
    schema: PAGE_SCHEMA,
    system,
    user,
    maxOutputTokens: 14500
  });
}

async function generateStructuredPremiumContent(factLedger) {
  const startedAt = Date.now();
  const master = await createMasterInterpretation(factLedger);
  const pages = await createPageContent(factLedger, master.data);
  return {
    master_interpretation: master.data,
    pages: pages.data,
    model: pages.model,
    generation_ms: Date.now() - startedAt
  };
}

module.exports = {
  MASTER_SCHEMA,
  PAGE_SCHEMA,
  generateStructuredPremiumContent,
  createMasterInterpretation,
  createPageContent
};
