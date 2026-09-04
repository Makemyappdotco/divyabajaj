const { esc } = require('./content');

// The letterhead that repeats on every interior page. Drawn rather than
// carried as a background image so the logo, rules, footer type and portrait
// are all sharp at print resolution instead of being upscaled from 72 DPI.
function interiorChrome() {
  return `<div class="chrome-logo"></div>
    <div class="chrome-rule chrome-rule-top"></div>
    <div class="chrome-rule chrome-rule-bottom"></div>
    <div class="chrome-footer"><span class="nm">Divya Bajaj</span><span class="sep">|</span><span class="sub">Private Personal Report</span></div>
    <div class="chrome-portrait"></div>`;
}

function coverPageHtml(lead, images) {
  return `<div class="page page-bg" style="background-image:url(${images.coverBg});">
    <div class="cover-portrait"></div>
    <div class="cover-logo"></div>
    <div class="cover-name-overlay">${esc(lead.name)}</div>
    <div class="cover-field-overlay" style="top:552pt;">${esc(lead.dob)}</div>
    <div class="cover-field-overlay" style="top:597pt;">${esc(lead.tob)}</div>
    <div class="cover-field-overlay" style="top:641pt;">${esc(lead.pob)}</div>
  </div>`;
}

function tocPageHtml(entries, images) {
  const rows = entries.map(([num, label, pageNo]) =>
    `<div class="toc-row"><span class="toc-num">${num}</span><span class="toc-label">${esc(label)}</span><span class="toc-page">${String(pageNo).padStart(2, '0')}</span></div>`
  ).join('');
  return `<div class="page page-interior">
    ${interiorChrome()}
    <div class="chrome-section-label">Table Of Contents</div>
    <div class="page-content">
      <div class="kicker">Table Of Contents</div>
      <h1 class="doc-title" style="font-size:19pt; margin-bottom:14pt;">Inside your Integrated Life Report</h1>
      ${rows}
    </div>
  </div>`;
}

// The paidReportV2 report_json contract has no field yet for this page's
// content (strongest_signal / pulse / current_chapter / concern) - it exists
// in the approved sample PDF but not in what the AI generation step actually
// produces today. Render it only when the caller supplies onePage data
// (render.js decides that), so this never fabricates content.
function onePageSummaryHtml(lead, onePage, images) {
  const pulseRows = (onePage.pulse || []).map(p =>
    `<tr><td class="col-label">${esc(p.area)}</td><td>${esc(p.note)}</td></tr>`
  ).join('');
  const firstName = String(lead.name || '').split(' ')[0] || 'there';
  return `<div class="page page-interior">
    ${interiorChrome()}
    <div class="chrome-section-label">Your Report In One Page</div>
    <div class="page-content">
      <div class="kicker">Your Report In One Page</div>
      <h1 class="doc-title" style="font-size:20pt; margin-bottom:11pt;">The big picture, ${esc(firstName)}</h1>
      ${onePage.strongest_signal ? `<div class="callout"><div class="callout-title">The strongest signal</div><div class="callout-body">${esc(onePage.strongest_signal)}</div></div>` : ''}
      ${pulseRows ? `<div class="subheading" style="text-transform:none; color:#201C18; font-size:10.5pt; letter-spacing:0;">Seven-area pulse</div>
      <table class="dtable"><thead><tr><th>Area</th><th>What to notice</th></tr></thead><tbody>${pulseRows}</tbody></table>` : ''}
      ${onePage.current_chapter ? `<div class="callout"><div class="callout-title">Your current chapter</div><div class="callout-body">${esc(onePage.current_chapter)}</div></div>` : ''}
      ${onePage.concern ? `<p class="italic">Your main concern is &ldquo;${esc(onePage.concern)}&rdquo; The pages that follow show where the report is confident, where the picture is mixed, and what is actually useful to do next.</p>` : ''}
    </div>
  </div>`;
}

function flowPageHtml(sectionLabel, contentHtml, images) {
  return `<div class="page page-interior">
    ${interiorChrome()}
    <div class="chrome-section-label">${esc(sectionLabel)}</div>
    <div class="page-content">${contentHtml}</div>
  </div>`;
}

module.exports = { coverPageHtml, tocPageHtml, onePageSummaryHtml, flowPageHtml };
