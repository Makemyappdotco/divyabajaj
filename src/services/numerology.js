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

function rulingNumber(dob) { return reduceNumber(dateParts(dob).day); }
function destinyNumber(dob) { return reduceNumber(String(dob).replace(/\D/g, '').split('').reduce((sum, digit) => sum + Number(digit), 0)); }
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
  const reportText = `Namaste ${name},\n\nQuick Summary\nYour basic numerology report shows Ruling Number ${numbers.ruling_number}, Destiny Number ${numbers.destiny_number}, Name Number ${numbers.name_number}, and Personal Year ${numbers.personal_year}.\n\nOverall Life Pattern\nYour numbers suggest that your current phase needs clarity, patience, and practical decision-making.\n\nCareer and Work\nYou may do better when your work gives you movement, responsibility, and meaning.\n\nMoney and Growth\nAvoid rushed decisions. Build consistency and track your choices carefully.\n\nRelationships and Marriage\nEmotional balance and clear communication may be important areas for you.\n\nNext Step\nFor deeper astrology, timing, remedies, and detailed guidance, you can request an advanced report or consultation.`;
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
async function generateReport(type, name, dob, question = '', astrologyData = null) {
  const numbers = calcAllNumbers(name, dob);
  const wordCount = type === 'free_awareness' ? '1400 to 1800 words' : '2500 to 3500 words';
  const astroStatus = astrologyData && astrologyData.success ? 'Astrology data is available.' : 'Astrology data is not fully available.';
  const prompt = `Write a Free Astro-Numerology Awareness Report for Divya Bajaj.\n\nUse standard astrology and numerology interpretation principles. Do not claim that the report is validated by top astrologers unless a human astrologer has reviewed it.\n\nReader: normal Indian user.\nLanguage: very simple Indian English. Make it easy to understand, relatable, and useful.\nAvoid heavy terms, fear, fixed predictions, complex astrology words, and textbook tone.\nUse soft words like may, can, suggests, shows a tendency.\nExplain every point in daily-life language.\n\nLength: ${wordCount}\n\nClient Name: ${name}\nDOB: ${dob}\nUser Focus: ${question || 'General life clarity'}\n\nNumerology Data:\n${JSON.stringify(numbers, null, 2)}\n\n${astroStatus}\nAstrology Data:\n${JSON.stringify(astrologyData, null, 2)}\n\nWrite with these exact headings:\n1. Personal Opening\n2. Quick Summary\n3. Overall Life Pattern\n4. Numerology Report\n5. Astrology Report\n6. Career and Work\n7. Money and Growth\n8. Relationships and Marriage\n9. Best Suited Professions\n10. Strengths and Challenges\n11. Current Phase Guidance\n12. Simple Remedies\n13. What This Free Report Covers\n14. Next Step\n\nRules:\n- Quick Summary must have 6 to 8 simple bullet points.\n- Overall Life Pattern should explain personality, decision-making, emotional style, and life direction.\n- Numerology Report must explain Ruling Number, Destiny Number, Name Number, Personal Year, Lo Shu Grid, missing numbers, repeated numbers, and mental, emotional, practical planes.\n- Astrology Report must use only API data if success is true. If astrology data failed, write: detailed astrology chart data could not be fetched for this free report, so this section is kept basic.\n- Career and Work should explain work style, leadership, discipline, communication, and professional direction.\n- Money and Growth should explain earning style, spending tendency, risk tendency, and growth advice without making financial guarantees.\n- Relationships and Marriage should explain emotional needs, communication style, family expectations, and relationship patterns without fixed predictions.\n- Best Suited Professions should suggest 6 to 10 broad profession categories based on the data, with simple reasons.\n- Remedies should be safe, simple, practical, and non-fear-based. Give 5 to 7 remedies.\n- Keep paragraphs short. Use bullets where helpful.\n- End with a soft upgrade CTA for advanced report or one-to-one consultation.`;
  try {
    const text = await callOpenAI(prompt);
    if (!text) return fallbackReport(type, name, dob, question);
    const concerns = [];
    if (question) concerns.push(question);
    if (numbers.lo_shu_grid.missing.length) concerns.push(`Missing numbers: ${numbers.lo_shu_grid.missing.join(', ')}`);
    if (astrologyData && astrologyData.success) concerns.push('Astrology chart data available');
    return { generated: true, numbers, report_text: text, insights: { concerns } };
  } catch (error) {
    console.error('[OpenAI report error]', error.message);
    return fallbackReport(type, name, dob, question);
  }
}
module.exports = { reduceNumber, calcAllNumbers, generateReport };
