module.exports = {
  // headerZone/footerZone measured directly off the real letterhead background
  // (page-bg.jpg) extracted from the approved PDF: top gold rule sits at ~111.5pt,
  // bottom gold rule at ~777.5pt, so content must stay inside that band.
  page: { width: 595.28, height: 841.89, marginX: 54, headerZone: 128, footerZone: 75 },
  color: {
    cream: '#F8F1E3',
    creamSoft: '#F1E6D1',
    paper: '#FBF6EC',
    gold: '#B8874A',
    goldDeep: '#9C7239',
    goldLine: '#D3B27C',
    ink: '#201C18',
    muted: '#6C6255',
    white: '#FFFFFF'
  }
};
