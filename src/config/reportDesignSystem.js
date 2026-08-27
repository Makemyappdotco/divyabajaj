module.exports = Object.freeze({
  version: 'integrated-report-design-v3',
  documentTitle: 'The Integrated Life Report',
  methodologyLine: 'Nadi Astrology + Vedic Numerology',
  page: Object.freeze({ size: 'A4', left: 50, right: 50, top: 70, bottom: 0, safeBottom: 82 }),
  colors: Object.freeze({
    navy: '#2B2118',
    navyDeep: '#251B13',
    gold: '#B78A43',
    goldDeep: '#AD7F39',
    goldSoft: '#DFC17F',
    paper: '#FFFAF1',
    sand: '#F3E6CF',
    sandDeep: '#F5E8D2',
    white: '#FFFDF8',
    ink: '#2E241B',
    muted: '#716352',
    line: '#D8C5A8',
    green: '#257447'
  }),
  type: Object.freeze({
    display: 'Times-Bold',
    displayItalic: 'Times-Italic',
    body: 'Helvetica',
    bodyBold: 'Helvetica-Bold',
    h1: 24,
    h2: 16,
    h3: 11.2,
    bodySize: 9.2,
    small: 7.2,
    table: 8.0,
    lineGap: 3.25
  }),
  spacing: Object.freeze({ xs: 4, sm: 8, md: 12, lg: 17, xl: 23, xxl: 30 }),
  rules: Object.freeze({
    startMajorSectionOnNewPage: false,
    keepHeadingWithNextBlock: true,
    neverSplitShortCalloutAcrossPages: true,
    useSingleColumnForLongInterpretation: true,
    useTablesOnlyForStructuredFacts: true,
    summaryPagePosition: 'after-contents',
    summaryPageMustStayOnePage: true,
    bodyAlignment: 'left',
    minimumGapBetweenComponents: 10,
    minimumSectionStartSpace: 150,
    maximumIntentionalBlankSpace: 110
  })
});
