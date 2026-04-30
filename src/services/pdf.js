const PDFDocument = require('pdfkit');

function safeText(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function paintBackground(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0B0B0D');
  doc.restore();
  doc.fillColor('#F5EFE4');
}

function generateReportPdf({ lead = {}, report = {}, numbers = {}, reportText = '' }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.on('pageAdded', () => paintBackground(doc));

      paintBackground(doc);
      doc.fillColor('#C9A96E').fontSize(22).text('Divya Bajaj', { align: 'center' });
      doc.moveDown(0.2);
      doc.fillColor('#F5EFE4').fontSize(13).text('Astrology + Numerology Awareness Report', { align: 'center' });
      doc.moveDown(1.5);

      doc.fillColor('#C9A96E').fontSize(14).text('Client Details');
      doc.moveDown(0.4);
      doc.fillColor('#F5EFE4').fontSize(10);
      doc.text(`Name: ${safeText(lead.name)}`);
      doc.text(`Date of Birth: ${safeText(lead.dob)}`);
      doc.text(`Time of Birth: ${safeText(lead.tob) || 'Not provided'}`);
      doc.text(`Place of Birth: ${safeText(lead.pob) || 'Not provided'}`);
      doc.text(`WhatsApp: ${safeText(lead.phone)}`);
      doc.moveDown(1);

      doc.fillColor('#C9A96E').fontSize(14).text('Core Numbers');
      doc.moveDown(0.4);
      doc.fillColor('#F5EFE4').fontSize(10);
      doc.text(`Ruling Number: ${numbers.ruling_number || '-'}`);
      doc.text(`Destiny Number: ${numbers.destiny_number || '-'}`);
      doc.text(`Name Number: ${numbers.name_number || '-'}`);
      doc.text(`Personal Year: ${numbers.personal_year || '-'}`);
      doc.moveDown(1);

      doc.fillColor('#C9A96E').fontSize(14).text('Your Awareness Report');
      doc.moveDown(0.5);
      doc.fillColor('#F5EFE4').fontSize(10).lineGap(4).text(safeText(reportText), { align: 'left' });

      doc.moveDown(1.2);
      doc.fillColor('#C9A96E').fontSize(11).text('Next Step');
      doc.fillColor('#F5EFE4').fontSize(10).text('This free report gives your first layer of clarity. For deeper astrology calculations, timing, chart-based analysis, and personalised remedies, you can request the detailed paid report or book a private consultation.');

      doc.moveDown(1.2);
      doc.fillColor('#AFA79A').fontSize(8).text('Note: This report is for guidance and self-reflection. It should not replace professional medical, legal, financial, or mental health advice.', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateReportPdf };
