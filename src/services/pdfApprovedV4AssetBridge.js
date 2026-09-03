const fs = require('fs');
const path = require('path');
const { generateApprovedPaidPdfV4: generateBaseApprovedPaidPdfV4 } = require('./pdfApprovedV4');

const CHUNK_DIR = path.join(process.cwd(), 'public', 'report-v4', 'chunks');
const LOGO_FILE = path.join(process.cwd(), 'public', 'report-v4', 'logo-hq.jpg');
const PORTRAIT_FILE = path.join(process.cwd(), 'public', 'report-v4', 'portrait-hq.jpg');

function samePath(a, b) {
  return path.resolve(String(a)) === path.resolve(String(b));
}

async function generateApprovedPaidPdfV4(input) {
  const originalReaddirSync = fs.readdirSync;
  const originalReadFileSync = fs.readFileSync;

  const synthetic = new Map([
    [path.join(CHUNK_DIR, 'logo.01.b64'), LOGO_FILE],
    [path.join(CHUNK_DIR, 'portrait.01.b64'), PORTRAIT_FILE]
  ]);

  fs.readdirSync = function bridgedReaddirSync(target, ...args) {
    const result = originalReaddirSync.call(fs, target, ...args);
    if (!samePath(target, CHUNK_DIR) || !Array.isArray(result)) return result;

    const files = result.slice();
    if (!files.some(name => String(name).startsWith('logo.') && String(name).endsWith('.b64'))) {
      files.push('logo.01.b64');
    }
    if (!files.some(name => String(name).startsWith('portrait.') && String(name).endsWith('.b64'))) {
      files.push('portrait.01.b64');
    }
    return files;
  };

  fs.readFileSync = function bridgedReadFileSync(target, encoding, ...args) {
    for (const [syntheticPath, binaryPath] of synthetic.entries()) {
      if (!samePath(target, syntheticPath)) continue;
      const buffer = originalReadFileSync.call(fs, binaryPath);
      const encoded = buffer.toString('base64');
      return encoding ? encoded : Buffer.from(encoded, 'utf8');
    }
    return originalReadFileSync.call(fs, target, encoding, ...args);
  };

  try {
    return await generateBaseApprovedPaidPdfV4(input);
  } finally {
    fs.readdirSync = originalReaddirSync;
    fs.readFileSync = originalReadFileSync;
  }
}

module.exports = { generateApprovedPaidPdfV4 };
