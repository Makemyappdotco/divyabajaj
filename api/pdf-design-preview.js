const { generatePremiumPaidPdf } = require('../src/services/pdfPremium');

module.exports = async function handler(req, res) {
  if (process.env.VERCEL_ENV === 'production') {
    res.statusCode = 404;
    return res.end('Not found');
  }

  const lead = {
    name: 'Dikshant Malhotra',
    dob: '1990-11-27',
    tob: '04:10',
    pob: 'Yamunanagar, Haryana, India',
    question: 'Career, finances, timing and practical direction'
  };

  const numbers = {
    ruling_number: 9,
    destiny_number: 3,
    name_number: 1,
    personal_year: 3
  };

  const reportText = `2. Your Chart And Numbers At A Glance
The astrological layer
- Ascendant: Capricorn
  Structured, patient and responsibility-led

- Ascendant lord: Saturn
  Long-term discipline matters more than speed

- Moon: Virgo
  Analytical emotional processing and practical observation

- Strongest house: 2nd house
  Income, speech, accumulated resources and values remain important

- Dominant planet: Mercury
  Communication, trade, analysis and advisory work are repeated themes

- Current period: Mercury - Rahu
  Change, networks and unconventional choices need stronger documentation

- Next major shift: 2028
  A cleaner phase of consolidation becomes available

The numerological layer
- Birth Number: 9
  Derived from: date of birth
  Courage, drive and initiative

- Destiny Number: 3
  Derived from: full date of birth
  Learning, teaching and expansion

- Name Number: 1
  Derived from: submitted name
  Identity, visibility and leadership

- Personal Year 2026: 3
  Derived from: birth date and current year
  Expression, visibility and communication

The headline finding
Your strongest pattern is disciplined leadership: communication, knowledge and public responsibility repeatedly reinforce one another.

5. Finances
Your chart does not show money as a passive luck story. It points to income growing through skill, communication, credibility and disciplined positioning.

What your birth chart shows:
A strong 2nd-house emphasis supports earning through speech, advisory work, negotiation and knowledge-led value. Mercury themes reward clarity, documentation and repeatable systems rather than impulsive financial decisions.

What your numbers show:
Birth Number 9 adds drive, Destiny 3 adds teaching and expansion, while Name Number 1 pushes independence. Money improves when leadership is paired with consistency and when expertise becomes easier for other people to recognise and buy.

Where the two systems agree:
Your strongest financial path is not speculation. It is visible expertise, communication, structured offers and patient reputation-building. The more organised your positioning becomes, the easier it is for income to become repeatable instead of random.

Where they pull against each other, or where one system is silent:
There can be tension between fast action and patient structure. The desire to move quickly can create avoidable risk if paperwork, cash-flow planning or long-term consequences are ignored.

Timing:
2026 to 2028 can open new networks and unconventional opportunities, but this phase needs stronger paperwork, risk control and patience around large commitments.

What to actually do about it:
- Make your expertise more visible.
- Track cash flow weekly instead of relying on memory.
- Put agreements and commercial expectations in writing.
- Prefer durable income systems over short-term excitement.

Confidence: High because multiple chart and number indicators point in the same practical direction.`;

  try {
    const pdf = await generatePremiumPaidPdf({ lead, numbers, reportText });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Divya-Bajaj-Premium-PDF-Preview.pdf"');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Length', String(pdf.length));
    return res.end(pdf);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ success: false, error: error.message }));
  }
};
