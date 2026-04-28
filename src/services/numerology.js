const CHALDEAN = {
  a: 1, i: 1, j: 1, q: 1, y: 1,
  b: 2, k: 2, r: 2,
  c: 3, g: 3, l: 3, s: 3,
  d: 4, m: 4, t: 4,
  e: 5, h: 5, n: 5, x: 5,
  u: 6, v: 6, w: 6,
  o: 7, z: 7,
  f: 8, p: 8
};

function reduceNumber(value) {
  let n = Math.abs(Number(value) || 0);
  while (n > 9 && ![11, 22, 33].includes(n)) {
    n = String(n).split('').reduce((sum, digit) => sum + Number(digit), 0);
  }
  return n;
}

function dateParts(dob) {
  const [year, month, day] = String(dob).split('-').map(Number);
  return { year, month, day };
}

function rulingNumber(dob) {
  return reduceNumber(dateParts(dob).day);
}

function destinyNumber(dob) {
  return reduceNumber(String(dob).replace(/\D/g, '').split('').reduce((sum, digit) => sum + Number(digit), 0));
}

function nameNumber(name) {
  const total = String(name || '').toLowerCase().replace(/[^a-z]/g, '').split('').reduce((sum, ch) => sum + (CHALDEAN[ch] || 0), 0);
  return reduceNumber(total);
}

function personalYear(dob, year = new Date().getFullYear()) {
  const p = dateParts(dob);
  return reduceNumber(p.day + p.month + String(year).split('').reduce((s, d) => s + Number(d), 0));
}

function loShuGrid(dob) {
  const digits = String(dob).replace(/\D/g, '').split('').filter(d => d !== '0');
  const counts = {};
  for (let i = 1; i <= 9; i++) counts[i] = 0;
  digits.forEach(d => counts[d]++);
  const missing = Object.keys(counts).filter(k => counts[k] === 0).map(Number);
  const repeated = Object.keys(counts).filter(k => counts[k] > 1).map(k => ({ number: Number(k), count: counts[k] }));
  return { counts, missing, repeated };
}

function planeAnalysis(grid) {
  const c = grid.counts;
  return {
    mental: (c[4] || 0) + (c[9] || 0) + (c[2] || 0),
    emotional: (c[3] || 0) + (c[5] || 0) + (c[7] || 0),
    practical: (c[8] || 0) + (c[1] || 0) + (c[6] || 0)
  };
}

function calcAllNumbers(name, dob) {
  const grid = loShuGrid(dob);
  return {
    ruling_number: rulingNumber(dob),
    destiny_number: destinyNumber(dob),
    name_number: nameNumber(name),
    personal_year: personalYear(dob),
    lo_shu_grid: grid,
    plane_analysis: planeAnalysis(grid)
  };
}

function fallbackReport(type, name, dob, question) {
  const numbers = calcAllNumbers(name, dob);
  const concernLine = question ? `Your main question is: ${question}` : 'Your report gives a first layer of personal clarity.';
  const reportText = `Namaste ${name},\n\nYour core numerology snapshot shows Ruling Number ${numbers.ruling_number}, Destiny Number ${numbers.destiny_number}, Name Number ${numbers.name_number}, and Personal Year ${numbers.personal_year}.\n\n${concernLine}\n\nThis combination suggests that your current phase needs more clarity, patience, and practical decision-making. The free report is a starting point only. For deeper timing, repeated patterns, missing number impact, and remedies, a detailed report or consultation is recommended.`;
  return { generated: false, numbers, report_text: reportText, insights: { concerns: [question || 'General life clarity'] }, message: 'OpenAI API key not configured, returned fallback report.' };
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: prompt })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (data.output_text) return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join('\n');
}

async function generateReport(type, name, dob, question = '') {
  const numbers = calcAllNumbers(name, dob);
  const wordCount = type === 'free_awareness' ? '450 to 600 words' : '1800 to 2500 words';
  const prompt = `You are writing a personalised astrology and numerology style report for Divya Bajaj, Astro-Numerologist.\n\nWrite in simple Indian English. Keep the tone calm, premium, clear, personal, and human. Do not sound like AI. Do not make scary, guaranteed, medical, legal, death-related, or absolute claims. Use may, indicates, suggests, this period asks for caution.\n\nReport type: ${type}\nLength: ${wordCount}\n\nClient details:\nName: ${name}\nDOB: ${dob}\nQuestion: ${question || 'General life clarity'}\n\nCalculated numerology data:\n${JSON.stringify(numbers, null, 2)}\n\nStructure:\n1. Personal opening\n2. Core number pattern\n3. Lo Shu grid insight\n4. Current life phase\n5. Guidance for the main concern\n6. Simple remedy\n7. Next step CTA\n\nFor free report, end by naturally inviting the user to upgrade to a deeper report. For paid report, make it more detailed and action-oriented.`;
  try {
    const text = await callOpenAI(prompt);
    if (!text) return fallbackReport(type, name, dob, question);
    const concerns = [];
    if (question) concerns.push(question);
    if (numbers.lo_shu_grid.missing.length) concerns.push(`Missing numbers: ${numbers.lo_shu_grid.missing.join(', ')}`);
    return { generated: true, numbers, report_text: text, insights: { concerns } };
  } catch (error) {
    console.error('[OpenAI report error]', error.message);
    return fallbackReport(type, name, dob, question);
  }
}

module.exports = { reduceNumber, calcAllNumbers, generateReport };
