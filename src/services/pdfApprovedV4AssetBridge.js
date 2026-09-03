const fs = require('fs');
const path = require('path');
const { generateApprovedPaidPdfV4: generateBaseApprovedPaidPdfV4 } = require('./pdfApprovedV4');

const CHUNK_DIR = path.join(process.cwd(), 'public', 'report-v4', 'chunks');
const LOGO_FILE = path.join(process.cwd(), 'public', 'report-v4', 'logo-hq.jpg');
const PORTRAIT_FILE = path.join(process.cwd(), 'public', 'divya-profile.png');

function samePath(a, b) {
  return path.resolve(String(a)) === path.resolve(String(b));
}

async function generateApprovedPaidPdfV4(input) {
  const originalReaddirSync = fs.readdirSync;
  const originalReadFileSync = fs.readFileSync;

  const syntheticLogo = path.join(CHUNK_DIR, 'logo.01.b64');
  const syntheticPortrait = path.join(CHUNK_DIR, 'portrait.01.b64');

  fs.readdirSync = function bridgedReaddirSync(target, ...args) {
    const result = originalReaddirSync.call(fs, target, ...args);
    if (!samePath(target, CHUNK_DIR) || !Array.isArray(result)) return result;

    // Never allow stale/partial branding chunks to reach PDFKit.
    // Cover/chrome remain the approved locked assets. Logo/portrait are supplied
    // from complete packaged binary files below.
    const files = result.filter(name => {
      const value = String(name);
      return !(value.startsWith('logo.') || value.startsWith('portrait.'));
    });
    files.push('logo.01.b64', 'portrait.01.b64');
    return files;
  };

  fs.readFileSync = function bridgedReadFileSync(target, encoding, ...args) {
    if (samePath(target, syntheticLogo)) {
      const encoded = originalReadFileSync.call(fs, LOGO_FILE).toString('base64');
      return encoding ? encoded : Buffer.from(encoded, 'utf8');
    }
    if (samePath(target, syntheticPortrait)) {
      const encoded = originalReadFileSync.call(fs, PORTRAIT_FILE).toString('base64');
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
