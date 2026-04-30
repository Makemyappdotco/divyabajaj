const PDFDocument = require('pdfkit');

const COLORS = {
  bg: '#0B0B0D',
  gold: '#C9A96E',
  text: '#F5EFE4',
  muted: '#B8AFA4',
  line: '#2A2520'
};

function safeText(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function paintBackground(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.bg);
  doc.restore();
  doc.fillColor(COLORS.text);
}

function sectionTitle(doc, title) {
  doc.moveDown(0.9);
  doc.fillColor(COLORS.gold).fontSize(15).text(title.replace(/^\d+\.\s*/, ''), { continued: false });
  doc.moveDown(0.2);
  doc.strokeColor(COLORS.line).lineWidth(1).moveTo(doc.x, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
  doc.moveDown(0.45);
  doc.fillColor(COLORS.text).fontSize(10.3).lineGap(4);
}

function smallHeading(doc, title) {
  doc.moveDown(0.5);
  doc.fillColor(COLORS.gold).fontSize(11.5).text(title);
  doc.moveDown(0.2);
  doc.fillColor(COLORS.text).fontSize(10.3).lineGap(4);
}

function renderReportText(doc, text) {
  const lines = safeText(text).split('\n').map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    const cleaned = line.replace(/\*\*/g, '').trim();

    if (/^\d+\.\s+/.test(cleaned)) {
      sectionTitle(doc, cleaned);
      continue;
    }

    if (/^(Personal Opening|Quick Summary|Overall Life Pattern|Numerology Report|Astrology Report|Career and Work|Money and Growth|Relationships and Marriage|Best Suited Professions|Strengths and Challenges|Current Phase Guidance|Simple Remedies|What This Free Report Covers|Next Step)$/i.test(cleaned)) {
      sectionTitle(doc, cleaned);
      continue;
    }

    if (/^[-•]\s+/.test(cleaned)) {
      doc.fillColor(COLORS.text).fontSize(10.2).text(`• ${cleaned.replace(/^[-•]\s+/, '')}`, { indent: 10, lineGap: 4 });
      doc.moveDown(0.15);
      continue;
    }

    if (cleaned.length < 70 && cleaned.endsWith(':')) {
      smallHeading(doc, cleaned.replace(':', ''));
      continue;
    }

    doc.fillColor(COLORS.text).fontSize(10.2).lineGap(4).text(cleaned, { align: 'left' });
    doc.moveDown(0.35);
  }
}

function astrologyStatusText(astrologyData) {
  if (!astrologyData) return 'Astrology data was not available for this report.';
  if (astrologyData.success) return 'Astrology data was fetched successfully and included in this report.';
  const msg = astrologyData.error?.message || astrologyData.error || 'Could not fully fetch astrology data.';
  return `Astrology data could not be fully fetched. Reason: ${safeText(msg)}`;
}

function generateReportPdf({ lead = {}, report = {}, numbers = {}, astrologyData = null, reportText = '' }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.on('pageAdded', () => paintBackground(doc));

      paintBackground(doc);

      doc.fillColor(COLORS.gold).fontSize(24).text('Divya Bajaj', { align: 'center' });
      doc.moveDown(0.2);
      doc.fillColor(COLORS.text).fontSize(13).text('Free Astrology + Numerology Awareness Report', { align: 'center' });
      doc.moveDown(1.2);

      sectionTitle(doc, 'Client Details');
      doc.fillColor(COLORS.text).fontSize(10.2).lineGap(4);
      doc.text(`Name: ${safeText(lead.name)}`);
      doc.text(`Date of Birth: ${safeText(lead.dob)}`);
      doc.text(`Time of Birth: ${safeText(lead.tob) || 'Not provided'}`);
      doc.text(`Place of Birth: ${safeText(lead.pob) || 'Not provided'}`);
      doc.text(`WhatsApp: ${safeText(lead.phone)}`);

      sectionTitle(doc, 'Core Numbers');
      doc.text(`Ruling Number: ${numbers.ruling_number || '-'}`);
      doc.text(`Destiny Number: ${numbers.destiny_number || '-'}`);
      doc.text(`Name Number: ${numbers.name_number || '-'}`);
      doc.text(`Personal Year: ${numbers.personal_year || '-'}`);
      if (numbers.lo_shu_grid?.missing?.length) doc.text(`Missing Numbers: ${numbers.lo_shu_grid.missing.join(', ')}`);
      if (numbers.lo_shu_grid?.repeated?.length) {
        const repeated = numbers.lo_shu_grid.repeated.map(item => `${item.number} repeated ${item.count} times`).join(', ');
        doc.text(`Repeated Numbers: ${repeated}`);
      }

      sectionTitle(doc, 'Astrology Data Status');
      doc.text(astrologyStatusText(astrologyData));
      if (astrologyData?.geo) {
        doc.text(`Location Used: ${safeText(astrologyData.geo.complete_name || astrologyData.geo.location_name || lead.pob)}`);
        doc.text(`Latitude: ${astrologyData.geo.latitude || '-'} | Longitude: ${astrologyData.geo.longitude || '-'} | Timezone: ${astrologyData.geo.timezone || astrologyData.geo.timezone_offset || '-'}`);
      }

      sectionTitle(doc, 'Your Detailed Report');
      renderReportText(doc, reportText);

      sectionTitle(doc, 'Important Note');
      doc.fillColor(COLORS.muted).fontSize(8.5).lineGap(3).text('This report is for guidance and self-reflection. It should not replace professional medical, legal, financial, or mental health advice.', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateReportPdf };
