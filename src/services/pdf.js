const legacyPdf = require('./pdfLegacy');
const { generatePremiumPaidPdf } = require('./pdfPremium');

function isPaidReport(report = {}) {
  return String(report.type || '').toLowerCase().includes('paid');
}

function generateReportPdf(args = {}) {
  if (isPaidReport(args.report)) {
    return generatePremiumPaidPdf(args);
  }
  return legacyPdf.generateReportPdf(args);
}

module.exports = { generateReportPdf };
