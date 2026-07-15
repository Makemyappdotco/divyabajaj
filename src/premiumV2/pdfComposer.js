const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const APPROVED_LOGO_BASE64 = require('./brandAsset');
const { PAGE } = require('./spec');

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

  if (output.includes('What will improve your relationships') && output.includes('RELATIONSHIPS  06')) {
    output = output.replace(/(<text x="61" y=")787("[^>]*>)/g, '$1763$2');
  }

  if (output.includes('YOUR THREE PLANES') && output.includes('HIDDEN PATTERNS  10')) {
    output = output
      .replace('<rect x="44" y="680" width="507" height="95"', '<rect x="44" y="665" width="507" height="115"')
      .replace(/(<text x="62" y=")702("[^>]*>YOUR THREE PLANES)/g, '$1690$2')
      .replace(/ y="726" /g, ' y="716" ')
      .replace(/ y="748" /g, ' y="738" ')
      .replace(/ y="768" /g, ' y="758" ')
      .replace(/font-size="6\.1"/g, 'font-size="6.8"');
  }

  if (output.includes('Your 30-Day Action Plan') && output.includes('ACTION PLAN  12')) {
    output = output
      .replace('<rect x="44" y="730" width="507" height="50"', '<rect x="44" y="690" width="507" height="90"')
      .replace(/(<text x="62" y=")755("[^>]*><\/text>)/g, '$1715$2')
      .replace(/(<text x="62" y=")779("[^>]*>)/g, '$1738$2');
  }

  return output;
}

function stripGeneratedBrandMark(svg) {
  return String(svg || '')
    .replace(/<g transform="translate\(297,118\) scale\(0\.7\)">[\s\S]*?<\/g>/g, '')
    .replace(/<g transform="translate\(297,112\) scale\(0\.65\)">[\s\S]*?<\/g>/g, '');
}

function mapSvgFont(family, bold, italic) {
  const requested = String(family || '').toLowerCase();
  const isDisplay = requested.includes('georgia') || requested.includes('times') || requested.includes('playfair');

  if (isDisplay) {
    if (bold && italic) return 'Times-BoldItalic';
    if (bold) return 'Times-Bold';
    if (italic) return 'Times-Italic';
    return 'Times-Roman';
  }

  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

async function composePremiumPdf(svgPages) {
  if (!Array.isArray(svgPages) || svgPages.length !== 14) {
    throw new Error(`Premium PDF requires exactly 14 pages. Received ${Array.isArray(svgPages) ? svgPages.length : 0}.`);
  }

  const doc = new PDFDocument({
    autoFirstPage: false,
    compress: true,
    info: {
      Title: 'Divya Bajaj - The Full Blueprint',
      Author: 'Divya Bajaj',
      Subject: 'Private Personal Astrology and Numerology Report'
    }
  });
  const done = collectPdf(doc);
  const warnings = [];

  for (const page of svgPages) {
    doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });

    const normalized = normalizeKnownLayoutIssues(page.svg);
    const cleanSvg = stripGeneratedBrandMark(normalized);

    SVGtoPDF(doc, cleanSvg, 0, 0, {
      width: PAGE.width,
      height: PAGE.height,
      assumePt: true,
      preserveAspectRatio: 'xMidYMid meet',
      precision: 4,
      fontCallback: mapSvgFont,
      warningCallback: warning => warnings.push(String(warning || ''))
    });

    if (page.page_number === 1) {
      doc.image(APPROVED_LOGO_BUFFER, 207, 40, { width: 180 });
    } else if (page.page_number === 14) {
      doc.image(APPROVED_LOGO_BUFFER, 214, 42, { width: 166 });
    }
  }

  const seriousWarnings = warnings.filter(warning => /font|glyph|text|parse|error/i.test(warning));
  if (seriousWarnings.length) {
    throw new Error(`Premium vector PDF renderer warning: ${seriousWarnings.slice(0, 5).join(' | ')}`);
  }

  doc.end();
  return done;
}

module.exports = {
  composePremiumPdf,
  normalizeKnownLayoutIssues,
  stripGeneratedBrandMark,
  mapSvgFont
};
