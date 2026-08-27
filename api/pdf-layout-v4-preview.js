const { generateStructuredPaidPdfV4 } = require('../src/services/pdfStructuredV4');

function area(intro, chart, numbers, convergence, tension, timing, actions, confidence) {
  return { intro, birth_chart: chart, numbers, convergence, tension_or_silence: tension, timing, actions, confidence };
}

const reportJson = {
  primer: {
    purpose: 'This report is designed to show its working rather than hand you unexplained conclusions. Each major life area separates the birth-chart reading from the number reading, then shows where they agree, where they differ, what timing can responsibly be discussed, and what practical action follows.',
    systems: 'Nadi Astrology is presented as the primary astrological layer in this report. Vedic Numerology is used as an independent second opinion. The value comes from comparing the two honestly, not from forcing them to say the same thing.',
    four_ideas: {
      houses: 'The birth chart is divided into twelve houses. Each house describes a department of life such as money, home, partnership, work, children or gains. When several strong factors repeat around one house, that area deserves more attention.',
      planets: 'Planets carry different responsibilities depending on where they are placed and what they govern. A planet connected to several important houses can become a major operating force in the chart.',
      dasha: 'The chart describes what is available, while the Dasha sequence helps explain which themes are active now. This is why timing is treated separately from personality.',
      chain_of_command: 'A planet does not act in isolation. Its relationships add layers to how its promise is delivered. The report keeps the technical structure in the background and explains the result in normal language.'
    },
    convergence_method: 'Convergence means both systems independently support the same conclusion. Tension means they point in different directions. Silence means the available data does not justify a stronger statement. All three outcomes are useful and are stated openly.',
    limits: [
      'It will not diagnose disease or replace qualified medical advice.',
      'It will not guarantee marriage, childbirth, income or a specific external outcome.',
      'It will not predict death or provide a date for an irreversible event.',
      'It will not use fear to push remedies, gemstones or consultations.'
    ],
    disclaimer: 'Use this report as a structured reflection tool. Important decisions should still be checked against real-world facts, professional advice and your own judgement.'
  },
  glance: {
    astrology: [
      { element: 'Ascendant', position: 'Virgo 08°13\'', plain_meaning: 'Analytical, precise, correction-oriented and naturally drawn to improving systems.' },
      { element: 'Ascendant lord', position: 'Mercury in the 12th house', plain_meaning: 'Strong thinking and advisory ability can work better behind the scenes than in constant public display.' },
      { element: 'Moon', position: 'Pisces, Purva Bhadrapada', plain_meaning: 'Emotional depth, intuition and a private inner life sit beneath a practical surface.' },
      { element: 'Strongest house', position: '11th house', plain_meaning: 'Income, networks, long-term gains and fulfilment of ambition deserve special attention.' },
      { element: 'Dominant planet', position: 'Venus', plain_meaning: 'Money, quality, relationships, professional value and reputation repeatedly connect back to the same force.' },
      { element: 'Current period', position: 'Mercury major / Saturn sub', plain_meaning: 'A chapter for consolidation, documentation and strengthening structures rather than scattered expansion.' },
      { element: 'Next major shift', position: 'Ketu period begins July 2027', plain_meaning: 'A meaningful change in priorities, attachment and direction begins to build from this point.' }
    ],
    numerology: [
      { label: 'Birth Number', value: '6', derived_from: 'Day of birth', plain_meaning: 'Relationship intelligence, quality, responsibility and a strong response to beauty and harmony.' },
      { label: 'Destiny Number', value: '7', derived_from: 'Full date of birth', plain_meaning: 'Research, depth, privacy, analysis and the need to understand before acting.' },
      { label: 'Name Number', value: '7', derived_from: 'Submitted name', plain_meaning: 'The public identity reinforces depth, independence of thought and specialist knowledge.' },
      { label: 'Personal Year 2026', value: '7', derived_from: 'Birth date and current year', plain_meaning: 'A year of review, refinement and selective restructuring rather than noisy expansion.' }
    ],
    headline_finding: 'The strongest pattern is the combination of relationship intelligence and specialist depth. The chart repeatedly rewards expertise, quality and trusted positioning, while the numbers repeatedly pull toward research, selectivity and a private working style. The tension is not ability. It is learning when to be visible and when to withdraw.'
  },
  life_areas: {
    personal_nature: area(
      'You are likely to be experienced by other people as capable, composed and helpful, but your internal process is more private and more demanding than it looks from the outside.',
      'The chart supports analysis, observation and correction. You notice what is inefficient, inconsistent or unfinished very quickly. This is useful in advisory work, strategy and problem-solving, but the same strength can become over-analysis when a decision requires movement before every detail is perfect. Your best thinking often happens away from noise, meetings and constant social interaction.',
      'The numbers repeat quality consciousness, relationship awareness and a need for intellectual depth. You are not built for shallow repetition. You do better when the work rewards judgement, refinement and expertise.',
      'Both systems support a specialist mind that performs best when given enough private thinking time and a clear standard of quality. Your advantage comes from seeing detail without losing the larger purpose.',
      'The chart can create a desire to correct everything before moving, while the numbers can create a desire to retreat until the answer feels completely clear. Together this can delay decisions that are already good enough.',
      ['The current cycle rewards simplification, documentation and choosing fewer priorities more seriously.'],
      ['Protect uninterrupted thinking time instead of filling every day with calls and reactions.', 'Set a definition of good enough before beginning important work.', 'Build visible proof of expertise rather than depending on constant self-promotion.'],
      'High for the overall personality pattern. Moderate for how strongly it appears in every environment.'
    ),
    past_life_karma: area(
      'This section is symbolic rather than literal. It describes repeating patterns that behave like unfinished lessons.',
      'The chart repeatedly links growth with detachment from outcomes and with learning to work without needing immediate validation. There is a strong lesson around using intelligence as service rather than as control.',
      'The number pattern reinforces introspection, independence of thought and periods of withdrawal. Lessons repeat when analysis becomes isolation or when standards become emotional distance.',
      'Both systems describe a lesson around attachment. Your progress accelerates when you can care deeply without needing every result to confirm your worth.',
      'One layer wants connection and responsibility, while the other periodically needs distance. Neither is wrong. The skill is learning to communicate the need for space instead of disappearing into it.',
      [],
      ['Finish conversations instead of mentally withdrawing from them.', 'Separate responsibility from guilt.', 'Notice when perfectionism is actually fear of judgement.'],
      'Moderate. This is a symbolic interpretation and should be used for reflection rather than certainty.'
    ),
    finances: area(
      'Money works best when expertise, trust and repeatable systems are allowed to compound over time.',
      'The financial pattern favours advisory value, specialist knowledge, long-term relationships and networks. Income is stronger when the work has a reputation component rather than being treated as anonymous labour. The chart also warns against scattered expansion, weak documentation and decisions made only because an opportunity looks exciting in the moment.',
      'The numbers favour quality, selective risk and deep understanding before commitment. They do not reward chasing every opportunity. A disciplined financial structure matters because the same sensitivity to quality can increase lifestyle spending when boundaries are weak.',
      'The clearest financial instruction is to earn through expertise that people trust, then build systems around the money so success does not depend on constant presence.',
      'The chart can support ambitious gains through networks while the number pattern is more selective and private. The practical middle path is controlled visibility rather than total withdrawal or constant networking.',
      ['2026 supports simplification and system-building.', '2027 begins a stronger shift in priorities.', '2028 is better used for rebuilding momentum around the new direction than forcing expansion before the foundation is ready.'],
      ['Separate personal and business cash flow completely.', 'Build a written monthly review for revenue, margin, tax and reserves.', 'Choose one or two scalable offers rather than adding endless services.', 'Treat reputation and repeat customers as financial assets.'],
      'High for the earning style and the need for structure. Timing is moderate and should be reviewed with real-world conditions.'
    ),
    marriage: area(
      'Partnership matters strongly, but it cannot work well by removing individuality.',
      'The chart supports meaningful partnership but also requires clear boundaries, direct communication and respect for private mental space. Relationships become more difficult when concerns are analysed internally for too long before being spoken.',
      'The numbers reinforce loyalty, quality and responsibility in relationships. At the same time, the depth-oriented numbers need intellectual respect and periods of quiet. Superficial harmony is not enough.',
      'A strong partnership is one in which affection and autonomy coexist. You are likely to do better with a partner who respects competence, depth and independent thinking rather than demanding constant emotional display.',
      'The relationship-oriented number wants harmony, while reflective tendencies may avoid confrontation. Avoidance can look peaceful while unresolved issues accumulate underneath.',
      ['The current phase is better for strengthening relationship structure and expectations than for making decisions purely from temporary emotion.'],
      ['Discuss expectations before resentment builds.', 'Protect shared time and individual time deliberately.', 'Do not use silence as a substitute for a difficult conversation.'],
      'Moderate to high for relationship style. Specific outcomes depend on both people and cannot be guaranteed.'
    ),
    health: area(
      'The most useful health instruction is rhythm rather than intensity.',
      'The chart suggests that stress can be amplified by mental overactivity, irregular rest and long periods of carrying responsibility without adequate recovery. This is not a diagnosis. It is a pattern for routine awareness.',
      'The numbers reinforce sensitivity to environment and the need for quiet recovery. Consistency is more useful than extreme routines that are difficult to sustain.',
      'Both systems favour predictable sleep, movement, regular meals, reduced mental clutter and an environment that gives the nervous system genuine downtime.',
      'There is no responsible basis here for predicting a specific disease or medical outcome.',
      [],
      ['Keep a regular sleep and wake window as often as practical.', 'Use medical professionals for symptoms and screening rather than relying on a report.', 'Reduce decision overload by standardising recurring parts of the week.'],
      'High for routine guidance, low for any disease-specific inference because this report does not make medical diagnoses.'
    ),
    children: area(
      'If children become a central part of life, the likely style is protective but intellectually demanding.',
      'The chart supports responsibility and a desire to guide carefully. The risk is over-management when uncertainty feels uncomfortable.',
      'The numbers reinforce care, standards and the wish to create a stable environment while also respecting individuality.',
      'The strongest pattern is guidance through structure, education and consistent presence rather than control.',
      'The available information does not justify promises about fertility, number of children or guaranteed timing.',
      [],
      ['Keep guidance separate from control.', 'Allow age-appropriate independence.', 'Use qualified medical advice for fertility or health questions.'],
      'Moderate for nurturing style and intentionally limited for predictive outcomes.'
    ),
    property: area(
      'Property decisions work best when they solve a real long-term need rather than serve as proof of success.',
      'The chart supports eventual stability through thoughtful property decisions, especially when affordability, utility and long-term family needs are clear. Emotional urgency is a weaker basis for purchase.',
      'The numbers favour research and careful due diligence. They are better suited to a purchase that has been understood thoroughly than a rushed decision driven by social comparison.',
      'Both systems favour a researched purchase with conservative affordability and clear utility.',
      'The chart can create periods of stronger material ambition, while the number pattern remains cautious. Financial facts should decide when the two impulses conflict.',
      ['The next few years can support property planning, but the final decision should depend on liquidity, debt cost, legal checks and practical family needs.'],
      ['Define budget and emergency reserve before shortlisting property.', 'Complete legal and title due diligence independently.', 'Avoid treating property as a substitute for broader financial planning.'],
      'Moderate. The report can describe timing themes but cannot replace financial or legal evaluation.'
    )
  },
  remedies: {
    intro: 'The most useful remedy is the one that changes behaviour consistently rather than creating fear or dependence.',
    behavioural: [
      { pattern: 'Mental clutter from unfinished decisions', practice: 'Keep one weekly decision review', rhythm: 'Once every week', purpose: 'Move unresolved choices out of the mind and into a written system.' },
      { pattern: 'Over-analysis before action', practice: 'Set a good-enough threshold before starting', rhythm: 'For every major decision', purpose: 'Protect judgement without turning precision into delay.' }
    ],
    professional_structural: ['Use written systems for finances, recurring work, boundaries and important commitments.', 'Strengthen professional positioning around depth and expertise rather than volume.', 'Separate business cash flow, reserves and tax obligations clearly.'],
    traditional_observance: [
      { planet: 'Mercury', why: 'To support clarity, learning and disciplined communication.', observance: 'A simple Wednesday study, gratitude or charitable-learning practice if it already fits your beliefs.' },
      { planet: 'Saturn', why: 'To support patience, responsibility and consistency.', observance: 'Simple service, disciplined routine or support for workers and elders without fear-based ritual.' }
    ],
    gemstone_note: 'No gemstone recommendation should be treated as automatic from this general report. A dedicated evaluation is required before making a specific recommendation.'
  },
  timing_map: [
    { period: '2026', astrology: 'Consolidation, documentation and selective commitment.', numerology: 'Personal Year 7, review and refinement.', combined_reading: 'Simplify, strengthen systems and avoid scattered expansion.', confidence: 'High' },
    { period: '2027', astrology: 'A meaningful shift in priorities begins to build.', numerology: 'Transition toward a more outward cycle.', combined_reading: 'Release weak commitments and prepare for a changed direction.', confidence: 'Moderate' },
    { period: '2028', astrology: 'Rebuilding momentum around the new priorities.', numerology: 'Greater initiative and practical movement.', combined_reading: 'Expand selectively where the new direction has already proved itself.', confidence: 'Moderate' },
    { period: '2029', astrology: 'Networks and long-term gains receive more emphasis.', numerology: 'Collaboration and relationship themes increase.', combined_reading: 'Use partnerships carefully and build durable alliances.', confidence: 'Moderate' },
    { period: '2030', astrology: 'Consolidation of the lessons from the prior shift.', numerology: 'Communication and visibility become stronger.', combined_reading: 'Share expertise more visibly without sacrificing depth.', confidence: 'Moderate' }
  ],
  major_shift: { period: 'From July 2027', reading: 'A deeper shift in priorities and attachment begins to influence the next chapter.', confidence: 'Moderate, based on the verified timing source.' },
  closing_summary: [
    'Your strongest advantage is specialist depth combined with relationship intelligence.',
    'The main growth edge is acting before every detail feels perfect.',
    'Financial progress is strongest when expertise is converted into systems and trusted positioning.',
    'Partnership improves when harmony is not used to avoid direct conversations.',
    'The current chapter rewards simplification, documentation and selective commitment.'
  ],
  scope_limitations: [
    'This is a reflective guidance report, not medical, legal, financial or psychological diagnosis.',
    'It does not guarantee marriage, fertility, income, property purchase or any external event.',
    'Timing should be used as a planning lens rather than a promise.',
    'Important life decisions should combine this report with real-world facts and qualified professional advice where appropriate.'
  ]
};

module.exports = async function handler(req, res) {
  try {
    const pdf = await generateStructuredPaidPdfV4({
      lead: {
        name: 'Aarav Mehta',
        dob: '24/06/1992',
        tob: '10:42 AM',
        pob: 'New Delhi, Delhi, India',
        question: 'How should I approach career, money and relationships over the next few years?'
      },
      reportJson
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Divya-Bajaj-V4-Preview.pdf"');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Length', String(pdf.length));
    return res.end(pdf);
  } catch (error) {
    console.error('[V4 PDF preview error]', error);
    return res.status(500).json({ success: false, error: error.message || 'V4 preview failed' });
  }
};
