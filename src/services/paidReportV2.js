const { generateSourceBundle } = require('./astrologyApiV2');
const { calculateNumerology } = require('./numerologyEngine');
const { verifySourceBundle } = require('./reportVerification');

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
  return `You are preparing The Integrated Life Report for Divya Bajaj.

CLIENT
Name: ${input.name}
Gender: ${input.gender}
Date of birth: ${input.dob}
Time of birth: ${input.tob}
Place of birth: ${input.pob}
Birth-time accuracy: ${input.birth_time_accuracy || 'not stated'}
Main concern: ${input.question || 'Complete life clarity'}

VERIFIED ASTROLOGYAPI SOURCE DATA AND BACKEND NUMEROLOGY
${JSON.stringify(source, null, 2)}

REPORT CONTRACT
Follow this exact customer-facing structure and logic:
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

The seven life areas are Personal Nature, Past Life Karma, Finances, Marriage, Health, Children and Property. For every life area use the same reading rhythm:
- a short introduction
- What your birth chart shows
- What your numbers show
- Where the two systems agree
- Where they genuinely pull against each other, or clearly say that one system is silent
- Timing only when supported
- What to actually do about it
- Confidence, with a short reason for that confidence

METHOD
- KP Astrology is the primary analytical map.
- Numerology is an independent second opinion, not a replacement for astrology.
- Treat deterministic_numerology as the primary numerology source.
- The deterministic Name Number is Chaldean. Do not call it Pythagorean.
- Use the five deterministic Personal Year values in personal_years for the timing map.
- The report may describe convergence, tension and silence. Never force the systems to agree.
- Do not claim that a separate Nadi calculation was performed. Divya may practise Nadi Astrology, but this automated report currently has verified KP Astrology plus Numerology source data only.

ACCURACY RULES
- Use only facts supported by the supplied source data.
- Never invent a planet, house, sign, nakshatra, dasha, date, degree, Star Lord, Sub Lord, Sub-Sub Lord, cusp, significator or numerology number.
- Read source_verification before writing. Never override a blocking issue or discrepancy.
- Use KP planets, cusps and significator maps only when the corresponding kp_source_status value is true and the actual data is present.
- When evidence is insufficient, say so plainly. Do not fill the gap with a generic prediction.
- Do not create exact event dates unless the verified dasha source genuinely supports that precision.
- Past Life Karma must be presented as symbolic traditional interpretation, not documented historical fact.
- Health: no diagnosis, disease prediction, medication advice or treatment advice. Encourage qualified medical guidance for real symptoms or concerns.
- Children: no fertility guarantees and no claim that someone definitely can or cannot conceive.
- Finances: no guaranteed income, returns or investment outcomes.
- Marriage: no guaranteed marriage date or guaranteed relationship outcome.
- Remedies: behavioural first, professional or structural second, optional traditional observance last.
- Do not recommend a gemstone in this report. State that gemstone assessment requires a separate dedicated evaluation.
- No fear-based language, curses, threats or remedy sales tactics.

WRITING STYLE
- Plain, natural English that a normal customer can understand.
- Warm, direct and practical, as if Divya is explaining the report personally.
- No em dashes.
- Avoid robotic phrases and vague spiritual filler.
- Every paragraph should add interpretation, evidence, limitation, action or useful synthesis.
- Do not repeat the same observation in multiple sections unless the new section adds a genuinely different implication.
- Target roughly 3,800 to 4,800 words. The client's sample is intentionally more detailed than the desired live report, so keep the same depth and structure but edit tightly.

Return ONLY valid JSON with exactly this shape:
{
  "primer": {
    "purpose": "",
    "systems": "",
    "kp_plain_language": "",
    "numerology_plain_language": "",
    "convergence_method": "",
    "limits": ["", ""]
  },
  "glance": {
    "astrology": [
      {"element":"", "position":"", "plain_meaning":""}
    ],
    "numerology": [
      {"label":"", "value":"", "ruling_planet":"", "derived_from":"", "plain_meaning":""}
    ],
    "headline_finding": ""
  },
  "life_areas": {
    "personal_nature": {
      "intro":"",
      "birth_chart":"",
      "numbers":"",
      "convergence":"",
      "tension_or_silence":"",
      "timing":[""],
      "actions":[""],
      "confidence":""
    },
    "past_life_karma": {
      "intro":"",
      "birth_chart":"",
      "numbers":"",
      "convergence":"",
      "tension_or_silence":"",
      "timing":[""],
      "actions":[""],
      "confidence":""
    },
    "finances": {
      "intro":"",
      "birth_chart":"",
      "numbers":"",
      "convergence":"",
      "tension_or_silence":"",
      "timing":[""],
      "actions":[""],
      "confidence":""
    },
    "marriage": {
      "intro":"",
      "birth_chart":"",
      "numbers":"",
      "convergence":"",
      "tension_or_silence":"",
      "timing":[""],
      "actions":[""],
      "confidence":""
    },
    "health": {
      "intro":"",
      "birth_chart":"",
      "numbers":"",
      "convergence":"",
      "tension_or_silence":"",
      "timing":[""],
      "actions":[""],
      "confidence":""
    },
    "children": {
      "intro":"",
      "birth_chart":"",
      "numbers":"",
      "convergence":"",
      "tension_or_silence":"",
      "timing":[""],
      "actions":[""],
      "confidence":""
    },
    "property": {
      "intro":"",
      "birth_chart":"",
      "numbers":"",
      "convergence":"",
      "tension_or_silence":"",
      "timing":[""],
      "actions":[""],
      "confidence":""
    }
  },
  "remedies": {
    "intro":"",
    "behavioural":[{"pattern":"", "practice":"", "rhythm":"", "purpose":""}],
    "professional_structural":[""],
    "traditional_observance":[{"planet":"", "why":"", "observance":""}],
    "gemstone_note":""
  },
  "timing_map": [
    {"period":"", "astrology":"", "numerology":"", "combined_reading":"", "confidence":""}
  ],
  "closing_summary":["", "", "", "", ""],
  "scope_limitations":["", "", "", ""]
}`;
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240000);

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
        max_output_tokens: 10000
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
    `Confidence:\n${area.confidence || 'Limited by the available verified data.'}`
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

