const { calcAllNumbers } = require('./numerology');

function getPaidModel() {
  return process.env.OPENAI_PAID_MODEL || 'gpt-5.5';
}

function extractText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (data && data.output || [])
    .flatMap(item => item.content || [])
    .map(item => item.text || '')
    .join('\n')
    .trim();
}

async function callPart(prompt, label) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing in Vercel environment variables');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);

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
        max_output_tokens: 3600
      })
    });

    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = { raw };
    }

    if (!response.ok) {
      const message = data?.error?.message || data?.raw || `OpenAI returned status ${response.status}`;
      throw new Error(`${label}: ${message}`);
    }

    const text = extractText(data);
    if (!text) throw new Error(`${label}: OpenAI returned empty text`);
    return text;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${label}: generation took too long`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function commonContext({ name, dob, tob, pob, question, numbers }) {
  return `You are writing a premium paid Astrology + Numerology Full Blueprint Report for Divya Bajaj.

CLIENT DETAILS
Name: ${name}
Date of Birth: ${dob}
Time of Birth: ${tob}
Place of Birth: ${pob}
Main concern: ${question || 'Complete life clarity'}

CALCULATED NUMEROLOGY DATA
${JSON.stringify(numbers, null, 2)}

WRITING RULES
- Write in simple, natural Indian English.
- Sound like Divya Bajaj personally reviewed the client's patterns and explained them clearly.
- Be direct, warm, practical and specific.
- No AI language, no template language, no filler and no repeated points.
- No fear-based predictions or guaranteed outcomes.
- Use short paragraphs and useful bullet points.
- Explain what each pattern means in normal real life.
- Astrology content must remain birth-detail based unless exact chart calculations are supplied. Do not invent planetary degrees, dashas, houses or fixed event dates.
- Health content is lifestyle, routine and energy awareness only, not diagnosis.
- Money content covers habits, planning, consistency and risk style, not guaranteed income.
- Relationship content covers patterns, needs and communication, not fixed marriage dates.
- Do not add an introduction outside the requested numbered sections.
`;
}

function buildPartPrompts(input) {
  const common = commonContext(input);

  return [
    `${common}
Write PART 1 of the report, around 1,050 to 1,300 words.

Use exactly these numbered headings:
1. Personal Opening From Divya
2. Your Full Blueprint Summary
3. Birth Detail Based Astrology Overview
4. Numerology Core Number Summary
5. Ruling Number Deep Reading
6. Destiny Number Deep Reading
7. Name Number and Public Energy
8. Lo Shu Grid Deep Reading
9. Missing Numbers, Repeated Numbers and Life Lessons

Make this part feel highly personal. Connect the numbers together instead of explaining them as isolated textbook definitions. End section 9 naturally.`,

    `${common}
Write PART 2 of the report, around 1,050 to 1,300 words.

Use exactly these numbered headings:
10. Mental, Emotional and Practical Planes
11. Personality Pattern and Inner Nature
12. Career Direction and Work Style
13. Best Suited Professions and Business Directions
14. Money Pattern and Growth Advice
15. Relationship and Marriage Pattern
16. Family, Communication and Emotional Triggers
17. Health, Energy and Routine Awareness
18. The Decisions That Need More Attention

Make the career, money and relationship sections especially useful. Give specific practical observations, not generic motivational lines.`,

    `${common}
Write PART 3 of the report, around 1,050 to 1,300 words.

Use exactly these numbered headings:
19. Current Year Guidance
20. Next 12 Months Focus
21. Next 3 to 5 Year Direction
22. Name Correction and Business Number Notes
23. Mobile Number, House Number and Daily Environment Notes
24. Gemstone and Remedy Direction
25. Practical 30-Day Action Plan
26. What Divya Would Personally Ask In A Consultation
27. Final Guidance and Next Step

For future guidance, discuss themes and decision windows rather than guaranteed events. Give a clear 30-day action plan. End with a graceful invitation to consult Divya for exact chart-level guidance.

Current placeholder contact details:
Website: https://divyabajaj.com
Instagram: https://instagram.com/divyabajaj
WhatsApp: +91 99999 99999
Email: hello@divyabajaj.com`
  ];
}

async function generatePaidReport({ name, dob, tob, pob, question }) {
  const numbers = calcAllNumbers(name, dob);
  const prompts = buildPartPrompts({ name, dob, tob, pob, question, numbers });
  const startedAt = Date.now();

  const [part1, part2, part3] = await Promise.all([
    callPart(prompts[0], 'Report part 1'),
    callPart(prompts[1], 'Report part 2'),
    callPart(prompts[2], 'Report part 3')
  ]);

  const reportText = [part1, part2, part3].join('\n\n').trim();

  return {
    generated: true,
    model: getPaidModel(),
    numbers,
    astrology_data: {
      source: 'birth_details_guidance_plus_numerology',
      dob,
      tob,
      pob,
      note: 'This test build uses submitted birth details for astrology-style guidance. Connect an exact astrology calculation engine before selling exact chart-level predictions.'
    },
    report_text: reportText,
    generation_ms: Date.now() - startedAt,
    insights: {
      concerns: question ? [question] : []
    }
  };
}

module.exports = { generatePaidReport, getPaidModel };
