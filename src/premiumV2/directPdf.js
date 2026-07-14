const { buildFactLedger } = require('./factLedger');
const { validatePremiumContent } = require('./validator');
const { renderAllPages } = require('./svgRenderer');
const { geometryQa } = require('./renderPipeline');
const { composePremiumPdf } = require('./pdfComposer');

const NUMBER_MEANINGS = {
  1: 'Independent drive', 2: 'Sensitive diplomacy', 3: 'Creative expression',
  4: 'Structure and discipline', 5: 'Movement and adaptability', 6: 'Care and responsibility',
  7: 'Reflection and depth', 8: 'Power and execution', 9: 'Purpose and intensity'
};

const MISSING_GUIDANCE = {
  1: ['Build self-trust', 'Practice making smaller decisions without waiting for outside approval.'],
  2: ['Build emotional patience', 'Slow down reactions, listen fully and make room for softer communication.'],
  3: ['Use your voice', 'Express ideas more directly instead of assuming people already understand what you mean.'],
  4: ['Create structure', 'Use routines, written plans and repeatable systems instead of depending only on motivation.'],
  5: ['Create balance', 'Pause before major decisions and give your mind time to separate impulse from real direction.'],
  6: ['Strengthen responsibility', 'Finish what you commit to and build consistency around home, work and relationships.'],
  7: ['Make space for reflection', 'Spend regular quiet time reviewing patterns instead of moving immediately to the next task.'],
  8: ['Build financial discipline', 'Track money, boundaries and long-term commitments with more consistency.'],
  9: ['Practice closure', 'Finish emotional and practical cycles instead of carrying old situations into new decisions.']
};

function cleanText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/—/g, ',')
    .replace(/[•●▪◦]/g, '-')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseSections(reportText) {
  const text = cleanText(reportText);
  const matches = [...text.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+([^\n]+)/g)];
  const sections = {};

  if (!matches.length) {
    sections[1] = text;
    return sections;
  }

  matches.forEach((match, index) => {
    const number = Number(match[1]);
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    sections[number] = cleanText(text.slice(start, end));
  });

  return sections;
}

function words(value) {
  return cleanText(value).split(/\s+/).filter(Boolean);
}

function clip(value, maxWords, fallback = '') {
  const source = cleanText(value) || cleanText(fallback);
  const list = words(source);
  if (list.length <= maxWords) return source;
  return `${list.slice(0, maxWords).join(' ').replace(/[,:;]$/, '')}.`;
}

function sentences(value) {
  const source = cleanText(value)
    .replace(/^[-]\s*/gm, '')
    .replace(/\n+/g, ' ');
  const found = source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return found.map(item => cleanText(item)).filter(item => words(item).length >= 3);
}

function splitInto(value, count, maxWords) {
  const all = sentences(value);
  if (!all.length) return Array.from({ length: count }, () => 'This area deserves calm observation and practical follow-through.');
  const groups = Array.from({ length: count }, () => []);
  all.forEach((sentence, index) => groups[index % count].push(sentence));
  return groups.map((group, index) => clip(group.join(' '), maxWords, all[index % all.length]));
}

function listFrom(value, count, maxWords, fallbacks = []) {
  const source = cleanText(value);
  let items = source.split('\n')
    .map(line => cleanText(line.replace(/^[-]\s*/, '')))
    .filter(line => words(line).length >= 2);

  if (items.length < count) items = items.concat(sentences(source));
  items = [...new Set(items.map(item => clip(item, maxWords)))].filter(Boolean);

  for (const fallback of fallbacks) {
    if (items.length >= count) break;
    items.push(clip(fallback, maxWords));
  }

  while (items.length < count) {
    items.push(`Keep one practical priority clear and follow it consistently.`);
  }

  return items.slice(0, count);
}

function questionList(value, count) {
  const source = sentences(value);
  const questions = source.map(item => {
    const plain = item.replace(/[.!]+$/, '').trim();
    return plain.endsWith('?') ? plain : `What would change if you looked more closely at ${clip(plain.toLowerCase(), 16)}?`;
  });
  while (questions.length < count) {
    const defaults = [
      'Which decision is taking more mental space than it deserves?',
      'Where are you choosing speed over clarity?',
      'What pattern keeps repeating in work or money?',
      'Which relationship conversation are you postponing?',
      'What would become easier with more structure?',
      'What do you need to understand before making your next major move?'
    ];
    questions.push(defaults[questions.length % defaults.length]);
  }
  return questions.slice(0, count).map(item => clip(item, 24));
}

