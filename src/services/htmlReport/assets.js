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
  // coverBg is the approved PDF's cover artwork (zodiac wheel, border, icons,
  // moon phases, number grid) at its native extracted resolution - real
  // designer artwork, not a recreation.
  //
  // The logo and portrait are NOT taken from that artwork. An A4 page is
  // 595.28pt wide, so the extracted page background (595px) lands at exactly
  // 72 DPI and the cover at ~128 DPI. Anything baked into those images -
  // logo, portrait, footer rules, footer text - was therefore being blown up
  // roughly 4x at print size and looked soft and blocky next to the live text,
  // which renders as vectors. So the logo and portrait now ship as their own
  // high-resolution files, placed by CSS at measured positions, and the
  // interior letterhead (flat cream, two rules, footer text) is drawn in code
  // rather than carried as a 72 DPI picture.
  if (_imageCache) return _imageCache;
  _imageCache = {
    coverBg: toDataUri(path.join(ROOT, 'assets', 'cover-bg.jpg'), 'image/jpeg'),
    logo: toDataUri(path.join(ROOT, 'assets', 'logo.webp'), 'image/webp'),
    portrait: toDataUri(path.join(ROOT, 'assets', 'portrait.webp'), 'image/webp'),
    portraitCover: toDataUri(path.join(ROOT, 'assets', 'portrait-cover.webp'), 'image/webp')
  };
  return _imageCache;
}

module.exports = { loadFontFaceCss, loadImages };
