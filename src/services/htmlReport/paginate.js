const { page: P } = require('./tokens');

const PT_PER_PX = 0.75; // 1px = 0.75pt (96px/in vs 72pt/in)
const CONTENT_HEIGHT = P.height - P.headerZone - P.footerZone; // in pt
const CONTENT_WIDTH = P.width - P.marginX * 2; // in pt

// Flatten sections into a linear list of "units". Most blocks are one measurable
// unit. Tables carry extra measurement variants (whole table / header alone / each
// row alone) so the packer can decide whether to split them across pages.
function flattenUnits(sections) {
  const units = [];
  let counter = 0;

  sections.forEach(section => {
    section.blocks.forEach(block => {
      if (!block) return;

      if (block.kind === 'table') {
        const id = `t${counter++}`;
        const wholeHtml = block.headHtml + block.rows.join('') + block.tailHtml;
        units.push({
          id, type: 'table', sectionKey: section.key, sectionLabel: section.label,
          headRowHtml: block.headRowHtml, rows: block.rows,
          measure: {
            [`${id}__whole`]: wholeHtml,
            [`${id}__head`]: block.headHtml + '</tbody></table>',
            ...Object.fromEntries(block.rows.map((r, i) => [`${id}__row${i}`, `<table class="dtable"><tbody>${r}</tbody></table>`]))
          }
        });
        return;
      }

      if (block.kind === 'numbered') {
        const id = `n${counter++}`;
        units.push({
          id, type: 'numbered', sectionKey: section.key, sectionLabel: section.label,
          rows: block.rows,
          measure: Object.fromEntries(block.rows.map((r, i) => [`${id}__row${i}`, r]))
        });
        return;
      }

      const id = `b${counter++}`;
      units.push({
        id, type: block.kind, sectionKey: section.key, sectionLabel: section.label,
        glueToNext: !!block.glueToNext, html: block.html,
        measure: { [id]: block.html }
      });
    });
  });

  return units;
}

async function measureAllHeightsPx(page, cssText, units) {
  const measureMap = {};
  units.forEach(u => Object.assign(measureMap, u.measure));
  const ids = Object.keys(measureMap);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${cssText}
    body{background:#fff;}
    .measure-wrap{width:${CONTENT_WIDTH}pt;}
    /* flow-root establishes a new block-formatting context so a child's own
       vertical margins are contained inside this wrapper's box instead of
       collapsing through it - otherwise getBoundingClientRect() under-reports
       height by exactly the amount of margin the browser will actually reserve
       once this block sits among real siblings in the final page. */
    .measure-item{ display:flow-root; }
  </style></head><body><div class="measure-wrap">${ids.map(id => `<div class="measure-item" id="${id}">${measureMap[id]}</div>`).join('')}</div></body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  // A second layout pass after fonts settle, to be safe against any residual reflow.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const heights = await page.evaluate((ids) => {
    const out = {};
    ids.forEach(id => {
      const el = document.getElementById(id);
      out[id] = el ? el.getBoundingClientRect().height : 0;
    });
    return out;
  }, ids);
  return heights;
}

function pt(heightsPx, id) {
  return (heightsPx[id] || 0) * PT_PER_PX;
}

// Returns pages: [{ sectionLabel, html }]
function packPages(units, heightsPx) {
  const pages = [];
  const sectionPageIndex = {};
  let curHtml = '';
  let curHeight = 0;
  let curSectionLabel = '';

  function commitPage() {
    if (curHtml.trim()) pages.push({ sectionLabel: curSectionLabel, html: curHtml });
    curHtml = '';
    curHeight = 0;
  }

  function place(html, h) {
    curHtml += html;
    curHeight += h;
  }

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    curSectionLabel = u.sectionLabel || curSectionLabel;

    if (u.type === 'table') {
      const wholeH = pt(heightsPx, `${u.id}__whole`);
      if (curHeight + wholeH <= CONTENT_HEIGHT) {
        place(`<table class="dtable"><thead>${u.headRowHtml}</thead><tbody>${u.rows.join('')}</tbody></table>`, wholeH);
        continue;
      }
      // split by rows
      const headH = pt(heightsPx, `${u.id}__head`);
      let rowIdx = 0;
      while (rowIdx < u.rows.length) {
        const firstRowH = pt(heightsPx, `${u.id}__row${rowIdx}`);
        // Don't start (or continue) a table chunk on a page that can't even fit
        // the header plus one row - move the whole chunk to a fresh page instead.
        if (curHeight > 0 && curHeight + headH + firstRowH > CONTENT_HEIGHT) commitPage();
        let chunkRows = '';
        let chunkHeight = headH;
        let placedAny = false;
        while (rowIdx < u.rows.length) {
          const rowH = pt(heightsPx, `${u.id}__row${rowIdx}`);
          if (curHeight + chunkHeight + rowH > CONTENT_HEIGHT && placedAny) break;
          chunkRows += u.rows[rowIdx];
          chunkHeight += rowH;
          placedAny = true;
          rowIdx++;
        }
        place(`<table class="dtable"><thead>${u.headRowHtml}</thead><tbody>${chunkRows}</tbody></table>`, chunkHeight);
        if (rowIdx < u.rows.length) commitPage();
      }
      continue;
    }

    if (u.type === 'numbered') {
      let rowIdx = 0;
      let listHtml = '';
      let listHeight = 0;
      const flushList = () => {
        if (listHtml) { place(`<div class="numbered-list">${listHtml}</div>`, listHeight); listHtml = ''; listHeight = 0; }
      };
      while (rowIdx < u.rows.length) {
        const rowH = pt(heightsPx, `${u.id}__row${rowIdx}`);
        if (curHeight + listHeight + rowH > CONTENT_HEIGHT && (listHeight > 0 || curHeight > 0)) {
          flushList();
          commitPage();
        }
        listHtml += u.rows[rowIdx];
        listHeight += rowH;
        rowIdx++;
      }
      flushList();
      continue;
    }

    // simple block
    let h = pt(heightsPx, u.id);
    let neededHeight = h;
    if (u.glueToNext && i + 1 < units.length && units[i + 1].type !== 'table' && units[i + 1].type !== 'numbered') {
      neededHeight += pt(heightsPx, units[i + 1].id);
    }
    if (curHeight + neededHeight > CONTENT_HEIGHT && curHeight > 0) commitPage();
    if (u.type === 'heading' && u.sectionKey && !(u.sectionKey in sectionPageIndex)) {
      sectionPageIndex[u.sectionKey] = pages.length;
    }
    place(u.html, h);
  }

  commitPage();
  return { pages, sectionPageIndex };
}

module.exports = { flattenUnits, measureAllHeightsPx, packPages, CONTENT_HEIGHT, CONTENT_WIDTH };
