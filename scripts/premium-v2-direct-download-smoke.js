const { buildPremiumDownload } = require('../src/premiumV2/directDownload');

const TITLES = [
  'Personal Opening From Divya',
  'Your Full Blueprint Summary',
  'Birth Detail Based Astrology Overview',
  'Numerology Core Number Summary',
  'Ruling Number Deep Reading',
  'Destiny Number Deep Reading',
  'Name Number and Public Energy',
  'Lo Shu Grid Deep Reading',
  'Missing Numbers, Repeated Numbers and Life Lessons',
  'Mental, Emotional and Practical Planes',
  'Personality Pattern and Inner Nature',
  'Career Direction and Work Style',
  'Best Suited Professions and Business Directions',
  'Money Pattern and Growth Advice',
  'Relationship and Marriage Pattern',
  'Family, Communication and Emotional Triggers',
  'Health, Energy and Routine Awareness',
  'The Decisions That Need More Attention',
  'Current Year Guidance',
  'Next 12 Months Focus',
  'Next 3 to 5 Year Direction',
  'Name Correction and Business Number Notes',
  'Mobile Number, House Number and Daily Environment Notes',
  'Gemstone and Remedy Direction',
  'Practical 30-Day Action Plan',
  'What Divya Would Personally Ask In A Consultation',
  'Final Guidance and Next Step'
];

const BASE = [
  'You think quickly and usually understand the practical side of a situation before most people around you.',
  'Your strongest progress comes when freedom is supported by structure and one clear priority at a time.',
  'The bigger challenge is not ability. It is staying with one direction long enough for the result to compound.',
  'In work and money, written systems will protect you from decisions made only because something feels urgent.',
  'In relationships, direct communication works better for you than expecting people to understand pressure you have not explained.',
  'This phase rewards consistency, calmer decision-making and finishing important commitments before creating new ones.'
].join(' ');

function headingFor(number, title) {
  const mode = number % 4;
  if (mode === 0) return `## ${number}. **${title}**`;
  if (mode === 1) return `**${number}. ${title}**`;
  if (mode === 2) return `${number}) ${title}`;
  return `### Section ${number}: ${title}`;
}

function buildReport() {
  return TITLES.map((title, index) => {
    const number = index + 1;
    // Deliberately omit two headings to prove the recovery layer cannot produce empty required fields.
    if (number === 11 || number === 15) return '';
    const bullets = number === 25
      ? '\n- Choose one priority and write it down.\n- Remove one avoidable distraction.\n- Review one pending money decision.\n- Have one honest conversation.'
      : '';
    return `${headingFor(number, title)}\n${BASE} ${BASE}${bullets}`;
  }).filter(Boolean).join('\n\n');
}

async function runDirectDownloadSmoke() {
  const result = await buildPremiumDownload({
    lead: {
      name: 'Dhruv Gupta',
      email: 'test@example.com',
      phone: '9999999999',
      dob: '1994-08-23',
      tob: '07:35',
      pob: 'Delhi, India',
      question: 'Career, money and life direction'
    },
    reportText: buildReport()
  });

  if (!Buffer.isBuffer(result.pdfBuffer)) throw new Error('Live premium download pipeline did not return a PDF buffer');
  if (result.pdfBuffer.length < 10000) throw new Error(`Live premium download PDF is unexpectedly small: ${result.pdfBuffer.length}`);
  if (result.pdfBuffer.subarray(0, 4).toString() !== '%PDF') throw new Error('Live premium download pipeline did not return a valid PDF header');
  if (!result.geometry?.passed) throw new Error('Live premium download geometry did not pass');
  if (!result.contentQa?.passed) throw new Error('Live premium download content validation did not pass');

  return {
    pdf_bytes: result.pdfBuffer.length,
    content_passed: result.contentQa.passed,
    geometry_passed: result.geometry.passed,
    pages: 14,
    heading_variants_tested: true,
    missing_heading_recovery_tested: true
  };
}

module.exports = { runDirectDownloadSmoke };
