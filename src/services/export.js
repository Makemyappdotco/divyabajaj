const XLSX = require('xlsx');

function serializeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeRows(rows = []) {
  return rows.map(row => {
    const normalized = {};
    for (const [key, value] of Object.entries(row || {})) {
      normalized[key] = serializeValue(value);
    }
    return normalized;
  });
}

function escapeCsv(value) {
  const text = serializeValue(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildCombinedCsv(datasets) {
  const rows = [];

  for (const [dataset, records] of Object.entries(datasets)) {
    for (const record of records || []) {
      rows.push({ dataset, ...record });
    }
  }

  if (!rows.length) return 'dataset\n';

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach(key => set.add(key));
      return set;
    }, new Set())
  );

  return [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => headers.map(header => escapeCsv(row[header])).join(','))
  ].join('\n');
}

function buildExcelWorkbook(datasets) {
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, records] of Object.entries(datasets)) {
    const rows = normalizeRows(records);
    const worksheet = rows.length
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([['No data yet']]);

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    worksheet['!cols'] = [];

    for (let col = range.s.c; col <= range.e.c; col += 1) {
      let maxLength = 12;
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        const length = cell && cell.v !== undefined ? String(cell.v).length : 0;
        maxLength = Math.max(maxLength, Math.min(length, 45));
      }
      worksheet['!cols'][col] = { wch: maxLength + 2 };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildCombinedCsv, buildExcelWorkbook };