function buildDirectPages({ lead, reportText, factLedger }) {
  const s = parseSections(reportText);
  const n = factLedger.immutable_facts;
  const planeEntries = Object.entries(n.plane_analysis || {});
  const planeBodies = splitInto(s[10], 3, 28);
  const missing = (n.missing_numbers || []).slice(0, 3);

  const numberCards = [
    ['RULING NUMBER', n.ruling_number, s[5]],
    ['DESTINY NUMBER', n.destiny_number, s[6]],
    ['NAME NUMBER', n.name_number, s[7]],
    ['PERSONAL YEAR', n.personal_year, s[19]]
  ].map(([label, value, source]) => ({
    label,
    value: String(value),
    short_meaning: NUMBER_MEANINGS[value] || 'Personal pattern',
    interpretation: clip(source, 28, `This number shapes an important part of how ${lead.name} approaches decisions and growth.`)
  }));

  const summarySources = [s[2], s[11], s[12], s[14], s[15], s[19], s[18], s[27]];
  const summaryTitles = ['YOUR CORE NATURE', 'YOUR STRONGEST ASSET', 'YOUR BIGGEST CHALLENGE', 'CAREER DIRECTION', 'MONEY PATTERN', 'RELATIONSHIP PATTERN', 'CURRENT LIFE FOCUS', 'WHAT NEEDS ATTENTION NOW'];
  const summaryKeys = ['core_nature', 'strongest_asset', 'biggest_challenge', 'career_direction', 'money_pattern', 'relationship_pattern', 'current_life_focus', 'attention_now'];

  const page8Bodies = splitInto(s[20], 4, 48);
  const page9Bodies = splitInto(s[21], 4, 50);
  const actionSource = listFrom(s[25], 16, 18, [
    'Choose one important priority for the week and write it down clearly.',
    'Remove one avoidable distraction from your daily routine.',
    'Review one pending money or work decision calmly.',
    'Have one honest conversation you have been postponing.',
    'Track where your time goes for seven days.',
    'Finish one incomplete commitment before starting another.',
    'Create one repeatable system for a recurring task.',
    'Pause for 24 hours before one non-urgent major decision.',
    'Review your spending without judgement and identify one pattern.',
    'Protect one block of time for focused work.',
    'Write down the decision you keep overthinking and define the next step.',
    'Ask for clarity instead of making assumptions.',
    'Review what improved over the month.',
    'Keep the two habits that created the most stability.',
    'Drop one pattern that repeatedly creates unnecessary pressure.',
    'Choose the next 30-day focus before the month ends.'
  ]);

  const page11Cards = [
    ['ONE HABIT TO BUILD', s[17]],
    ['ONE PATTERN TO STOP', s[18]],
    ['YOUR ENVIRONMENT', s[23]],
    ['NUMBER GUIDANCE', s[22]],
    ['OPTIONAL SPIRITUAL PRACTICE', s[24]],
    ['PERSONAL REMINDER', s[27]]
  ].map(([title, body]) => ({ title, body: clip(body, 48, 'Keep the guidance practical, simple and consistent enough to use in daily life.') }));

  return {
    page_1: {
      subtitle: 'Personal Astrology + Numerology Blueprint',
      prepared_for_label: 'PREPARED EXCLUSIVELY FOR'
    },
    page_2: {
      hero_statement: clip(s[2], 55, `${lead.name}, your blueprint shows a mix of strong personal drive, fast thinking and a need for better consistency around the decisions that matter most.`),
      insights: summarySources.map((source, index) => ({
        key: summaryKeys[index],
        title: summaryTitles[index],
        body: clip(source, 42, `This area carries an important pattern that deserves practical attention rather than overthinking.`)
      }))
    },
    page_3: {
      number_cards: numberCards,
      interplay_headline: clip(s[4], 10, 'How your core numbers work together'),
      interplay_body: clip(`${s[4]} ${s[5]} ${s[6]} ${s[7]}`, 85, 'Your numbers work together as one pattern, not as separate labels. The real value comes from understanding where they support each other and where they create internal tension.'),
      success_formula: clip(s[2], 45, 'Use your natural strengths with more consistency, clearer priorities and less impulsive switching between directions.'),
      contradiction: clip(`${s[8]} ${s[9]}`, 75, 'Your strongest qualities can become pressure points when they are overused. The goal is not to change your nature, but to use it with more awareness and structure.')
    },
    page_4: {
      how_people_see_you: clip(s[11], 70),
      what_is_happening_inside: clip(`${s[3]} ${s[11]}`, 70),
      strengths: listFrom(`${s[11]}\n${s[2]}`, 6, 4, ['Fast learner', 'Persuasive communicator', 'Independent thinker', 'Strong under pressure', 'Adaptable approach', 'Natural initiative']),
      decision_steps: ['Notice the impulse', 'Check the facts', 'Create a pause', 'Commit clearly'].map((title, index) => ({
        title,
        body: clip(splitInto(s[18], 4, 16)[index], 16, 'Pause long enough to separate urgency from a genuinely good decision.')
      })),
      blind_spots: listFrom(s[18], 5, 18, ['Moving too quickly when clarity is still incomplete.', 'Taking on too much at the same time.', 'Losing interest when results take longer than expected.', 'Keeping pressure inside instead of explaining it.', 'Changing direction before a plan has enough time to work.']),
      birth_detail_lens: clip(s[3], 70)
    },
    page_5: {
      hero_quote: clip(s[12], 30, 'Your career grows fastest when freedom is supported by structure, not when you keep changing direction.'),
      work_best_when: listFrom(s[12], 4, 18, ['The goal is clear and measurable.', 'You have room to solve problems independently.', 'Your work includes movement, communication or decision-making.', 'There is enough variety to keep you engaged.']),
      what_to_avoid: listFrom(`${s[12]}\n${s[14]}`, 4, 18, ['Scattered priorities and too many simultaneous projects.', 'Impulsive financial decisions.', 'Work that gives responsibility without autonomy.', 'Leaving systems unfinished once the excitement reduces.']),
      career_directions: listFrom(s[13], 5, 24, ['Business development and sales leadership.', 'Entrepreneurship with strong systems.', 'Communication, consulting or advisory work.', 'Brand, growth or strategy roles.', 'Work that combines people, pressure and decision-making.']).map((body, index) => ({
        title: ['BUSINESS + GROWTH', 'COMMUNICATION', 'STRATEGY', 'LEADERSHIP', 'INDEPENDENT WORK'][index],
        body
      })),
      job_vs_business: clip(`${s[12]} ${s[13]}`, 85),
      money_system: listFrom(s[14], 5, 12, ['Track cash flow weekly.', 'Separate impulse from investment.', 'Use written financial targets.', 'Review recurring expenses.', 'Build consistency before scaling.'])
    },
    page_6: {
      hero_statement: clip(s[15], 55),
      cards: [
        ['WHAT YOU NEED EMOTIONALLY', s[15]],
        ['HOW YOU SHOW CARE', s[15]],
        ['WHAT CREATES CONFLICT', s[16]],
        ['WHAT PEOPLE MAY MISREAD', s[16]]
      ].map(([title, body]) => ({ title, body: clip(body, 42) })),
      communication_pattern: clip(s[16], 80),
      improvements: listFrom(`${s[15]}\n${s[16]}`, 6, 18, ['Say what you need before frustration builds.', 'Ask instead of assuming.', 'Slow down difficult conversations.', 'Do not use silence as a test.', 'Separate the issue from the person.', 'Give people time to respond differently.']),
      strongest_fit: clip(`${s[15]} ${s[16]}`, 45)
    },
    page_7: {
      year_label: `PERSONAL YEAR ${n.personal_year}`,
      theme_title: clip(s[19], 6, 'Movement With Better Direction'),
      intro: clip(s[19], 75),
      cards: [
        ['CAREER', `${s[19]} ${s[12]}`],
        ['MONEY', `${s[19]} ${s[14]}`],
        ['RELATIONSHIPS', `${s[19]} ${s[15]}`],
        ['HEALTH + ROUTINE', `${s[19]} ${s[17]}`]
      ].map(([title, body]) => ({ title, body: clip(body, 42) })),
      focus: listFrom(s[19], 4, 10, ['Clear priorities', 'Consistent action', 'Better routines', 'Measured decisions']),
      avoid: listFrom(s[18], 4, 10, ['Impulsive changes', 'Scattered focus', 'Unnecessary pressure', 'Avoiding difficult conversations']),
      decision_filter: clip(`${s[19]} ${s[18]}`, 60)
    },
    page_8: {
      intro: clip(s[20], 60),
      phases: ['SET DIRECTION', 'BUILD MOMENTUM', 'REVIEW PATTERNS', 'CLOSE STRONG'].map((title, index) => ({
        label: `PHASE ${index + 1}`,
        title,
        body: page8Bodies[index]
      })),
      rule_72_hour: clip(`${s[20]} ${s[18]}`, 65, 'For major non-urgent decisions, give yourself a short pause before committing. The purpose is not delay. It is to make sure the decision still feels right after the first emotional or impulsive reaction settles.')
    },
    page_9: {
      intro: clip(s[21], 80),
      steps: ['BUILD', 'EXPAND', 'REFINE', 'CONSOLIDATE'].map((title, index) => ({
        number: String(index + 1).padStart(2, '0'),
        title,
        body: page9Bodies[index]
      })),
      long_term_filter: clip(s[21], 80),
      slow_down: listFrom(`${s[21]}\n${s[18]}`, 5, 8, ['Too many simultaneous priorities', 'Impulsive commitments', 'Weak follow-through', 'Avoiding financial structure', 'Changing direction too early']),
      simple_formula: listFrom(s[21], 4, 8, ['Choose clearly', 'Build consistently', 'Review honestly', 'Scale deliberately'])
    },
    page_10: {
      central_contradiction: clip(`${s[8]} ${s[9]}`, 75),
      repeated_number_pattern: clip(s[9], 75),
      missing_guidance: missing.map(number => {
        const guide = MISSING_GUIDANCE[number] || ['Build this quality', 'Develop this area through practical awareness and consistent action.'];
        return { number: String(number), title: guide[0], body: clip(guide[1], 38) };
      }),
      planes: [0, 1, 2].map(index => {
        const entry = planeEntries[index] || [`Plane ${index + 1}`, { level: 'Developing' }];
        const value = entry[1] || {};
        return {
          name: String(entry[0]).replace(/_/g, ' '),
          level: String(value.level || value.status || 'Developing'),
          body: planeBodies[index]
        };
      })
    },
    page_11: {
      intro: clip(`${s[22]} ${s[23]} ${s[24]}`, 60),
      cards: page11Cards,
      gemstone_note: clip(s[24], 80, 'Any gemstone recommendation should be treated carefully and ideally confirmed only after verified chart-level astrology calculations. Practical habits and behavioural corrections remain the safest first step.')
    },
    page_12: {
      intro: clip(s[25], 60),
      weeks: [0, 1, 2, 3].map(index => ({
        week: `WEEK ${index + 1}`,
        title: ['CLARITY', 'STRUCTURE', 'DECISIONS', 'CONSOLIDATION'][index],
        actions: actionSource.slice(index * 4, index * 4 + 4)
      })),
      closing: clip(`${s[25]} ${s[27]}`, 60)
    },
    page_13: {
      intro: clip(s[26], 60),
      areas: [
        ['CAREER DIRECTION', `${s[12]} ${s[18]}`],
        ['MONEY + TIMING', `${s[14]} ${s[19]}`],
        ['RELATIONSHIP PATTERNS', `${s[15]} ${s[16]}`],
        ['EXACT CHART QUESTIONS', `${s[3]} ${s[26]}`]
      ].map(([title, body]) => ({ title, body: clip(body, 60) })),
      questions: questionList(s[26], 6),
      closing: clip(`${s[26]} ${s[27]}`, 55)
    },
    page_14: {
      hero: clip(s[27], 22, 'Your blueprint is not a verdict. It is a clearer way to understand the patterns behind your choices.'),
      paragraphs: [
        clip(s[1], 85),
        clip(s[27], 85),
        clip(`${s[2]} ${s[25]}`, 85)
      ],
      signoff_name: 'Divya Bajaj',
      signoff_role: 'Astro-Numerologist'
    }
  };
}