function timingMapText(items) {
  return (Array.isArray(items) ? items : []).filter(Boolean).map(item =>
    `${item.period}\nAstrological chapter: ${item.astrology}\nNumerological year: ${item.numerology}\nCombined reading: ${item.combined_reading}\nConfidence: ${item.confidence}`
  ).join('\n\n');
}

function reportTextFromJson(report) {
  const primer = report.primer || {};
  const glance = report.glance || {};
  const areas = report.life_areas || {};

  return [
    `1. How To Read This Report\n${primer.purpose}\n\nThe two systems used here:\n${primer.systems}\n\nKP Astrology in plain language:\n${primer.kp_plain_language}\n\nNumerology in plain language:\n${primer.numerology_plain_language}\n\nThe convergence method:\n${primer.convergence_method}\n\nWhat this report will not do:\n${list(primer.limits)}`,
    `2. Your Chart And Numbers At A Glance\nThe astrological layer:\n${formatGlanceRows(glance.astrology, 'astrology')}\n\nThe numerological layer:\n${formatGlanceRows(glance.numerology, 'numerology')}\n\nHeadline finding:\n${glance.headline_finding || ''}`,
    `3. Personal Nature: Strengths And Weaknesses\n${lifeAreaText(areas.personal_nature)}`,
    `4. Past Life Karma\n${lifeAreaText(areas.past_life_karma)}`,
    `5. Finances\n${lifeAreaText(areas.finances)}`,
    `6. Marriage And Partnership\n${lifeAreaText(areas.marriage)}`,
    `7. Health And Constitution\n${lifeAreaText(areas.health)}`,
    `8. Children\n${lifeAreaText(areas.children)}`,
    `9. Property Purchase\n${lifeAreaText(areas.property)}`,
    `10. Remedies\n${remediesText(report.remedies)}`,
    `11. Your Timing Map\n${timingMapText(report.timing_map)}`,
    `12. Closing Summary\n${list(report.closing_summary)}`,
    `13. Scope And Limitations\n${list(report.scope_limitations)}`
  ].join('\n\n');
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
  const raw = await callOpenAI(buildPrompt(input, compact));
  const reportJson = parseJson(raw);
  const reportText = reportTextFromJson(reportJson);

  return {
    generated: true,
    model: getPaidModel(),
    report_contract_version: 'integrated-life-report-v1',
    report_json: reportJson,
    report_text: reportText,
    verification,
    astrology_data: {
      provider: 'AstrologyAPI',
      note: 'This Integrated Life Report uses verified AstrologyAPI planetary positions, KP planets, KP house cusps, significator maps, chart calculations and Vimshottari Dasha data based on the submitted birth details. It does not claim a separate automated Nadi calculation.',
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

module.exports = { generatePaidReportV2, getPaidModel, reportTextFromJson };
