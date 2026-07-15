const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const sharp = require('sharp');
const APPROVED_LOGO_BASE64 = require('./brandAsset');
const { PAGE, TYPE, REFERENCE_RUBRIC } = require('./spec');

const APPROVED_LOGO_BUFFER = Buffer.from(APPROVED_LOGO_BASE64, 'base64');

function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function normalizeKnownLayoutIssues(svg) {
  let output = String(svg || '');

  // Page 6 final relationship-fit callout uses a deliberately short band.
  if (output.includes('What will improve your relationships') && output.includes('RELATIONSHIPS  06')) {
    output = output.replace(/(<text x="61" y=")787("[^>]*>)/g, '$1763$2');
  }

  // Page 10 needs readable three-plane copy. Give the final band more vertical room
  // instead of shrinking body text to fit.
  if (output.includes('YOUR THREE PLANES') && output.includes('HIDDEN PATTERNS  10')) {
    output = output
      .replace('<rect x="44" y="680" width="507" height="95"', '<rect x="44" y="665" width="507" height="115"')
      .replace(/(<text x="62" y=")702("[^>]*>YOUR THREE PLANES)/g, '$1690$2')
      .replace(/ y="726" /g, ' y="716" ')
      .replace(/ y="748" /g, ' y="738" ')
      .replace(/ y="768" /g, ' y="758" ')
      .replace(/font-size="6\.1"/g, 'font-size="6.8"');
  }

  return output;
}

function stripGeneratedBrandMark(svg) {
  return String(svg || '')
    .replace(/<g transform="translate\(297,118\) scale\(0\.7\)">[\s\S]*?<\/g>/g, '')
    .replace(/<g transform="translate\(297,112\) scale\(0\.65\)">[\s\S]*?<\/g>/g, '');
}

function applyApprovedLogoToPreviewSvg(svg) {
  const normalized = normalizeKnownLayoutIssues(svg);
  const isCover = normalized.includes('translate(297,118) scale(0.7)');
  const isClosing = normalized.includes('translate(297,112) scale(0.65)');
  if (!isCover && !isClosing) return normalized;

  const cleaned = stripGeneratedBrandMark(normalized);
  const image = isCover
    ? `<image href="data:image/png;base64,${APPROVED_LOGO_BASE64}" x="207" y="40" width="180" height="146" preserveAspectRatio="xMidYMid meet"/>`
    : `<image href="data:image/png;base64,${APPROVED_LOGO_BASE64}" x="214" y="42" width="166" height="134" preserveAspectRatio="xMidYMid meet"/>`;
  return cleaned.replace('</svg>', `${image}</svg>`);
}

async function renderSvgPreview(svg) {
  const previewSvg = applyApprovedLogoToPreviewSvg(svg);
  return sharp(Buffer.from(previewSvg))
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
    const normalized = normalizeKnownLayoutIssues(page.svg);
    const cleanSvg = stripGeneratedBrandMark(normalized);
    SVGtoPDF(doc, cleanSvg, 0, 0, {
      assumePt: true,
      preserveAspectRatio: 'xMidYMid meet'
    });

    if (page.page_number === 1) {
      doc.image(APPROVED_LOGO_BUFFER, 207, 40, { width: 180 });
    } else if (page.page_number === 14) {
      doc.image(APPROVED_LOGO_BUFFER, 214, 42, { width: 166 });
    }
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

function parseTextElements(svg) {
  const items = [];
  const regex = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = regex.exec(String(svg || ''))) !== null) {
    const attrs = match[1];
    const body = match[2];
    const attr = name => {
      const found = attrs.match(new RegExp(`${name}=\"(-?\\d+(?:\\.\\d+)?)\"`));
      return found ? Number(found[1]) : null;
    };
    const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const lineCount = Math.max(1, (body.match(/<tspan\b/g) || []).length);
    items.push({
      x: attr('x'),
      y: attr('y'),
      fontSize: attr('font-size'),
      lineCount,
      text
    });
  }
  return items;
}

function geometryQaPage(page) {
  const issues = [];
  const svg = stripGeneratedBrandMark(normalizeKnownLayoutIssues(page.svg));
  const rects = parseNumericAttributes(svg, 'rect');
  const circles = parseNumericAttributes(svg, 'circle');
  const lines = parseNumericAttributes(svg, 'line');
  const texts = parseTextElements(svg);

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

  texts.forEach((item, index) => {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.fontSize)) return;
    if (item.x < 0 || item.x > PAGE.width + 0.5 || item.y < 0 || item.y > PAGE.height + 0.5) {
      issues.push({ type: 'text_out_of_bounds', severity: 'critical', element: `text_${index}`, message: 'Text anchor exceeds A4 page bounds.' });
    }

    const isFooter = item.y >= 800 || item.text.includes('PRIVATE PERSONAL REPORT');
    const isDisclaimer = item.text.startsWith('Prepared from submitted details:');
    const isCoverMeta = item.text.startsWith('PRIVATE AND PERSONALISED');
    const isMetadata = isFooter || isDisclaimer || isCoverMeta;
    const estimatedBottom = item.y + Math.max(item.fontSize, (item.lineCount - 1) * item.fontSize * 1.35);
    if (!isMetadata && estimatedBottom > PAGE.safeBottom) {
      issues.push({ type: 'footer_collision_risk', severity: 'high', element: `text_${index}`, message: 'Content text enters the protected footer safe zone.' });
    }

    if (!isMetadata && item.text.length > 45 && item.fontSize < TYPE.minBody) {
      issues.push({ type: 'tiny_body_text', severity: 'high', element: `text_${index}`, message: `Long body copy uses ${item.fontSize}pt, below the minimum body size of ${TYPE.minBody}pt.` });
    }
  });

  if (!svg.includes(`viewBox=\"0 0 ${PAGE.width} ${PAGE.height}\"`)) {
    issues.push({ type: 'page_size', severity: 'critical', element: 'svg', message: 'SVG viewBox does not match the locked A4 page size.' });
  }

  if (!svg.includes('PRIVATE PERSONAL REPORT') && ![1].includes(page.page_number)) {
    issues.push({ type: 'footer', severity: 'high', element: 'footer', message: 'Required report footer is missing.' });
  }

  return {
    page_number: page.page_number,
    passed: !issues.some(issue => ['critical', 'high'].includes(issue.severity)),
    issues,
    scores: {
      bounds: issues.some(issue => ['out_of_bounds', 'text_out_of_bounds'].includes(issue.type)) ? 0 : 10,
      page_size: issues.some(issue => issue.type === 'page_size') ? 0 : 10,
      footer: issues.some(issue => ['footer', 'footer_collision_risk'].includes(issue.type)) ? 0 : 10,
      body_size: issues.some(issue => issue.type === 'tiny_body_text') ? 0 : 10
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
  const model = process.env.OPENAI_QA_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const imageUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  const rubric = `${REFERENCE_RUBRIC.overall.join(' ')} Page-specific benchmark: ${REFERENCE_RUBRIC[pageNumber] || ''}`;

  const requestBody = {
    model,
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
  };

  if (/^gpt-5/i.test(model)) requestBody.reasoning = { effort: 'none' };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
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
  normalizeKnownLayoutIssues,
  stripGeneratedBrandMark,
  applyApprovedLogoToPreviewSvg,
  renderSvgPreview,
  renderAllPreviews,
  composeVectorPdf,
  parseTextElements,
  geometryQaPage,
  geometryQa,
  visualQaPage,
  visualQa
};
