const legacyPdf = require('./pdfLegacy');
const { generateStructuredPaidPdf } = require('./pdfStructuredV2');

function isPaidReport(report = {}) {
  return String(report.type || '').toLowerCase().includes('paid');
}

async function generateReportPdf(args = {}) {
  if (isPaidReport(args.report)) return generateStructuredPaidPdf(args);
  return legacyPdf.generateReportPdf(args);
}

module.exports = { generateReportPdf };
