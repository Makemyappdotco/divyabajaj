const legacyPdf = require('./pdfLegacy');
const { generateStructuredPaidPdfV3 } = require('./pdfStructuredV3');

function isPaidReport(report = {}) {
  return String(report.type || '').toLowerCase().includes('paid');
}

async function generateReportPdf(args = {}) {
  if (isPaidReport(args.report)) return generateStructuredPaidPdfV3(args);
  return legacyPdf.generateReportPdf(args);
}

module.exports = { generateReportPdf };
