const { calcAllNumbers } = require('./numerology');

function getPaidModel() {
  return process.env.OPENAI_PAID_MODEL || 'gpt-5.5';
}

function buildPrompt({ name, dob, tob, pob, question, numbers }) {
  const sections = [
    'Personal Opening From Divya',
    'Your Full Blueprint Summary',
    'Birth Detail Based Astrology Overview',
    'Numerology Core Number Summary',
    'Ruling Number Deep Reading',
    'Destiny Number Deep Reading',
    'Name Number and Public Energy',
    'Lo Shu Grid Deep Reading',
    'Missing Numbers and Life Lessons',
    'Repeated Numbers and Strong Patterns',
    'Mental, Emotional and Practical Planes',
    'Personality Pattern and Inner Nature',
    'Career Direction and Work Style',
    'Best Suited Professions and Business Directions',
    'Money Pattern and Growth Advice',
    'Relationship and Marriage Pattern',
    'Family, Communication and Emotional Triggers',
    'Health, Energy and Routine Awareness',
    'Current Year Guidance',
    'Next 12 Months Focus',
    'Next 3 to 5 Year Direction',
    'Name Correction and Business Number Notes',
    'Mobile Number, House Number and Daily Environment Notes',
    'Gemstone and Remedy Direction',
    'Practical 30-Day Action Plan',
    'What Divya Would Personally Ask In A Consultation',
    'Final Guidance and Next Step'
  ];

  return [
    'Write a premium paid Astrology + Numerology Full Blueprint Report for Divya Bajaj.',
    '',
    'The report must feel personally written by Divya Bajaj in simple Indian English. It should be highly detailed, practical, clear, premium, readable and non-repetitive. Do not mention AI, prompts, models, tokens, testing or payment gateway.',
    '',
    'Accuracy rule: Use the supplied birth details and numerology calculations. Do not invent exact planetary degrees, dashas, divisional charts, house placements, fixed dates or guaranteed events when exact astrology-engine data is unavailable. Keep astrology guidance honest, birth-detail based and practical.',
    '',
    `Client Name: ${name}`,
    `Date of Birth: ${dob}`,
    `Time of Birth: ${tob}`,
    `Place of Birth: ${pob}`,
    `Main Concern: ${question || 'Complete life clarity'}`,
    '',
    'Calculated Numerology Data:',
    JSON.stringify(numbers, null, 2),
    '',
    'Create a detailed report of approximately 4500 to 6500 words. Use short paragraphs, useful bullets, real-life examples, practical advice, section summaries and clear action points.',
    '',
    'Required sections:',
    sections.map((section, index) => `${index + 1}. ${section}`).join('\n'),
    '',
    'Health guidance must remain limited to lifestyle, routine and energy awareness and must not diagnose. Money guidance must focus on habits, planning, consistency and risk style without promises. Relationship guidance must discuss patterns and communication without fixed marriage dates. Remedies must be safe, simple and clearly explained.',
    '',
    'End with a graceful recommendation for a personal consultation when exact chart-level guidance is required.',
    '',
    'Current test contact details:',
    'Website: https://divyabajaj.com',
    'Instagram: https://instagram.com/divyabajaj',
    'WhatsApp: +91 99999 99999',
    'Email: hello@divyabajaj.com'
  ].join('\n');
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

async function openAI(path, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing in Vercel environment variables');

  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {})
    }
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    data = { raw };
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.raw || `Request failed with status ${response.status}`;
    throw new Error(`OpenAI error using ${getPaidModel()}: ${message}`);
  }

  return data;
}

async function startPaidBackground({ name, dob, tob, pob, question }) {
  const numbers = calcAllNumbers(name, dob);
  const model = getPaidModel();
  const prompt = buildPrompt({ name, dob, tob, pob, question, numbers });

  const response = await openAI('/responses', {
    method: 'POST',
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 10000,
      background: true,
      store: true
    })
  });

  if (!response.id) throw new Error('OpenAI did not return a background response ID');

  return {
    responseId: response.id,
    status: response.status || 'queued',
    model,
    numbers,
    astrologyData: {
      source: 'birth_details_prompt_based_paid_test',
      dob,
      tob,
      pob,
      note: 'Exact planetary chart calculations must be connected before final paid launch.'
    }
  };
}

async function getPaidBackground(responseId) {
  const response = await openAI(`/responses/${encodeURIComponent(responseId)}`, {
    method: 'GET'
  });

  return {
    id: response.id,
    status: response.status,
    model: response.model || getPaidModel(),
    error: response.error || null,
    incompleteDetails: response.incomplete_details || null,
    reportText: extractText(response)
  };
}

module.exports = {
  startPaidBackground,
  getPaidBackground
};
