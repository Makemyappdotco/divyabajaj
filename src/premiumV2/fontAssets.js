const fs = require('fs');
const path = require('path');

function packageRoot(packageName, cssEntry) {
  return path.dirname(require.resolve(`${packageName}/${cssEntry}`));
}

function readFont(packageName, cssEntry, fileStem) {
  const root = packageRoot(packageName, cssEntry);
  const candidates = [
    { name: `${fileStem}.woff`, mime: 'font/woff', format: 'woff' },
    { name: `${fileStem}.woff2`, mime: 'font/woff2', format: 'woff2' }
  ];

  for (const candidate of candidates) {
    const filePath = path.join(root, 'files', candidate.name);
    if (fs.existsSync(filePath)) {
      return {
        base64: fs.readFileSync(filePath).toString('base64'),
        mime: candidate.mime,
        format: candidate.format
      };
    }
  }

  throw new Error(`Bundled font file not found for ${packageName}: ${fileStem}`);
}

const poppins400 = readFont('@fontsource/poppins', '400.css', 'poppins-latin-400-normal');
const poppins500 = readFont('@fontsource/poppins', '500.css', 'poppins-latin-500-normal');
const poppins600 = readFont('@fontsource/poppins', '600.css', 'poppins-latin-600-normal');
const poppins700 = readFont('@fontsource/poppins', '700.css', 'poppins-latin-700-normal');
const playfair500 = readFont('@fontsource/playfair-display', '500.css', 'playfair-display-latin-500-normal');
const playfair700 = readFont('@fontsource/playfair-display', '700.css', 'playfair-display-latin-700-normal');

function fontFace(family, weight, asset) {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:${asset.mime};base64,${asset.base64}) format('${asset.format}');}`;
}

const FONT_CSS = [
  fontFace('Poppins', 400, poppins400),
  fontFace('Poppins', 500, poppins500),
  fontFace('Poppins', 600, poppins600),
  fontFace('Poppins', 700, poppins700),
  fontFace('Playfair Display', 500, playfair500),
  fontFace('Playfair Display', 700, playfair700)
].join('');

function embedPremiumFonts(svg) {
  let output = String(svg || '');
  if (!output.includes('<svg')) return output;

  output = output
    .replace(/font-family="Georgia, Times New Roman, serif"/g, 'font-family="Playfair Display"')
    .replace(/font-family="Poppins, Arial, Helvetica, sans-serif"/g, 'font-family="Poppins"');

  if (output.includes('data-premium-fonts="embedded"')) return output;

  return output.replace(
    /<svg([^>]*)>/,
    `<svg$1><defs data-premium-fonts="embedded"><style type="text/css"><![CDATA[${FONT_CSS}]]></style></defs>`
  );
}

module.exports = { embedPremiumFonts, FONT_CSS };
