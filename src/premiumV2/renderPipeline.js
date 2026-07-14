const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const sharp = require('sharp');
const { PAGE, REFERENCE_RUBRIC } = require('./spec');

function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

async function renderSvgPreview(svg) {
  return sharp(Buffer.from(svg))
    .resize({ width: 1190, height: 1684, fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function renderAllPreviews(svgPages) {
  const previews = [];
  for (const page of svgPages) {
    previews.push({
      page_number: page.page_number,
      png: await renderSvgPreview(page.svg)
    });
  }
  return previews;
}

async function composeVectorPdf(svgPages) {
  const doc = new PDFDocument({ autoFirstPage: false, compress: true, info: { Title: 'Divya Bajaj - The Full Blueprint', Author: 'Divya Bajaj' } });
  const done = collectPdf(doc);

  svgPages.forEach(page => {
    doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
    SVGtoPDF(doc, page.svg, 0, 0, {
      assumePt: true,
      preserveAspectRatio: 'xMidYMid meet'
    });
  });

  doc.end();
  return done;
}

function parseNumericAttributes(svg, tagName) {
  const tags = svg.match(new RegExp(`<${tagName}\\b[^>]*>`, 'g')) || svg.match(new RegExp(`<${tagName}\\b[^>]*/>`, 'g')) || [];
  return tags.map(tag => {
    const result = {};
    ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2'].forEach(name => {
      const match = tag.match(new RegExp(`${name}=\"(-?\\d+(?:\\.\\d+)?)\"`));
      if (match) result[name] = Number(match[1]);
    });
    return result;
  });
}

function geometryQaPage(page) {
  const issues = [];
  const rects = parseNumericAttributes(page.svg, 'rect');
  const circles = parseNumericAttributes(page.svg, 'circle');
  const lines = parseNumericAttributes(page.svg, 'line');

  rects.forEach((item, index) => {
    if ([item.x, item.y, item.width, item.height].some(value => !Number.isFinite(value))) return;
    if (item.x < 0 || item.y < 0 || item.x + item.width > PAGE.width + 0.5 || item.y + item.height > PAGE.height + 0.5) {
      issues.push({ type: 'out_of_bounds', severity: 'critical', element: `rect_${index}`, message: 'Rectangle exceeds A4 page bounds.' });
    }
  });

  circles.forEach((item, index) => {
    if (![item.cx, item.cy, item.r].every(Number.isFinite)) return;
    if (item.cx - item.r < 0 || item.cy - item.r < 0 || item.cx + item.r > PAGE.width + 0.5 || item.cy + item.r > PAGE.height + 0.5) {
      issues.push({ type: 'out_of_bounds', severity: 'critical', element: `circle_${index}`, message: 'Circle exceeds A4 page bounds.' });
    }
  });

  lines.forEach((item, index) => {
    const values = [item.x1, item.x2, item.y1, item.y2];
    if (!values.every(Number.isFinite)) return;
    if (Math.min(item.x1, item.x2) < 0 || Math.max(item.x1, item.x2) > PAGE.width + 0.5 || Math.min(item.y1, item.y2) < 0 || Math.max(item.y1, item.y2) > PAGE.height + 0.5) {
      issues.push({ type: 'out_of_bounds', severity: 'critical', element: `line_${index}`, message: 'Line exceeds A4 page bounds.' });
    }
  });

  if (!page.svg.includes(`viewBox=\"0 0 ${PAGE.width} ${PAGE.height}\"`)) {
    issues.push({ type: 'page_size', severity: 'critical', element: 'svg', message: 'SVG viewBox does not match the locked A4 page size.' });
  }

  if (!page.svg.includes('PRIVATE PERSONAL REPORT') && ![1].includes(page.page_number)) {
    issues.push({ type: 'footer', severity: 'high', element: 'footer', message: 'Required report footer is missing.' });
  }

  return {
    page_number: page.page_number,
    passed: !issues.some(issue => ['critical', 'high'].includes(issue.severity)),
    issues,
    scores: {
      bounds: issues.some(issue => issue.type === 'out_of_bounds') ? 0 : 10,
      page_size: issues.some(issue => issue.type === 'page_size') ? 0 : 10,
      footer: issues.some(issue => issue.type === 'footer') ? 0 : 10
    }
  };
}

function geometryQa(svgPages) {
  const pages = svgPages.map(geometryQaPage);
  return {
    passed: svgPages.length === 14 && pages.every(page => page.passed),
    page_count: svgPages.length,
    pages,
    issues: [
      ...(svgPages.length === 14 ? [] : [{ type: 'page_count', severity: 'critical', message: `Expected 14 pages, received ${svgPages.length}.` }]),
      ...pages.flatMap(page => page.issues.map(issue => ({ page_number: page.page_number, ...issue })))
    ]
  };
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data.output || []).flatMap(item => item.content || []).map(item => item.text || '').join('\n').trim();
}

