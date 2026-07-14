const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const APPROVED_LOGO_BASE64 = require('./brandAsset');
const { PAGE } = require('./spec');

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

  return output;
}

function stripGeneratedBrandMark(svg) {
  return String(svg || '')
    .replace(/<g transform="translate\(297,118\) scale\(0\.7\)">[\s\S]*?<\/g>/g, '')
    .replace(/<g transform="translate\(297,112\) scale\(0\.65\)">[\s\S]*?<\/g>/g, '');
}

function applyApprovedLogo(svg) {
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

async function renderFinalPage(svg) {
  const finalSvg = applyApprovedLogo(svg);
  return sharp(Buffer.from(finalSvg))
    .resize({ width: 1654, height: 2339, fit: 'fill' })
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toBuffer();
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

  for (const page of svgPages) {
    const png = await renderFinalPage(page.svg);
    doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
    doc.image(png, 0, 0, { width: PAGE.width, height: PAGE.height });
  }

  doc.end();
  return done;
}

module.exports = {
  composePremiumPdf,
  renderFinalPage,
  applyApprovedLogo
};
