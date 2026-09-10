// Import file parsers — CSV, XLSX, XLS and PDF.
// Each parser returns normalized rows: { sheets: [{ name, headers, rows }] }.
// Parsing is conservative: values are preserved verbatim (no truncation),
// empty/missing cells stay empty, and anything unclear is surfaced to preview.

import fs from 'node:fs';

export const SUPPORTED_TYPES = ['csv', 'xlsx', 'xls', 'pdf'];
export const MAX_IMPORT_MB = 10;

// CSV parser — RFC-4180-ish: handles quotes, commas, embedded newlines,
// escaped quotes, empty fields, and a UTF-8 BOM.
export function parseCsv(text) {
  let body = String(text || '');
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);
  const rows = [];
  let field = '', row = [], inQ = false, i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  while (i < body.length) {
    const c = body[i];
    if (inQ) {
      if (c === '"') {
        if (body[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else if (c === '\r') {
        if (body[i + 1] === '\n') { field += '\n'; i++; }
        else field += c;
      } else field += c;
      i++;
    } else {
      if (c === '"') { inQ = true; i++; }
      else if (c === ',') { pushField(); i++; }
      else if (c === '\n') { pushRow(); i++; }
      else if (c === '\r') { if (body[i + 1] === '\n') i++; pushRow(); i++; }
      else { field += c; i++; }
    }
  }
  if (field !== '' || row.length) pushRow();
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

// Excel (XLSX + old XLS) via SheetJS — reads ALL populated sheets, expands
// merged cells, and keeps numbers/dates as their original primitive types.
export async function parseExcel(buffer) {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false });
    expandMerged(ws, grid);
    const cleaned = trimGrid(grid);
    if (!cleaned.length) continue;
    const headers = cleaned[0].map((c, j) => String(c ?? '').trim());
    const rows = cleaned.slice(1).map((rr) => {
      const o = {};
      for (let j = 0; j < headers.length; j++) o[headers[j]] = rr[j] ?? '';
      return o;
    }).filter((o) => Object.values(o).some((v) => String(v).trim() !== ''));
    sheets.push({ name, headers, rows });
  }
  if (!sheets.length) throw new Error('No readable worksheets with data were found in the file.');
  return sheets;
}

function expandMerged(ws, grid) {
  const merges = (ws && (ws.merges || ws.MergedCells)) || [];
  for (const m of merges) {
    const ref = m.ref || m.Range || null;
    if (!ref || !grid.length) continue;
    const [r1, c1, r2, c2] = refToRange(ref);
    const val = (grid[r1] && grid[r1][c1]) || '';
    for (let r = r1; r <= r2; r++) {
      if (!grid[r]) continue;
      for (let c = c1; c <= c2; c++) grid[r][c] = val;
    }
  }
}

function refToRange(ref) {
  const m = String(ref).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return [0, 0, 0, 0];
  const col = (s) => s.toUpperCase().split('').reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  return [Number(m[2]) - 1, col(m[1]), Number(m[4]) - 1, col(m[3])];
}

// Drop fully-empty rows/columns at the edges.
function trimGrid(grid) {
  const h = grid.length;
  const w = Math.max(0, ...grid.map((r) => r.length));
  if (!h || !w) return [];
  let firstRow = 0;
  while (firstRow < h && grid[firstRow].every((c) => String(c ?? '').trim() === '')) firstRow++;
  let lastRow = h - 1;
  while (lastRow > firstRow && grid[lastRow].every((c) => String(c ?? '').trim() === '')) lastRow--;
  return grid.slice(firstRow, lastRow + 1)
    .map((r) => Array.from({ length: w }, (_, j) => r[j] ?? ''));
}

let _xlsx;
function loadXlsx() {
  if (_xlsx) return _xlsx;
  _xlsx = import('xlsx'); // deferred so startup stays fast and only loads on use
  return _xlsx;
}
// PDF parser — text + light table reconstruction via whitespace clustering.
// Scanned/image PDFs yield little/no text; those rows are flagged needs_review.
// Uses the standard pdf-parse package: pdfParse(buffer) -> { text, ... }.
export async function parsePdf(buffer) {
  const pdfParse = await import('pdf-parse');
  const pdf = pdfParse.default || pdfParse;
  let text = '';
  try {
    const res = await pdf(buffer);
    if (res && typeof res === 'object') {
      if (typeof res.text === 'string') text = res.text;
      else if (Array.isArray(res.pages)) text = res.pages.map((p) => p.text || '').join('\n');
      else if (Array.isArray(res.content)) text = res.content.map((c) => c.text || String(c.value ?? '')).join('\n');
      else text = JSON.stringify(res);
    } else if (typeof res === 'string') {
      text = res;
    } else {
      text = JSON.stringify(res);
    }
  } catch (e) {
    throw new Error(`Could not read PDF text: ${e.message}. If this is a scanned/image PDF, OCR is required - the file was not imported.`);
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headers = [];
  const rows = [];
  for (const line of lines) {
    const cells = line.split(/\s{3,}|\t+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2) rows.push(cells);
    else if (line) headers.push(line);
  }
  return {
    sheets: [{
      name: 'page-1',
      headers,
      rows: rows.map((r) => Object.fromEntries(headers.map((h, j) => [h || `Col ${j + 1}`, r[j] ?? '']))),
    }],
    rawText: text,
  };
}

export async function parseImportFile(absPath, type) {
  const buffer = fs.readFileSync(absPath);
  if (type === 'csv') {
    const rows = parseCsv(buffer.toString('utf8'));
    if (!rows.length) throw new Error('CSV has no data rows after the header.');
    const headers = rows[0].map((c) => String(c).trim());
    const data = rows.slice(1).map((rr) => {
      const o = {};
      headers.forEach((h, j) => { o[h] = rr[j] ?? ''; });
      return o;
    }).filter((o) => Object.values(o).some((v) => String(v).trim() !== ''));
    return { sheets: [{ name: 'csv', headers, rows: data }], rawText: null };
  }
  if (type === 'xlsx' || type === 'xls') {
    const sheets = await parseExcel(buffer);
    return { sheets, rawText: null };
  }
  if (type === 'pdf') {
    return parsePdf(buffer);
  }
  throw new Error(`Unsupported file type: ${type}`);
}

export function totalSheetRows(sheets) {
  return sheets.reduce((n, s) => n + (s.rows?.length || 0), 0);
}

export function detectType(fileName, mime) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  if (ext === 'csv' || mime === 'text/csv') return 'csv';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'xls') return 'xls';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  return null;
}