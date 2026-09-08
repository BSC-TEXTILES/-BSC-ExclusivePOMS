// Minimal dependency-free PDF writer.
// Consumes drawing primitives ({text}|{rect}|{line}) in top-down page coordinates
// and serializes them into a valid single/multi-page PDF 1.4 document using the
// base-14 Helvetica fonts (WinAnsi encoding — no embedded font files needed).

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;

// Base-14 fonts cannot encode ₹ (U+20B9) — PDFs render amounts as "Rs." instead.
const WINANSI_MAP = {
  '₹': 'Rs.', '€': 'EUR', '‘': "'", '’': "'", '“': '"', '”': '"',
  '–': '-', '—': '-', '•': '-', '\u00a0': ' ', '\u2026': '...',
};

function sanitizeText(value) {
  const replaced = String(value ?? '').replace(/[₹€‘’“”–—•\u00a0\u2026]/g, (ch) => WINANSI_MAP[ch] ?? ' ');
  // WinAnsi covers ASCII + most of Latin-1; drop anything outside to keep the stream valid.
  return replaced.replace(/[^\x20-\x7E\u00a1-\u00ff]/g, '');
}

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const fx = (n) => (Math.round(n * 100) / 100).toFixed(2);

function primitivesToStream(primitives) {
  const ops = [];
  for (const p of primitives) {
    if (p.type === 'text') {
      const [r, g, b] = hexToRgb(p.color);
      const font = p.bold ? '/F2' : '/F1';
      ops.push(`q ${fx(r / 255)} ${fx(g / 255)} ${fx(b / 255)} rg BT ${font} ${fx(p.size || 8)} Tf ${fx(p.x)} ${fx(PAGE_H - (p.y || 0))} Td (${escapePdfText(sanitizeText(p.text))}) Tj ET Q`);
    } else if (p.type === 'rect') {
      const [r, g, b] = hexToRgb(p.fill || p.color);
      ops.push(`q ${fx(r / 255)} ${fx(g / 255)} ${fx(b / 255)} rg ${fx(p.x)} ${fx(PAGE_H - (p.y || 0) - (p.h || 0))} ${fx(p.w || 0)} ${fx(p.h || 0)} re f Q`);
    } else if (p.type === 'line') {
      const [r, g, b] = hexToRgb(p.color);
      ops.push(`q ${fx(r / 255)} ${fx(g / 255)} ${fx(b / 255)} RG ${fx(p.width || 0.7)} w ${fx(p.x1)} ${fx(PAGE_H - (p.y1 || 0))} m ${fx(p.x2)} ${fx(PAGE_H - (p.y2 || 0))} l S Q`);
    }
  }
  return ops.join('\n');
}

// pages: array of primitive arrays, one per page → PDF file Buffer
export function buildPDF(pages) {
  const contents = pages.map((prims) => primitivesToStream(prims || []));
  const objects = []; // 1-indexed body object strings
  const pageObjStart = 3; // 1 catalog, 2 pages-tree; fonts after pages
  const pageCount = contents.length;
  const pageIds = Array.from({ length: pageCount }, (_, i) => pageObjStart + i);
  const fontRegularId = pageObjStart + pageCount;
  const fontBoldId = fontRegularId + 1;

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);
  contents.forEach((stream, i) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fx(PAGE_W)} ${fx(PAGE_H)}] ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
      `/Contents ${fontBoldId + 1 + i} 0 R >>`
    );
  });
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
  contents.forEach((stream) => {
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, idx) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
