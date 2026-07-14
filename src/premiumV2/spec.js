const PAGE = Object.freeze({
  width: 595.28,
  height: 841.89,
  marginX: 44,
  top: 34,
  titleY: 62,
  contentTop: 112,
  footerTop: 801,
  footerBottom: 824,
  safeBottom: 792
});

const COLORS = Object.freeze({
  cream: '#F7F3EC',
  creamAlt: '#F2EBDD',
  gold: '#C89A3D',
  deepGold: '#B8862E',
  text: '#111111',
  secondary: '#4B4B4B',
  dark: '#0C0C0C',
  darkCard: '#131313',
  darkSoft: '#1B1917',
  white: '#FFFFFF',
  line: '#D8CDBD',
  card: '#FCFBF8'
});

const TYPE = Object.freeze({
  display: 'Georgia',
  sans: 'Helvetica',
  eyebrow: 7.2,
  pageTitle: 25,
  hero: 22,
  subheading: 15,
  cardHeading: 7.4,
  body: 8.7,
  bodyLarge: 10.2,
  note: 7.4,
  footer: 6.2,
  number: 27,
  minBody: 6.2
});

const SPACING = Object.freeze([8, 12, 16, 20, 24, 32, 40, 48, 64]);

const FORBIDDEN_PHRASES = Object.freeze([
  'multifaceted',
  'transformative journey',
  'profound journey',
  'tapestry',
  'unlock your potential',
  'align with your true self',
  'cosmic energies',
  'dynamic interplay',
  'inherent duality',
  'your unique journey',
  'embark on',
  'delve into',
  'harness your',
  'navigate this',
  'it is important to note',
  'this suggests that',
  'this indicates that'
]);

const PAGE_META = Object.freeze({
  1: { key: 'cover', title: 'The Full Blueprint', section: 'COVER', theme: 'dark', variants: ['standard'] },
  2: { key: 'summary', title: 'Your Blueprint in 60 Seconds', section: 'EXECUTIVE SUMMARY', theme: 'light', variants: ['short', 'standard', 'dense'] },
  3: { key: 'core_numbers', title: 'Your Core Numbers', section: 'CORE PATTERN', theme: 'light', variants: ['standard'] },
  4: { key: 'identity', title: 'Who You Really Are', section: 'IDENTITY', theme: 'light', variants: ['short', 'standard', 'dense'] },
  5: { key: 'career_money', title: 'Career + Money', section: 'DIRECTION', theme: 'light', variants: ['short', 'standard', 'dense'] },
  6: { key: 'relationships', title: 'Relationships + Communication', section: 'RELATIONSHIPS', theme: 'light', variants: ['short', 'standard', 'dense'] },
  7: { key: 'current_year', title: 'Your Current Year', section: 'CURRENT YEAR', theme: 'dark', variants: ['short', 'standard', 'dense'] },
  8: { key: 'next_12_months', title: 'Your Next 12 Months', section: 'NEXT 12 MONTHS', theme: 'light', variants: ['short', 'standard', 'dense'] },
  9: { key: 'long_term', title: 'Your Next 3 to 5 Years', section: 'LONG-TERM DIRECTION', theme: 'light', variants: ['short', 'standard', 'dense'] },
  10: { key: 'hidden_patterns', title: 'Your Hidden Patterns', section: 'HIDDEN PATTERNS', theme: 'light', variants: ['standard'] },
  11: { key: 'guidance', title: 'Your Personal Guidance', section: 'GUIDANCE', theme: 'light', variants: ['short', 'standard', 'dense'] },
  12: { key: 'action_plan', title: 'Your 30-Day Action Plan', section: 'ACTION PLAN', theme: 'light', variants: ['short', 'standard', 'dense'] },
  13: { key: 'deeper_reading', title: 'What Deserves a Deeper Reading', section: 'DEEPER READING', theme: 'light', variants: ['short', 'standard', 'dense'] },
  14: { key: 'closing', title: 'Personal Closing From Divya', section: 'CLOSING', theme: 'dark', variants: ['standard'] }
});

