const { renderAllPages } = require('../src/premiumV2/svgRenderer');
const { geometryQa, renderSvgPreview, composeVectorPdf } = require('../src/premiumV2/renderPipeline');

function buildSmokeFixture() {
  const factLedger = {
    customer: {
      name: 'Renderer Smoke Test',
      email: 'smoke@example.com',
      phone: '+910000000000',
      dob: '1994-08-23',
      tob: '07:35',
      pob: 'Delhi, India',
      concern: 'Career, money and life direction'
    },
    numerology: {
      ruling_number: 5,
      destiny_number: 9,
      name_number: 9,
      personal_year: 5,
      lo_shu_grid: {
        counts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 0, 6: 0, 7: 0, 8: 1, 9: 2 },
        missing: [5, 6, 7],
        repeated: { 9: 2 }
      },
      plane_analysis: {
        mental: { count: 4 },
        emotional: { count: 1 },
        practical: { count: 2 }
      }
    }
  };

  const pages = {
    page_1: {
      subtitle: 'A clear reading of your core patterns, current phase and the decisions that deserve your attention.',
      prepared_for_label: 'PREPARED PERSONALLY FOR'
    },
    page_2: {
      hero_statement: 'Your mind moves quickly, but your strongest results come when your systems are steady and your attention stays with one meaningful direction.',
      insights: [
        ['core nature', 'Quick, adaptable and mentally active. Freedom matters, but structure improves your output.'],
        ['biggest strength', 'You read people and changing situations quickly, then find practical ways forward.'],
        ['biggest challenge', 'Consistency after the first excitement fades is the real test.'],
        ['career direction', 'Active, strategic and client-facing work suits you better than passive routine.'],
        ['money pattern', 'Opportunity helps you earn. Written systems help you keep and grow money.'],
        ['relationship pattern', 'You show care through action, while close people may need more words.'],
        ['current life focus', 'Use movement deliberately. Build one skill, one money system and one stable routine.'],
        ['attention now', 'Routine, completion and calmer decisions deserve your attention now.']
      ].map(([key, body]) => ({ key, title: key, body }))
    },
    page_3: {
      number_cards: [
        { label: 'RULING NUMBER', value: '5', short_meaning: 'Speed + adaptability', interpretation: 'You learn quickly and dislike feeling boxed in.' },
        { label: 'DESTINY NUMBER', value: '9', short_meaning: 'Impact + completion', interpretation: 'Long-term, responsibility and meaningful results matter.' },
        { label: 'NAME NUMBER', value: '9', short_meaning: 'Presence + authority', interpretation: 'Your public identity reinforces the same 9 energy.' },
        { label: 'PERSONAL YEAR', value: '5', short_meaning: 'Movement + change', interpretation: 'This phase supports tested movement and better positioning.' }
      ],
      interplay_headline: '5 wants options. 9 wants significance.',
      interplay_body: 'Your core tension is between movement and completion. When both energies work together, you can move quickly without abandoning the direction that deserves time to compound.',
      success_formula: 'Choose one direction with growth potential, keep learning, manage money deliberately and finish what you start.',
      contradiction: 'Strong 5 energy appears in your personality while 5 is missing from the grid. Adaptability is visible outside, while inner balance needs to be built consciously.'
    },
    page_4: {
      how_people_see_you: 'Quick, capable and independent. You adjust fast and speak confidently when you know your subject.',
      what_is_happening_inside: 'Your mind stays active. Slow growth and unclear decisions can frustrate you more than people realise.',
      strengths: ['Quick learning', 'People reading', 'Communication', 'Strategy', 'Problem solving', 'Adaptability'],
      decision_steps: [
        { title: 'Observe', body: 'You catch patterns quickly.' },
        { title: 'Compare', body: 'You want logic and options.' },
        { title: 'Move', body: 'Once convinced, you act fast.' },
        { title: 'Revisit', body: 'Uncertainty can reopen decisions.' }
      ],
      blind_spots: ['Sharp tone under pressure', 'Boredom mistaken for a wrong path', 'Carrying pressure silently', 'Impatience with slower execution', 'Assuming actions say enough'],
      birth_detail_lens: 'Birth details are used only for broad context in this smoke fixture. Exact houses, dashas and planetary positions require a verified chart engine.'
    },
    page_5: {
      hero_quote: 'Your problem is not lack of ability. The bigger issue is consistency in how you use that ability.',
      work_best_when: ['Targets are clear and methods stay flexible', 'Work uses people, data or strategy', 'You can influence outcomes', 'Growth is visible and measurable'],
      what_to_avoid: ['Mechanical work with no learning', 'Micromanagement over performance', 'Staying with no growth', 'Changing direction from boredom'],
      career_directions: [
        { title: 'Revenue + growth', body: 'Sales, partnerships and high-value business development.' },
        { title: 'Marketing + digital', body: 'Brand, growth, campaigns and market positioning.' },
        { title: 'Consulting + advisory', body: 'Practical advice built on real domain expertise.' },
        { title: 'Technology-linked business', body: 'Product, SaaS, partnerships and business analysis.' },
        { title: 'Leadership + operations', body: 'Teams, targets and accountable decision-making.' }
      ],
      job_vs_business: 'Business can suit you when demand is tested, roles are clear, cash is protected and execution is supported by a real operating system.',
      money_system: ['Build a safety reserve', 'Separate spending and saving', 'Invest before lifestyle spending', 'Write rules for risk', 'Review money monthly']
    },
    page_6: {
      hero_statement: 'You need both freedom and loyalty. You often show care through solving problems, while close people may also need reassurance and undistracted time.',
      cards: [
        { title: 'WHAT YOU NEED', body: 'Mental compatibility, loyalty, space and emotional steadiness.' },
        { title: 'HOW YOU SHOW LOVE', body: 'Support, protection, practical help and responsibility.' },
        { title: 'WHAT TRIGGERS YOU', body: 'Control, disrespect, repeated advice and financial pressure.' },
        { title: 'WHERE CONFLICT STARTS', body: 'Stress can sharpen your tone or replace conversation with silence.' }
      ],
      communication_pattern: 'When calm, you can be clear and convincing. Under pressure, the same directness can become blunt. The right point can still land in the wrong tone.',
      improvements: ['Talk before resentment builds', 'Say when you need time', 'Use words of appreciation', 'Do not reply in anger', 'Discuss money openly', 'Protect phone-free time'],
      strongest_fit: 'Your strongest relationship fit combines mental compatibility, emotional steadiness and real friendship.'
    },
    page_7: {
      year_label: '2026 • PERSONAL YEAR 5',
      theme_title: 'Movement with control',
      intro: 'This phase supports learning, networking, better positioning and new options. The same 5 energy can also create too many directions, so movement needs a plan.',
      cards: [
        { title: 'CAREER', body: 'Prepare before switching. Move when the next step improves learning, money or position.' },
        { title: 'MONEY', body: 'Enjoy change within limits. Avoid quick-profit thinking and lifestyle creep.' },
        { title: 'RELATIONSHIPS', body: 'Do not let work and movement replace emotional presence.' },
        { title: 'HEALTH + ROUTINE', body: 'Sleep, movement and screen discipline directly affect decision quality.' }
      ],
      focus: ['One meaningful move', 'One income-linked skill', 'One money system', 'One stable routine'],
      avoid: ['Random resets', 'Over-promising', 'Impulsive spending', 'Untested opportunities'],
      decision_filter: 'Before a major move, ask whether it improves your long-term position, whether the numbers work and whether a written plan exists.'
    },
    page_8: {
      intro: 'Use the next year as four practical phases rather than pretending every month can be predicted exactly.',
      phases: [
        { label: 'PHASE 1', title: 'RESET THE BASE', body: 'Clarify your biggest career and money concerns. Track spending and clean up basic routines.' },
        { label: 'PHASE 2', title: 'BUILD POSITION', body: 'Choose one income-linked skill. Improve your profile, portfolio or visibility.' },
        { label: 'PHASE 3', title: 'TEST OPPORTUNITIES', body: 'Explore a better role or business idea through small tests before heavy investment.' },
        { label: 'PHASE 4', title: 'CONSOLIDATE', body: 'Review what worked and keep one career action, one money discipline and one routine.' }
      ],
      rule_72_hour: 'When you suddenly want to change everything, wait 72 hours. If the idea still makes sense after three days, move forward with a written plan.'
    },
    page_9: {
      intro: 'Your long-term direction is built around communication, leadership, strategy and reputation. The main risk is spreading yourself across too many paths before one compounds.',
      steps: [
        { number: '01', title: 'BUILD THE STACK', body: 'Strengthen communication, negotiation, financial awareness and strategic thinking.' },
        { number: '02', title: 'STEP INTO RESPONSIBILITY', body: 'Move toward roles where decisions matter and your judgement affects outcomes.' },
        { number: '03', title: 'CONVERT INCOME INTO ASSETS', body: 'Protect a reserve, invest through a system and control lifestyle growth.' },
        { number: '04', title: 'BUILD A REPUTATION', body: 'Become known for reliability, calm problem-solving and finishing what you start.' }
      ],
      long_term_filter: 'Choose work where you can communicate, influence, keep growing, make meaningful decisions and convert income into assets.',
      slow_down: ['Scattered execution', 'Impatience', 'Strong reactions', 'Too many directions', 'Changing too early'],
      simple_formula: ['One main direction', 'One income plan', 'One savings system', 'One health routine']
    },
    page_10: {
      central_contradiction: 'Your personality carries strong 5 energy, but 5 is missing from the grid. You can look adaptable outside while your inner centre still needs routine.',
      repeated_number_pattern: 'Two 9s add intensity, ambition and a strong need for meaningful results. Directed well, this supports leadership.',
      missing_guidance: [
        { number: '5', title: 'BALANCE', body: 'Build steadier decisions and grounding habits.' },
        { number: '6', title: 'RESPONSIBILITY', body: 'Create order in home, money and relationships.' },
        { number: '7', title: 'PATIENCE', body: 'Pause when logic cannot give an instant answer.' }
      ],
      planes: [
        { name: 'MENTAL', level: 'STRONG', body: 'You analyse and spot patterns quickly.' },
        { name: 'EMOTIONAL', level: 'LIGHT', body: 'Feelings are often processed internally.' },
        { name: 'PRACTICAL', level: 'MODERATE', body: 'Deadlines and measurable goals help execution.' }
      ]
    },
    page_11: {
      intro: 'The most useful remedy is a cleaner daily system. Practical changes come first, while spiritual suggestions remain optional.',
      cards: [
        { title: 'ONE HABIT TO BUILD', body: 'Use a written weekly plan and review money on one fixed date.' },
        { title: 'ONE PATTERN TO STOP', body: 'Do not make major decisions in excitement, anger or boredom.' },
        { title: 'ONE ENVIRONMENTAL CHANGE', body: 'Reduce digital clutter and keep your workspace functional.' },
        { title: 'NUMBER-RELATED GUIDANCE', body: 'Do not change names or numbers casually without a clear reason.' },
        { title: 'OPTIONAL SPIRITUAL PRACTICE', body: 'Use a short calming practice that genuinely fits your routine.' },
        { title: 'ONE PERSONAL REMINDER', body: 'When your routine is clean, your mind becomes more useful.' }
      ],
      gemstone_note: 'No fixed gemstone recommendation should be made without verified planetary placements and a properly calculated birth chart.'
    },
    page_12: {
      intro: 'Do not try to fix everything at once. Use four weeks to create evidence that clarity, money, routine and communication improve when handled deliberately.',
      weeks: [
        { week: 'WEEK 1', title: 'CLARITY + MONEY RESET', actions: ['Write top career concerns', 'Track every expense', 'Check avoidable spending', 'Create money buckets'] },
        { week: 'WEEK 2', title: 'CAREER AUDIT + SKILL', actions: ['Update your work profile', 'List income-linked skills', 'Ask for honest feedback', 'Choose one skill to improve'] },
        { week: 'WEEK 3', title: 'ROUTINE + OPPORTUNITY', actions: ['Fix sleep and wake time', 'Move your body daily', 'Protect one focus hour', 'Test opportunities before spending'] },
        { week: 'WEEK 4', title: 'COMMUNICATION + REVIEW', actions: ['Have one honest conversation', 'Listen before replying', 'Review mood and money', 'Choose three commitments'] }
      ],
      closing: 'At Day 30, keep only one career action, one financial discipline and one personal habit. That is enough to create momentum.'
    },
    page_13: {
      intro: 'A consultation adds value when you want to apply this blueprint to a real decision. These are the areas that deserve case-specific discussion.',
      areas: [
        { title: 'CAREER CHOICE + TIMING', body: 'Compare a job move, business direction or mixed path against your actual situation.' },
        { title: 'MONEY LEAKAGE + RISK', body: 'Identify the real leakage and build a specific asset and risk plan.' },
        { title: 'RELATIONSHIP COMMUNICATION', body: 'Focus on the exact conflict, expectation or family responsibility involved.' },
        { title: 'EXACT ASTROLOGY', body: 'Use a verified chart before making exact timing or gemstone claims.' }
      ],
      questions: ['What work gives you purpose?', 'Where is money leaking?', 'Do you plan before pressure builds?', 'Are you building assets?', 'Do you lose interest when growth slows?', 'Can you follow one plan for a year?'],
      closing: 'A deeper reading should answer a real question you are facing now. It should not repeat the same number meanings in more words.'
    },
    page_14: {
      hero: 'Keep this one idea with you.',
      paragraphs: [
        'The clearest pattern is not lack of ability. It is the gap between how quickly your mind moves and how consistently your systems support it.',
        'You do not need a smaller life. You need fewer scattered directions, stronger routines and cleaner decisions.',
        'Keep this report as a reference. Use it to notice patterns, make better choices and use your strengths with more control.'
      ],
      signoff_name: 'Divya Bajaj',
      signoff_role: 'ASTRO - NUMEROLOGIST'
    }
  };

  return { factLedger, pages };
}

