module.exports = Object.freeze({
  version: 'integrated-report-design-v2',
  documentTitle: 'The Integrated Life Report',
  methodologyLine: 'Nadi Astrology + Vedic Numerology',
  page: Object.freeze({ size: 'A4', left: 50, right: 50, top: 76, bottom: 0, safeBottom: 68 }),
  colors: Object.freeze({
    navy: '#1F2F4F', navyDeep: '#142038', gold: '#A88343', goldSoft: '#C9AE77',
    paper: '#FBF9F4', sand: '#F2EBDD', sandDeep: '#E8DDCA', white: '#FFFFFF',
    ink: '#222126', muted: '#6E6A63', line: '#D8CCB8', green: '#4D765F'
  }),
  type: Object.freeze({
    display: 'Times-Bold', displayItalic: 'Times-Italic', body: 'Helvetica', bodyBold: 'Helvetica-Bold',
    h1: 26, h2: 17, h3: 11.5, bodySize: 9.35, small: 7.4, table: 8.15, lineGap: 3.6
  }),
  spacing: Object.freeze({ xs: 5, sm: 9, md: 14, lg: 20, xl: 28, xxl: 38 }),
  rules: Object.freeze({
    startMajorSectionOnNewPage: true,
    keepHeadingWithNextBlock: true,
    neverSplitShortCalloutAcrossPages: true,
    useSingleColumnForLongInterpretation: true,
    useTablesOnlyForStructuredFacts: true,
    summaryPagePosition: 'after-contents',
    summaryPageMustStayOnePage: true,
    bodyAlignment: 'left',
    minimumGapBetweenComponents: 12
  })
});
