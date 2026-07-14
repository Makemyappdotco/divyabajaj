const { PAGE_SCHEMA } = require('./contentEngine');
const { FORBIDDEN_PHRASES } = require('./spec');
const { buildFactLedger } = require('./factLedger');
const { validatePremiumContent } = require('./validator');
const { renderAllPages } = require('./svgRenderer');
const { geometryQa } = require('./renderPipeline');
const { composePremiumPdf } = require('./pdfComposer');

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data?.output || [])
    .flatMap(item => item.content || [])
    .map(item => item.text || '')
    .join('\n')
    .trim();
}

async function callPages({ factLedger, reportText, currentPages = null, issues = null }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  const model = process.env.OPENAI_PAID_MODEL || 'gpt-5.5';

  const repairMode = Boolean(currentPages && Array.isArray(issues) && issues.length);
  const system = `You are the senior report editor for Divya Bajaj. Your job is to convert an already-generated detailed paid report into the fixed 14-page premium report product.

This is NOT a new interpretation from scratch. Preserve the useful personalised meaning from the source report, remove repetition, remove generic filler, make the writing sound personally explained by Divya, and write exactly for the locked page design.

STRICT WRITING RULES:
- Natural, direct, grounded Indian English.
- No em dash character anywhere.
- No generic AI vocabulary or motivational filler.
- Avoid these phrases and close variants: ${FORBIDDEN_PHRASES.join(', ')}.
- Do not repeatedly start sentences with "You may", "This suggests", "This indicates" or "It is important to".
- Never alter deterministic numbers from the fact ledger.
- Never invent exact houses, dashas, planetary degrees, fixed event dates or fixed gemstone prescriptions.
- Do not repeat the same insight across pages.
- Keep every field concise enough for the design. Never solve overflow by assuming smaller text.
- Page 2 must deliver the strongest summary in under two minutes of reading.
- Page 3 shows the four core numbers once.
- Page 8 uses four broad phases, not fake month-by-month predictions.
- Page 10 must match the deterministic Lo Shu facts exactly.
- Page 13 should identify genuinely useful deeper-reading areas, not generic sales copy.
- Page 14 must sound personal and memorable.

Return only the required JSON schema.`;

  const user = repairMode
    ? `The first structured draft failed validation. Correct the FULL 14-page JSON while preserving the same useful meaning and all immutable facts. Fix every listed high or critical issue. Do not add extra keys.\n\nVALIDATION ISSUES:\n${JSON.stringify(issues, null, 2)}\n\nIMMUTABLE FACT LEDGER:\n${JSON.stringify(factLedger, null, 2)}\n\nSOURCE PAID REPORT:\n${reportText}\n\nCURRENT STRUCTURED DRAFT:\n${JSON.stringify(currentPages, null, 2)}`
    : `Convert this already-generated paid report into the final fixed 14-page structured report. Compress intelligently. Preserve the most personalised and useful insights. Remove repetition and generic filler.\n\nIMMUTABLE FACT LEDGER:\n${JSON.stringify(factLedger, null, 2)}\n\nSOURCE PAID REPORT:\n${reportText}`;

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
      max_output_tokens: 14500,
      text: {
        format: {
          type: 'json_schema',
          name: repairMode ? 'divya_premium_pages_direct_repair' : 'divya_premium_pages_direct',
          strict: true,
          schema: PAGE_SCHEMA
        }
      }
    })
  });

  const raw = await response.text();
  let envelope;
  try { envelope = raw ? JSON.parse(raw) : {}; }
  catch (error) { throw new Error(`Premium PDF restructuring returned an invalid response: ${raw.slice(0, 260)}`); }

  if (!response.ok) {
    throw new Error(envelope?.error?.message || `Premium PDF restructuring failed with ${response.status}`);
  }

  const output = extractOutputText(envelope);
  if (!output) throw new Error('Premium PDF restructuring returned no structured content');

  try {
    return { pages: JSON.parse(output), model };
  } catch (error) {
    throw new Error(`Premium PDF structured content could not be parsed: ${output.slice(0, 260)}`);
  }
}

async function createDirectPremiumPdf({ lead, reportText }) {
  if (!String(reportText || '').trim()) throw new Error('Generated report text is required');

  const factLedger = buildFactLedger({
    name: lead?.name,
    email: lead?.email,
    phone: lead?.phone,
    dob: lead?.dob,
    tob: lead?.tob,
    pob: lead?.pob,
    question: lead?.question
  });

  let generated = await callPages({ factLedger, reportText });
  let contentQa = validatePremiumContent({ pages: generated.pages, factLedger });

  if (!contentQa.passed) {
    const blockingIssues = contentQa.issues.filter(issue => ['critical', 'high'].includes(issue.severity));
    generated = await callPages({
      factLedger,
      reportText,
      currentPages: generated.pages,
      issues: blockingIssues
    });
    contentQa = validatePremiumContent({ pages: generated.pages, factLedger });
  }

  if (!contentQa.passed) {
    const blocking = contentQa.issues
      .filter(issue => ['critical', 'high'].includes(issue.severity))
      .slice(0, 8)
      .map(issue => `${issue.path || issue.type}: ${issue.message}`)
      .join(' | ');
    throw new Error(`Premium report content could not pass validation: ${blocking}`);
  }

  const svgPages = renderAllPages({
    pages: generated.pages,
    factLedger,
    layoutPlan: {}
  });

  const geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    const blocking = geometry.issues.slice(0, 8).map(issue => `Page ${issue.page_number || '?'}: ${issue.message}`).join(' | ');
    throw new Error(`Premium report layout failed geometry QA: ${blocking}`);
  }

  const pdfBuffer = await composePremiumPdf(svgPages);
  return {
    pdfBuffer,
    pages: generated.pages,
    factLedger,
    contentQa,
    geometry,
    model: generated.model
  };
}

module.exports = { createDirectPremiumPdf };
