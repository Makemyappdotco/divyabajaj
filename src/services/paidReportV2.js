const { generateSourceBundle } = require('./astrologyApiV2');

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

function compactSource(bundle) {
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
    planets,
    current_vdasha: bundle?.current_vdasha?.ok ? bundle.current_vdasha.data : null,
    current_vdasha_all: bundle?.current_vdasha_all?.ok ? bundle.current_vdasha_all.data : null,
    numerological_numbers: bundle?.numerological_numbers?.ok ? bundle.numerological_numbers.data : null,
    numero_table: bundle?.numero_table?.ok ? bundle.numero_table.data : null,
    charts
  };
}

function buildPrompt(input, source) {
  return `You are preparing a paid Astrology + Numerology Full Blueprint for Divya Bajaj.

CLIENT
Name: ${input.name}
Gender: ${input.gender}
Date of birth: ${input.dob}
Time of birth: ${input.tob}
Place of birth: ${input.pob}
Birth-time accuracy: ${input.birth_time_accuracy || 'not stated'}
Main concern: ${input.question || 'Complete life clarity'}

VERIFIED ASTROLOGYAPI SOURCE DATA
${JSON.stringify(source, null, 2)}

IMPORTANT ACCURACY RULES
- Use only facts supported by the source data.
- Never invent a planet, house, sign, nakshatra, dasha, date, degree or numerology number.
- When a field is missing, write that it needs a deeper personal reading instead of guessing.
- Do not predict guaranteed events, medical diagnoses, exact marriage dates or guaranteed money outcomes.
- Keep the language very simple, natural Indian English.
- Sound warm, direct and practical, like Divya personally explaining the report.
- Do not use em dashes.
- Avoid AI phrases such as unlock, profound, tapestry, transformative journey, navigate, multifaceted and embrace.
- Give complete value. The consultation recommendation must be based on areas that genuinely require personal context, timing or comparison.

Return ONLY valid JSON with exactly this shape:
{
  "executive_summary": {
    "core_nature": "",
    "strongest_advantage": "",
    "main_challenge": "",
    "current_focus": ""
  },
  "astrology_foundation": {
    "ascendant": "",
    "moon_sign": "",
    "sun_sign": "",
    "nakshatra": "",
    "summary": ""
  },
  "chart_insights": [
    {"title":"", "explanation":"", "practical_effect":""}
  ],
  "dasha": {
    "major": "",
    "minor": "",
    "period": "",
    "theme": "",
    "opportunities": [""],
    "cautions": [""]
  },
  "numerology": {
    "core_numbers": [{"label":"", "number":"", "meaning":""}],
    "synthesis": ""
  },
  "career_money": {
    "summary": "",
    "strengths": [""],
    "risks": [""],
    "actions": [""]
  },
  "relationships": {
    "summary": "",
    "needs": [""],
    "triggers": [""],
    "actions": [""]
  },
  "next_12_months": [
    {"phase":"Phase 1", "focus":"", "opportunity":"", "caution":"", "action":""},
    {"phase":"Phase 2", "focus":"", "opportunity":"", "caution":"", "action":""},
    {"phase":"Phase 3", "focus":"", "opportunity":"", "caution":"", "action":""},
    {"phase":"Phase 4", "focus":"", "opportunity":"", "caution":"", "action":""}
  ],
  "guidance": [
    {"title":"", "reason":"", "action":""}
  ],
  "action_plan": [
    {"week":"Week 1", "actions":[""]},
    {"week":"Week 2", "actions":[""]},
    {"week":"Week 3", "actions":[""]},
    {"week":"Week 4", "actions":[""]}
  ],
  "consultation": {
    "headline": "",
    "reasons": [""],
    "closing": ""
  }
}`;
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);

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
        max_output_tokens: 7500
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
    if (error.name === 'AbortError') throw new Error('Structured report generation took too long');
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

function section(number, title, body) {
  return `${number}. ${title}\n${String(body || '').trim()}`;
}