async function createDirectPremiumPdf({ lead, reportText }) {
  if (!String(reportText || '').trim()) throw new Error('Generated report text is required');

  const factLedger = buildFactLedger({
    name: lead?.name,
    email: lead?.email,
    phone: lead?.phone,
    dob: lead?.dob,
    tob: lead?.tob,
    pob: lead?.pob,
    question: lead?.question
  });

  const pages = buildDirectPages({ lead, reportText, factLedger });
  const contentQa = validatePremiumContent({ pages, factLedger });

  if (!contentQa.passed) {
    const blocking = contentQa.issues
      .filter(issue => ['critical', 'high'].includes(issue.severity))
      .slice(0, 10)
      .map(issue => `${issue.path || issue.type}: ${issue.message}`)
      .join(' | ');
    throw new Error(`Premium report content could not pass validation: ${blocking}`);
  }

  const svgPages = renderAllPages({ pages, factLedger, layoutPlan: {} });
  const geometry = geometryQa(svgPages);
  if (!geometry.passed) {
    const blocking = geometry.issues.slice(0, 8).map(issue => `Page ${issue.page_number || '?'}: ${issue.message}`).join(' | ');
    throw new Error(`Premium report layout failed geometry QA: ${blocking}`);
  }

  const pdfBuffer = await composePremiumPdf(svgPages);
  return { pdfBuffer, pages, factLedger, contentQa, geometry, model: 'deterministic-direct-v2' };
}

module.exports = { createDirectPremiumPdf, buildDirectPages, parseSections };
