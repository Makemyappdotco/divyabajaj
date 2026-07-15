const { buildFactLedger } = require('../src/premiumV2/factLedger');
const { buildDirectPages } = require('../src/premiumV2/directPdf');
const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { geometryQa } = require('../src/premiumV2/renderPipeline');

const TITLES = ['Personal Opening From Divya','Your Full Blueprint Summary','Birth Detail Based Astrology Overview','Numerology Core Number Summary','Ruling Number Deep Reading','Destiny Number Deep Reading','Name Number and Public Energy','Lo Shu Grid Deep Reading','Missing Numbers, Repeated Numbers and Life Lessons','Mental, Emotional and Practical Planes','Personality Pattern and Inner Nature','Career Direction and Work Style','Best Suited Professions and Business Directions','Money Pattern and Growth Advice','Relationship and Marriage Pattern','Family, Communication and Emotional Triggers','Health, Energy and Routine Awareness','The Decisions That Need More Attention','Current Year Guidance','Next 12 Months Focus','Next 3 to 5 Year Direction','Name Correction and Business Number Notes','Mobile Number, House Number and Daily Environment Notes','Gemstone and Remedy Direction','Practical 30-Day Action Plan','What Divya Would Personally Ask In A Consultation','Final Guidance and Next Step'];
const BASE = 'You think quickly and usually understand the practical side of a situation before most people around you. Your strongest progress comes when freedom is supported by structure and one clear priority at a time. The bigger challenge is not ability. It is staying with one direction long enough for the result to compound. In work and money, written systems protect you from decisions made only because something feels urgent. In relationships, direct communication works better than expecting people to understand pressure you have not explained. This phase rewards consistency, calmer decision-making and finishing important commitments before creating new ones.';
const reportText = TITLES.map((title,index) => `${index + 1}. ${title}\n${BASE} ${BASE}`).join('\n\n');

function runDirectHardGeometrySmoke() {
  const lead = { name:'Dhruv Gupta', email:'test@example.com', phone:'9999999999', dob:'1994-08-23', tob:'07:35', pob:'Delhi, India', question:'Career, money and life direction' };
  const factLedger = buildFactLedger(lead);
  const pages = buildDirectPages({ lead, reportText, factLedger });
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan:{} });
  const geometry = geometryQa(svgPages);
  const blocking = geometry.issues.filter(issue => ['out_of_bounds','text_out_of_bounds','page_size','page_count','footer'].includes(issue.type));
  if (blocking.length) throw new Error(`Direct hard geometry failed: ${JSON.stringify(blocking.slice(0,12))}`);
  return { pages:svgPages.length, hard_geometry_passed:true };
}

module.exports = { runDirectHardGeometrySmoke };
