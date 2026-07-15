const sharp = require('sharp');
const { embedPremiumFonts } = require('../src/premiumV2/fontAssets');

function testSvg(fontFamily) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="180" viewBox="0 0 720 180">
    <rect width="720" height="180" fill="#F7F3EC"/>
    <text x="28" y="88" font-family="${fontFamily}" font-size="42" font-weight="700" fill="#111111">Premium Blueprint 123 AaBb</text>
    <text x="28" y="136" font-family="${fontFamily}" font-size="24" font-weight="400" fill="#4B4B4B">Career, money, relationships and direction</text>
  </svg>`;
}

async function renderRaw(svg) {
  return sharp(Buffer.from(embedPremiumFonts(svg)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function countInk(buffer) {
  let count = 0;
  for (let i = 0; i < buffer.length; i += 4) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];
    if (r < 220 || g < 220 || b < 220) count += 1;
  }
  return count;
}

async function runFontRenderSmoke() {
  const poppins = await renderRaw(testSvg('Poppins'));
  const playfair = await renderRaw(testSvg('Playfair Display'));

  if (poppins.info.width !== playfair.info.width || poppins.info.height !== playfair.info.height) {
    throw new Error('Font smoke rendered inconsistent canvas dimensions.');
  }

  const poppinsInk = countInk(poppins.data);
  const playfairInk = countInk(playfair.data);

  if (poppinsInk < 2500 || playfairInk < 2500) {
    throw new Error(`Bundled fonts did not render enough visible text. Poppins ink=${poppinsInk}, Playfair ink=${playfairInk}`);
  }

  if (Buffer.compare(poppins.data, playfair.data) === 0) {
    throw new Error('Poppins and Playfair rendered identically. Bundled fonts were not applied.');
  }

  let differentPixels = 0;
  for (let i = 0; i < poppins.data.length; i += 4) {
    if (
      poppins.data[i] !== playfair.data[i] ||
      poppins.data[i + 1] !== playfair.data[i + 1] ||
      poppins.data[i + 2] !== playfair.data[i + 2]
    ) differentPixels += 1;
  }

  if (differentPixels < 1200) {
    throw new Error(`Bundled font raster outputs are suspiciously similar: ${differentPixels} differing pixels.`);
  }

  return { poppins_ink_pixels: poppinsInk, playfair_ink_pixels: playfairInk, differing_pixels: differentPixels };
}

module.exports = { runFontRenderSmoke };