async function runRenderSmoke() {
  const { factLedger, pages } = buildSmokeFixture();
  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  if (svgPages.length !== 14) throw new Error(`Premium v2 smoke expected 14 SVG pages, received ${svgPages.length}`);

  const geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    throw new Error(`Premium v2 geometry smoke failed: ${JSON.stringify(geometry.issues)}`);
  }

  for (const pageNumber of [1, 2, 7, 10, 14]) {
    const page = svgPages.find(item => item.page_number === pageNumber);
    const png = await renderSvgPreview(page.svg);
    if (!Buffer.isBuffer(png) || png.length < 1000) throw new Error(`Premium v2 PNG smoke failed for page ${pageNumber}`);
  }

  const pdf = await composeVectorPdf(svgPages);
  if (!Buffer.isBuffer(pdf) || pdf.length < 10000 || pdf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('Premium v2 vector PDF smoke failed');
  }

  return {
    pages: svgPages.length,
    geometry_passed: geometry.passed,
    pdf_bytes: pdf.length
  };
}

module.exports = { buildSmokeFixture, runRenderSmoke };

if (require.main === module) {
  runRenderSmoke()
    .then(result => console.log('[premium-v2-render-smoke] passed', result))
    .catch(error => {
      console.error('[premium-v2-render-smoke] failed', error);
      process.exit(1);
    });
}
