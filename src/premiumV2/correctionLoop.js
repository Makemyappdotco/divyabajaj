function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data.output || []).flatMap(item => item.content || []).map(item => item.text || '').join('\n').trim();
}

function sameShape(reference, candidate) {
  if (typeof reference !== typeof candidate) return false;
  if (Array.isArray(reference)) {
    return Array.isArray(candidate) && reference.length === candidate.length && reference.every((item, index) => sameShape(item, candidate[index]));
  }
  if (reference && typeof reference === 'object') {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const a = Object.keys(reference).sort();
    const b = Object.keys(candidate).sort();
    if (a.join('|') !== b.join('|')) return false;
    return a.every(key => sameShape(reference[key], candidate[key]));
  }
  return true;
}

async function correctPageContent({ pageNumber, currentContent, issues, factLedger, masterInterpretation }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing for correction loop');
  const model = process.env.OPENAI_PAID_MODEL || 'gpt-5.5';

  const prompt = `Correct page ${pageNumber} of a fixed premium Divya Bajaj report.

You must return the exact same JSON shape as CURRENT PAGE CONTENT. Do not add or remove keys or list items.

Fix only the reported problems. Prefer shortening and rewriting text rather than changing meaning. Preserve all deterministic numbers and facts exactly. Never use an em dash. Do not use generic AI vocabulary. Do not invent exact astrology calculations.

If the problem is excessive density, shorten the most verbose fields by roughly 20 to 35 percent while preserving the useful insight. If the problem is awkward line wrapping, make headings shorter and body copy cleaner. If the problem is repetition, keep the stronger version and make this page focus on how the pattern applies specifically to this section.

ISSUES:
${JSON.stringify(issues, null, 2)}

IMMUTABLE FACT LEDGER:
${JSON.stringify(factLedger, null, 2)}

MASTER INTERPRETATION:
${JSON.stringify(masterInterpretation, null, 2)}

CURRENT PAGE CONTENT:
${JSON.stringify(currentContent, null, 2)}`;

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
        { role: 'system', content: 'You are a precise report copy editor. Return JSON only.' },
        { role: 'user', content: prompt }
      ],
      max_output_tokens: 5000,
      text: { format: { type: 'json_object' } }
    })
  });

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch (error) { throw new Error(`Correction request returned invalid response envelope: ${raw.slice(0, 300)}`); }
  if (!response.ok) throw new Error(data?.error?.message || `Correction request failed with ${response.status}`);

  const output = extractOutputText(data);
  if (!output) throw new Error('Correction request returned no output');
  const corrected = JSON.parse(output);
  if (!sameShape(currentContent, corrected)) throw new Error(`Correction for page ${pageNumber} changed the locked page-content shape`);
  return corrected;
}

module.exports = { correctPageContent, sameShape };