const VISUAL_QA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['pass', 'fail'] },
    layout_score: { type: 'number' },
    readability_score: { type: 'number' },
    alignment_score: { type: 'number' },
    style_score: { type: 'number' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          element: { type: 'string' },
          message: { type: 'string' },
          recommended_action: { type: 'string', enum: ['none', 'shorten_text', 'switch_variant', 'adjust_spacing', 'review_template'] }
        },
        required: ['type', 'severity', 'element', 'message', 'recommended_action']
      }
    }
  },
  required: ['status', 'layout_score', 'readability_score', 'alignment_score', 'style_score', 'issues']
};

async function visualQaPage({ pageNumber, pngBuffer }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing for visual QA');
  const model = process.env.OPENAI_QA_MODEL || process.env.OPENAI_PAID_MODEL || 'gpt-5.5';
  const imageUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  const rubric = `${REFERENCE_RUBRIC.overall.join(' ')} Page-specific benchmark: ${REFERENCE_RUBRIC[pageNumber] || ''}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'none' },
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `You are the visual QA gate for page ${pageNumber} of a premium Divya Bajaj personal report. Evaluate the actual rendered page. Be strict about overlap, clipping, awkward wrapping, tiny text, footer collision, random spacing, cramped composition, excessive empty space, weak hierarchy and generic dashboard-like design. Do not fail merely because the page is not pixel-identical. Judge whether it belongs to the approved premium editorial system. ${rubric}`
          },
          { type: 'input_image', image_url: imageUrl }
        ]
      }],
      max_output_tokens: 1600,
      text: {
        format: {
          type: 'json_schema',
          name: 'divya_visual_qa_v2',
          strict: true,
          schema: VISUAL_QA_SCHEMA
        }
      }
    })
  });

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch (error) { throw new Error(`Visual QA returned an invalid response envelope: ${raw.slice(0, 300)}`); }
  if (!response.ok) throw new Error(data?.error?.message || `Visual QA request failed with ${response.status}`);

  const output = extractOutputText(data);
  if (!output) throw new Error('Visual QA returned no structured output');
  return JSON.parse(output);
}

async function visualQa(previews, options = {}) {
  const enabled = options.enabled !== false;
  if (!enabled) {
    return {
      enabled: false,
      passed: true,
      pages: previews.map(item => ({ page_number: item.page_number, status: 'skipped', issues: [] }))
    };
  }

  const pages = [];
  for (const preview of previews) {
    const result = await visualQaPage({ pageNumber: preview.page_number, pngBuffer: preview.png });
    pages.push({ page_number: preview.page_number, ...result });
  }

  return {
    enabled: true,
    passed: pages.every(page => page.status === 'pass' && page.layout_score >= 8.5 && page.readability_score >= 8.5 && page.alignment_score >= 8.5 && page.style_score >= 8.2),
    pages
  };
}

module.exports = {
  renderSvgPreview,
  renderAllPreviews,
  composeVectorPdf,
  geometryQaPage,
  geometryQa,
  visualQaPage,
  visualQa
};