const FIELD_LIMITS = Object.freeze({
  summary: { hero_statement: [25, 55], insight_body: [18, 42] },
  core_numbers: { short_meaning: [2, 5], interpretation: [12, 28], interplay_headline: [4, 10], interplay_body: [35, 85], success_formula: [20, 45], contradiction: [35, 75] },
  identity: { view_body: [30, 70], strength_item: [1, 4], decision_body: [4, 16], blind_spot: [6, 18], birth_lens: [30, 70] },
  career_money: { hero_quote: [12, 30], bullet: [5, 18], career_direction_body: [10, 26], job_vs_business: [35, 85], money_step: [4, 12] },
  relationships: { hero_statement: [25, 55], card_body: [18, 42], communication_pattern: [35, 80], improvement: [6, 18], strongest_fit: [18, 45] },
  current_year: { theme_title: [2, 6], intro: [35, 75], card_body: [18, 42], list_item: [2, 10], decision_filter: [25, 60] },
  next_12_months: { intro: [25, 60], phase_title: [2, 5], phase_body: [22, 48], rule_72_hour: [28, 65] },
  long_term: { intro: [35, 80], step_body: [22, 50], filter: [35, 80], slow_down_item: [2, 8], formula_item: [2, 8] },
  hidden_patterns: { pattern_body: [35, 75], missing_body: [15, 38], plane_body: [15, 28] },
  guidance: { intro: [25, 60], card_body: [20, 48], gemstone_note: [35, 80] },
  action_plan: { intro: [25, 60], action_item: [5, 20], closing: [25, 60] },
  deeper_reading: { intro: [25, 60], area_body: [25, 60], question: [8, 24], closing: [20, 55] },
  closing: { hero: [8, 22], paragraph: [25, 85] }
});

const REFERENCE_RUBRIC = Object.freeze({
  overall: [
    'Premium editorial composition, not a dashboard.',
    'Warm cream and near-black rhythm with restrained muted gold.',
    'Large serif display hierarchy paired with controlled sans-serif body copy.',
    'Intentional whitespace and consistent footer safe zone.',
    'Cards are used selectively and never as a generic grid for every section.',
    'No tiny body text, no collisions, no random pills, no decorative clutter.'
  ],
  1: 'Dark cover with centered brand mark, large editorial title, prepared-for name, and three personal-detail modules near the lower third.',
  2: 'Cream executive-summary page with large intro, eight balanced insight cards in two columns, then one dark navigation band.',
  3: 'Cream page with four number cards across, one large dark interplay panel, and one restrained contradiction callout.',
  4: 'Cream editorial page with two top insight panels, one dark strengths band, a four-step decision strip, and two lower panels.',
  5: 'Cream career page with one dark hero quote, two top panels, an editorial career list, one light job-vs-business band, and one dark money-system strip.',
  6: 'Cream relationship page with strong opening statement, four balanced cards, one dark communication panel, editorial improvement list, and one closing band.',
  7: 'Dark current-year page with oversized theme, restrained numeral decoration, four dark cards, two lower focus/avoid panels, and one gold decision bar.',
  8: 'Cream vertical timeline with four spacious phases and a dark 72-hour-rule panel.',
  9: 'Cream long-term page with strong intro, four strategic cards, one wide filter band, and two contrasting bottom panels.',
  10: 'Cream Lo Shu page with grid on the left, two interpretation panels on the right, three missing-number cards, and one dark three-plane band.',
  11: 'Cream guidance page with strong intro, six balanced guidance cards, and one dark gemstone note near the bottom.',
  12: 'Cream action-plan page with four large weekly cards and one dark final commitment band.',
  13: 'Cream deeper-reading page with four consultation-value cards, one dark questions panel, and one gold closing statement.',
  14: 'Dark closing page with centered brand mark, large personal closing statement, restrained paragraphs, signature, contact panel, disclaimer, and footer.'
});

module.exports = { PAGE, COLORS, TYPE, SPACING, PAGE_META, FIELD_LIMITS, FORBIDDEN_PHRASES, REFERENCE_RUBRIC };
