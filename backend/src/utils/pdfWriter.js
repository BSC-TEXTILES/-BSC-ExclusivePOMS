// Minimal dependency-free PDF writer.
// Consumes drawing primitives ({text}|{rect}|{line}|{image}) in top-down page
// coordinates and serializes them into a valid single/multi-page PDF 1.4
// document using the base-14 Helvetica fonts (WinAnsi encoding — no embedded
// font files needed). Images embed as XObjects: 8-bit non-interlaced PNG
// (gray/RGB/RGBA) via FlateDecode+PNG predictors, or baseline JPEG via DCTDecode.

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
    } else if (p.type === 'image') {
      // PDF's user space is bottom-up; primitives are top-down.
      const yBottomUp = PAGE_H - (p.y || 0) - (p.h || 0);
      ops.push(`q ${fx(p.w || 0)} 0 0 ${fx(p.h || 0)} ${fx(p.x || 0)} ${fx(yBottomUp)} cm /${p.name || 'Im0'} Do Q`);
    }
  }
  return ops.join('\n');
}

// ── Image parsing: 8-bit non-interlaced PNG (gray/RGB/RGBA) and baseline JPEG ──
import zlib from 'node:zlib';

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Returns { width, height, rgb: Buffer, smask: Buffer|null } or null if unsupported.
export function parsePNG(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) return null;
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0) return null;
  const channels = { 0: 1, 2: 3, 6: 4 }[colorType];
  if (!channels) return null;

  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return null; }
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;

  // Undo the per-row PNG filters.
  const rows = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[dst + x - channels] : 0;
      const b = y > 0 ? rows[dst + x - stride] : 0;
      const c = x >= channels && y > 0 ? rows[dst + x - stride - channels] : 0;
      const v = raw[src + x];
      rows[dst + x] = filter === 0 ? v
        : filter === 1 ? (v + a) & 0xff
        : filter === 2 ? (v + b) & 0xff
        : filter === 3 ? (v + ((a + b) >> 1)) & 0xff
        : (v + paeth(a, b, c)) & 0xff;
    }
  }

  if (colorType === 2) return { width, height, rgb: rows, smask: null };
  if (colorType === 0) return { width, height, gray: rows, smask: null };
  // RGBA → split colour and alpha (PDF needs the alpha as a separate SMask).
  const rgb = Buffer.alloc(width * height * 3);
  const smask = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = rows[i * 4]; rgb[i * 3 + 1] = rows[i * 4 + 1]; rgb[i * 3 + 2] = rows[i * 4 + 2];
    smask[i] = rows[i * 4 + 3];
  }
  return { width, height, rgb, smask };
}

// Returns { width, height, channels, data } for baseline JPEG, or null.
export function parseJPEG(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 4 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb)) {
      const height = buf.readUInt16BE(off + 5);
      const width = buf.readUInt16BE(off + 7);
      const channels = buf[off + 9];
      if (channels !== 1 && channels !== 3) return null;
      return { width, height, channels, data: buf };
    }
    off += 2 + len;
  }
  return null;
}

