const fs = require('fs');
const path = require('path');
const { generateStructuredPaidPdfV3 } = require('../src/services/pdfStructuredV3');

function loadSampleReportText() {
  const source = fs.readFileSync(path.join(process.cwd(), 'api', 'pdf-layout-v2-preview.js'), 'utf8');
  const match = source.match(/const reportText = `([\s\S]*?)`;\n/);
  if (!match) throw new Error('Could not load preview report text');
  return match[1];
}

module.exports = async function handler(req, res) {
  try {
    const reportText = loadSampleReportText();
    const pdf = await generateStructuredPaidPdfV3({
      lead: {
        name: 'Aarav Mehta',
        dob: '14/09/1990',
        tob: '08:42 AM',
        pob: 'New Delhi, Delhi, India',
        question: 'How should I approach career, money and relationships over the next few years?'
      },
      reportText
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Integrated-Life-Report-V3-Preview.pdf"');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.status(200).send(pdf);
  } catch (error) {
    console.error('[PDF V3 preview error]', error);
    res.status(500).json({ error: error.message || 'Could not generate preview PDF' });
  }
};