function reportTextFromJson(report, input) {
  const summary = report.executive_summary || {};
  const astro = report.astrology_foundation || {};
  const dasha = report.dasha || {};
  const numerology = report.numerology || {};
  const career = report.career_money || {};
  const relationships = report.relationships || {};
  const consultation = report.consultation || {};

  const chartInsights = (report.chart_insights || []).map(item =>
    `${item.title}\n${item.explanation}\nPractical effect: ${item.practical_effect}`
  ).join('\n\n');

  const coreNumbers = (numerology.core_numbers || []).map(item =>
    `${item.label}: ${item.number}\n${item.meaning}`
  ).join('\n\n');

  const phases = (report.next_12_months || []).map(item =>
    `${item.phase}\nFocus: ${item.focus}\nOpportunity: ${item.opportunity}\nCaution: ${item.caution}\nBest action: ${item.action}`
  ).join('\n\n');

  const guidance = (report.guidance || []).map(item =>
    `${item.title}\nWhy: ${item.reason}\nAction: ${item.action}`
  ).join('\n\n');

  const actionPlan = (report.action_plan || []).map(item =>
    `${item.week}\n${list(item.actions)}`
  ).join('\n\n');

  return [
    section(1, 'Personal Opening From Divya', `${input.name}, this report combines your verified birth-chart calculations and numerology data into one practical reading. It focuses especially on ${input.question || 'your overall life direction'}.`),
    section(2, 'Your Blueprint in 90 Seconds', `Core nature: ${summary.core_nature}\n\nStrongest advantage: ${summary.strongest_advantage}\n\nMain challenge: ${summary.main_challenge}\n\nCurrent focus: ${summary.current_focus}`),
    section(3, 'Your Astrological Foundation', `Ascendant: ${astro.ascendant}\nMoon sign: ${astro.moon_sign}\nSun sign: ${astro.sun_sign}\nNakshatra: ${astro.nakshatra}\n\n${astro.summary}`),
    section(4, 'Your Main Chart Insights', chartInsights),
    section(5, 'Your Current Dasha', `Major period: ${dasha.major}\nMinor period: ${dasha.minor}\nPeriod: ${dasha.period}\n\n${dasha.theme}\n\nOpportunities\n${list(dasha.opportunities)}\n\nCautions\n${list(dasha.cautions)}`),
    section(6, 'Your Core Numerology', `${coreNumbers}\n\nHow the numbers work together\n${numerology.synthesis}`),
    section(7, 'Career, Business and Money', `${career.summary}\n\nStrengths\n${list(career.strengths)}\n\nRisks\n${list(career.risks)}\n\nActions\n${list(career.actions)}`),
    section(8, 'Relationships and Emotional Pattern', `${relationships.summary}\n\nWhat you need\n${list(relationships.needs)}\n\nCommon triggers\n${list(relationships.triggers)}\n\nWhat will help\n${list(relationships.actions)}`),
    section(9, 'Your Next 12 Months', phases),
    section(10, 'Your Personal Guidance', guidance),
    section(11, 'Your 30-Day Action Plan', actionPlan),
    section(12, 'What Deserves a Personal Reading', `${consultation.headline}\n\n${list(consultation.reasons)}\n\n${consultation.closing}`),
    section(13, 'Personal Closing From Divya', `${input.name}, use this report as a practical reference rather than a fixed prediction. The most useful next step is to observe which patterns are already active in your real life and take the actions listed here consistently. For exact timing, comparison between choices or a deeper personal question, you can book a one-to-one consultation with Divya Bajaj.`)
  ].join('\n\n');
}

async function generatePaidReportV2(input, { includePdfs = false } = {}) {
  const startedAt = Date.now();
  const sourceBundle = await generateSourceBundle(input, { includePdfs });
  const compact = compactSource(sourceBundle);
  const raw = await callOpenAI(buildPrompt(input, compact));
  const reportJson = parseJson(raw);
  const reportText = reportTextFromJson(reportJson, input);

  return {
    generated: true,
    model: getPaidModel(),
    report_json: reportJson,
    report_text: reportText,
    astrology_data: {
      provider: 'AstrologyAPI',
      planets: sourceBundle.planets,
      current_vdasha: sourceBundle.current_vdasha,
      current_vdasha_all: sourceBundle.current_vdasha_all,
      charts: sourceBundle.charts,
      chart_images: sourceBundle.chart_images
    },
    numerology_data: {
      provider: 'AstrologyAPI',
      numerological_numbers: sourceBundle.numerological_numbers,
      numero_table: sourceBundle.numero_table
    },
    source_pdfs: sourceBundle.pdfs,
    source_bundle: sourceBundle,
    generation_ms: Date.now() - startedAt,
    insights: { concerns: input.question ? [input.question] : [] }
  };
}

module.exports = { generatePaidReportV2, getPaidModel, reportTextFromJson };