// images: Map from /Im name → { buffer, format } (collected from primitives)
function imageXObject(img) {
  if (img.format === 'jpg' || img.buffer[0] === 0xff) {
    const meta = parseJPEG(img.buffer);
    if (!meta) throw new Error('Unsupported JPEG for PDF embedding');
    const cs = meta.channels === 1 ? '/DeviceGray' : '/DeviceRGB';
    return {
      dict: `<< /Type /XObject /Subtype /Image /Width ${meta.width} /Height ${meta.height} ` +
            `/ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.buffer.length} >>`,
      stream: img.buffer, smask: null,
    };
  }
  const meta = parsePNG(img.buffer);
  if (!meta) throw new Error('Unsupported PNG for PDF embedding (needs 8-bit gray/RGB/RGBA, non-interlaced)');

  if (meta.gray) {
    const stream = zlib.deflateSync(meta.gray);
    return {
      dict: `<< /Type /XObject /Subtype /Image /Width ${meta.width} /Height ${meta.height} ` +
            `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode ` +
            `/DecodeParms << /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ${meta.width} >> ` +
            `/Length ${stream.length} >>`,
      stream, smask: null,
    };
  }

  const rgbStream = zlib.deflateSync(meta.rgb);
  let smask = null;
  let smaskBits = '';
  if (meta.smask) {
    // The /SMask object id is patched by buildPDF after layout.
    const maskStream = zlib.deflateSync(meta.smask);
    smask = {
      dict: `<< /Type /XObject /Subtype /Image /Width ${meta.width} /Height ${meta.height} ` +
            `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${maskStream.length} >>`,
      stream: maskStream,
    };
    smaskBits = ` /SMask /SMASKREF 0 R`;
  }
  return {
    dict: `<< /Type /XObject /Subtype /Image /Width ${meta.width} /Height ${meta.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
          `/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${meta.width} >> ` +
          `/Length ${rgbStream.length}${smaskBits} >>`,
    stream: rgbStream, smask,
  };
}

// pages: array of primitive arrays, one per page → PDF file Buffer.
// Image primitives: { type:'image', name:'Im0', x, y, w, h, buffer, format:'png'|'jpg' }
export function buildPDF(pages) {
  // Collect unique images in first-seen order.
  const images = [];
  const imageIndex = new Map();
  for (const prims of pages) {
    for (const p of prims || []) {
      if (p.type === 'image' && !imageIndex.has(p.name)) {
        imageIndex.set(p.name, images.length);
        images.push(p);
      }
    }
  }

  // Lay out object ids: 1 catalog, 2 pages-tree, 3.. pages, fonts, images
  // (each may own an SMask object), then page content streams.
  const pageCount = pages.length;
  const pageIds = Array.from({ length: pageCount }, (_, i) => 3 + i);
  const fontRegularId = 3 + pageCount;
  const fontBoldId = fontRegularId + 1;

  const imageLayout = [];
  let nextId = fontBoldId + 1;
  for (const img of images) {
    const x = imageXObject(img);
    const entry = { name: img.name, dict: x.dict, stream: x.stream, dictId: nextId };
    nextId += 2; // dict + stream
    if (x.smask) {
      entry.smask = x.smask;      // { dict, stream }
      entry.smaskDictId = nextId; // referenced from the image dict — patch below
      nextId += 2;
    }
    imageLayout.push(entry);
  }
  // Patch SMask references now that ids are final.
  for (const e of imageLayout) {
    if (e.smask) e.dict = e.dict.replace('/SMASKREF', `${e.smaskDictId} 0 R`);
  }
  const contentStartId = nextId;

  const parts = [];     // binary assembly (Buffers)
  const objects = [];   // object bodies in order (string or Buffer)
  const push = (body) => objects.push(body);

  push(`<< /Type /Catalog /Pages 2 0 R >>`);
  push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);
  pageIds.forEach((id, i) => {
    const pageImages = (pages[i] || []).filter((p) => p.type === 'image');
    const seen = new Set();
    const xrefs = pageImages
      .filter((p) => (seen.has(p.name) ? false : seen.add(p.name)))
      .map((p) => `/${p.name} ${imageLayout[imageIndex.get(p.name)].dictId} 0 R`)
      .join(' ');
    const xdict = xrefs ? ` /XObject << ${xrefs} >>` : '';
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fx(PAGE_W)} ${fx(PAGE_H)}] ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>${xdict} >> ` +
      `/Contents ${contentStartId + i} 0 R >>`);
  });
  push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
  for (const e of imageLayout) {
    push(e.smask ? e.dict.replace('/SMASKREF', `${e.smaskDictId} 0 R`) : e.dict);
    push({ stream: e.stream });
    if (e.smask) {
      push(e.smask.dict);
      push({ stream: e.smask.stream });
    }
  }
  for (const prims of pages) {
    const stream = primitivesToStream(prims || []);
    push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  }

  // Binary-safe assembly.
  const chunks = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [0];
  let pos = Buffer.byteLength('%PDF-1.4\n', 'latin1');
  objects.forEach((body, idx) => {
    const header = `${idx + 1} 0 obj\n`;
    const trailer = '\nendobj\n';
    const bodyBuf = typeof body === 'string' ? Buffer.from(body, 'latin1') : body.stream;
    const headBuf = Buffer.from(header, 'latin1');
    const tailBuf = Buffer.from(trailer, 'latin1');
    offsets.push(pos);
    chunks.push(headBuf, bodyBuf, tailBuf);
    pos += headBuf.length + bodyBuf.length + tailBuf.length;
  });
  const xrefStart = pos;
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ',
    ...objects.map((_, i) => `${String(offsets[i + 1]).padStart(10, '0')} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`].join('\n');
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}
