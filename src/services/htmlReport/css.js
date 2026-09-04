const { page: P, color: C } = require('./tokens');

module.exports = function buildCss(fontFaceCss) {
  return `
${fontFaceCss}

*{box-sizing:border-box; margin:0; padding:0;}
html,body{width:${P.width}pt;}
body{font-family:'DB Sans',sans-serif; color:${C.ink}; font-size:10.2pt; line-height:1.5;}

@page { size: ${P.width}pt ${P.height}pt; margin: 0; }

.page{
  position:relative;
  width:${P.width}pt;
  height:${P.height}pt;
  background:${C.cream};
  overflow:hidden;
  break-after:page;
  page-break-after:always;
}
.page:last-child{ break-after:auto; page-break-after:auto; }

/* The letterhead (logo, top/bottom rules, footer text, portrait) is the real
   designer artwork pulled out of the approved PDF, used as a full-bleed
   background image so it is pixel-identical on every page, not recreated. */
.page-bg{ background-size:${P.width}pt ${P.height}pt; background-repeat:no-repeat; }

.page-content{
  position:absolute;
  left:${P.marginX}pt;
  right:${P.marginX}pt;
  top:${P.headerZone}pt;
  bottom:${P.footerZone}pt;
  width:${P.width - P.marginX * 2}pt;
}

/* section label, top right - the only piece of header chrome that changes per
   page, so it's the only piece drawn in code instead of baked into the image */
.chrome-section-label{
  position:absolute; right:${P.marginX}pt; top:88pt; max-width:230pt;
  font-family:'DB Sans',sans-serif; font-weight:600; font-size:7.6pt; letter-spacing:1.1pt;
  color:${C.muted}; text-transform:uppercase; text-align:right;
}

/* ---- typography ---- */
.kicker{ font-family:'DB Sans',sans-serif; font-weight:700; font-size:8.3pt; letter-spacing:1.6pt; color:${C.gold}; text-transform:uppercase; }
h1.doc-title{ font-family:'DB Serif',serif; font-weight:700; font-size:23pt; line-height:1.18; margin-top:6pt; color:${C.ink}; }
.section-number{
  font-family:'DB Sans',sans-serif; font-weight:700; font-size:8.5pt; letter-spacing:0.5pt;
  color:${C.gold};
}
.section-title{ font-family:'DB Serif',serif; font-weight:700; font-size:22pt; color:${C.ink}; }
.section-title-row{ margin-bottom:9pt; }
.section-rule{ height:0.8pt; background:${C.goldLine}; margin-bottom:12pt; }

.subheading{ font-family:'DB Sans',sans-serif; font-weight:700; font-size:9.6pt; letter-spacing:0.6pt; color:${C.gold}; text-transform:uppercase; margin:9pt 0 4pt; }
p.body-text{ font-size:10pt; line-height:1.56; margin-bottom:8pt; color:${C.ink}; }
ul.bullets{ list-style:none; margin:2pt 0 8pt; padding:0; }
ul.bullets li{ position:relative; padding-left:14pt; font-size:10pt; line-height:1.5; margin-bottom:5pt; }
ul.bullets li::before{ content:''; position:absolute; left:2pt; top:6.5pt; width:4pt; height:4pt; border-radius:50%; background:${C.gold}; }

.callout{ background:${C.creamSoft}; border:0.6pt solid ${C.goldLine}; border-radius:5pt; padding:11pt 14pt 12pt 16pt; margin:6pt 0 10pt; position:relative; }
.callout::before{ content:''; position:absolute; left:0; top:0; bottom:0; width:4pt; background:${C.gold}; border-radius:5pt 0 0 5pt; }
.callout-title{ font-family:'DB Sans',sans-serif; font-weight:700; font-size:7.6pt; letter-spacing:1pt; color:${C.gold}; text-transform:uppercase; margin-bottom:4pt; }
.callout-body{ font-size:9.7pt; line-height:1.48; font-weight:600; color:${C.ink}; }

table.dtable{ width:100%; border-collapse:collapse; margin:4pt 0 10pt; }
table.dtable th{ background:${C.gold}; color:${C.white}; font-family:'DB Sans',sans-serif; font-weight:700; font-size:7.6pt; letter-spacing:0.6pt; text-transform:uppercase; text-align:left; padding:6pt 9pt; }
table.dtable td{ font-size:9.2pt; line-height:1.42; padding:6.5pt 9pt; border-bottom:0.5pt solid ${C.goldLine}; vertical-align:top; }
table.dtable tr:last-child td{ border-bottom:none; }
table.dtable td.col-label{ font-weight:700; white-space:nowrap; }

.italic{ font-family:'DB Serif',serif; font-style:italic; font-size:9.6pt; color:${C.muted}; line-height:1.5; }

/* ---- cover ----
   The cover background (zodiac wheel, gold border, icons, moon phases, number
   grid, portrait, logo, title, method line) is one image pulled straight out
   of the approved PDF - the source file ships it pre-flattened with the
   "Prepared For" fields already blanked out. So the only things drawn in code
   are the four dynamic fields, positioned on top of that exact background. */
.cover-name-overlay{
  position:absolute; left:66pt; top:493pt; width:260pt; height:27pt;
  background:${C.cream};
  font-family:'DB Serif',serif; font-weight:700; font-size:20pt; color:${C.ink};
  white-space:nowrap; overflow:hidden;
}
.cover-field-overlay{
  /* masks only the baked-in dotted-line span itself (measured ~107pt-228pt),
     with a small buffer - wide enough to hide the dots under any realistic
     value, but stops well short of the portrait so it never draws over her */
  position:absolute; left:107pt; width:165pt; height:19pt;
  background:${C.cream};
  font-family:'DB Sans',sans-serif; font-weight:600; font-size:12.5pt; color:${C.ink};
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* ---- TOC ---- */
.toc-row{ display:flex; align-items:baseline; padding:7.5pt 0; border-bottom:0.5pt dotted ${C.goldLine}; }
.toc-num{ width:22pt; font-family:'DB Sans',sans-serif; font-weight:700; font-size:8.5pt; color:${C.gold}; }
.toc-label{ flex:1; font-size:10pt; font-weight:600; }
.toc-page{ width:22pt; text-align:right; font-family:'DB Sans',sans-serif; font-weight:700; font-size:8.5pt; color:${C.gold}; }

/* ---- one-page summary ---- */
.pulse-note{ font-size:9pt; }

/* ---- numbered rows (four ideas / closing summary) ---- */
.numbered-row{ display:flex; gap:12pt; padding:8pt 0 7pt; align-items:flex-start; }
.numbered-num{ font-family:'DB Serif',serif; font-weight:700; font-size:15pt; color:${C.gold}; width:22pt; flex-shrink:0; line-height:1.3; }
.numbered-rule{ height:0.5pt; background:${C.goldLine}; margin:0; }

.table-continued-label{ font-family:'DB Sans',sans-serif; font-weight:600; font-size:7.6pt; letter-spacing:1pt; color:${C.muted}; text-transform:uppercase; margin-bottom:5pt; }
`;
};
