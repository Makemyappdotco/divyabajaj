module.exports = Object.freeze({
  version: 'integrated-report-design-v4',
  documentTitle: 'The Integrated Life Report',
  methodologyLine: 'Nadi Astrology + Vedic Numerology',
  page: Object.freeze({
    size: 'A4',
    left: 45,
    right: 45,
    contentTop: 132,
    contentBottom: 688,
    headerDividerY: 113,
    footerDividerY: 779
  }),
  colors: Object.freeze({
    paper: '#FBF5EB',
    paperLight: '#FFFDF8',
    gold: '#B7873D',
    goldDeep: '#A9772E',
    goldSoft: '#D8B778',
    sand: '#F7ECDD',
    sandDeep: '#F0DFC6',
    ink: '#1D1A18',
    muted: '#62584D',
    line: '#D6B985',
    white: '#FFFFFF'
  }),
  type: Object.freeze({
    display: 'Times-Roman',
    displayBold: 'Times-Bold',
    displayItalic: 'Times-Italic',
    body: 'Helvetica',
    bodyBold: 'Helvetica-Bold',
    h1: 22,
    h2: 15,
    h3: 10.5,
    bodySize: 9,
    small: 6.9,
    table: 7.5,
    lineGap: 3
  }),
  spacing: Object.freeze({ xs: 4, sm: 7, md: 11, lg: 16, xl: 22 }),
  header: Object.freeze({
    logoWidth: 118,
    logoTop: 17,
    sectionX: 442,
    sectionY: 90,
    sectionWidth: 108
  }),
  footer: Object.freeze({
    textX: 45,
    textY: 798,
    pageX: 438,
    pageY: 798,
    portraitX: 472,
    portraitY: 684,
    portraitWidth: 123,
    portraitHeight: 158
  }),
  rules: Object.freeze({
    minimumSectionStartSpace: 105,
    minimumHeadingFollowSpace: 58,
    startMajorSectionOnNewPage: false,
    dedicatedPages: Object.freeze(['cover', 'contents', 'summary'])
  })
});
