const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function toDataUri(filePath, mime) {
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function loadFontFaceCss() {
  const fonts = [
    { file: 'pt-serif-400.woff2', family: 'DB Serif', weight: 400, style: 'normal' },
    { file: 'pt-serif-700.woff2', family: 'DB Serif', weight: 700, style: 'normal' },
    { file: 'pt-serif-400italic.woff2', family: 'DB Serif', weight: 400, style: 'italic' },
    { file: 'inter-400.woff2', family: 'DB Sans', weight: 400, style: 'normal' },
    { file: 'inter-500.woff2', family: 'DB Sans', weight: 500, style: 'normal' },
    { file: 'inter-600.woff2', family: 'DB Sans', weight: 600, style: 'normal' },
    { file: 'inter-700.woff2', family: 'DB Sans', weight: 700, style: 'normal' }
  ];

  return fonts.map(f => {
    const uri = toDataUri(path.join(ROOT, 'fonts', f.file), 'font/woff2');
    return `@font-face{font-family:'${f.family}';src:url(${uri}) format('woff2');font-weight:${f.weight};font-style:${f.style};font-display:block;}`;
  }).join('\n');
}

let _imageCache = null;
function loadImages() {
  // coverBg / pageBg are pulled directly out of the approved PDF (pdfimages,
  // native resolution) - real designer artwork, not a recreation, so every
  // decorative element (zodiac wheel, border, icons, moon phases, logo,
  // portrait) is pixel-identical to the approved reference by construction.
  if (_imageCache) return _imageCache;
  _imageCache = {
    coverBg: toDataUri(path.join(ROOT, 'assets', 'cover-bg.jpg'), 'image/jpeg'),
    pageBg: toDataUri(path.join(ROOT, 'assets', 'page-bg.jpg'), 'image/jpeg')
  };
  return _imageCache;
}

module.exports = { loadFontFaceCss, loadImages };
