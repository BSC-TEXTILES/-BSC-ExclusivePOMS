// Complete Purchase Order Export Engine — CSV & Branded PDF
// Produces RFC 4180 UTF-8 CSV (with BOM) and professional A4 PDF documents.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPDF } from './pdfWriter.js';
import { round2 } from './pricing.js';
import { generatePOQRPNG } from './qrCode.js';
import { fetchBrandImage } from './brandImage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let bscLogoBuffer = null;
const possibleLogoPaths = [
  path.resolve(__dirname, '../../../frontend/public/bsc-logo.png'),
  path.resolve(__dirname, '../../../frontend/bsc-logo.png'),
];
for (const p of possibleLogoPaths) {
  try { if (fs.existsSync(p)) { bscLogoBuffer = fs.readFileSync(p); break; } } catch {}
}

function escCsv(val) {
  if (val === null || val === undefined) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
}

function fmtINR(n) {
  const v = Number(n) || 0;
  return 'Rs. ' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return 'N/A';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'N/A';
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = dt.toLocaleString('en-IN', { month: 'short' });
  const yr = dt.getFullYear();
  // Prefix with \t and wrap in quotes to force Excel to treat as text, not a number
  return `\t"${day} ${mon} ${yr}"`;
}

function trunc(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

// ─── 1. PURCHASE ORDER CSV GENERATION ─────────────────────────────────────────

export function generatePOCsv({ header, items = [], taxes = [], charges = [], company = {} }) {
  const lines = [];
  const BOM = '\uFEFF';

  lines.push(['========================================', '========================================']);
  lines.push(['BUYER / ISSUING COMPANY DETAILS', '']);
  lines.push(['Company Name', company.legal_name || company.company_name || 'BSC Exclusive Private Limited']);
  lines.push(['Registered Address', company.registered_address || '#42, Commercial Avenue, PB Road, Davanagere - 577002']);
  lines.push(['City, State, PIN', `${company.city || 'Davanagere'}, ${company.state || 'Karnataka'} - ${company.postal_code || '577002'}`]);
  lines.push(['GSTIN', company.gstin || '29AABCB1234F1Z5']);
  lines.push(['PAN', company.pan || 'AABCB1234F']);
  lines.push(['CIN', company.cin || 'U17120KA2024PTC188920']);
  lines.push(['Contact Email', company.email || 'procurement@bscexclusive.com']);
  lines.push(['Contact Phone', company.phone || '+91 80 2345 6789']);
  lines.push(['Division', `${header.division_name || ''} (${header.division_code || ''})`]);
  lines.push(['Department / Section', `${header.department_name || ''} / ${header.section_name || ''}`]);
  lines.push(['PO Prepared By', header.created_by_name || 'Procurement Officer']);
  lines.push(['', '']);

  lines.push(['========================================', '========================================']);
  lines.push(['SELLER / SUPPLIER DETAILS', '']);
  lines.push(['Seller ID / Supplier Code', header.supplier_code || header.supplier_id || '']);
  lines.push(['Supplier Company Name', header.supplier_name || '']);
  lines.push(['Supplier Address', header.supplier_address || 'N/A']);
  lines.push(['Supplier GSTIN', header.supplier_gstin || 'N/A']);
  lines.push(['Supplier Contact Person', header.supplier_contact_person || 'Sales Representative']);
  lines.push(['Supplier Phone', header.supplier_phone || 'N/A']);
  lines.push(['Supplier Email', header.supplier_email || 'N/A']);
  lines.push(['', '']);

  lines.push(['========================================', '========================================']);
  lines.push(['PURCHASE ORDER METADATA', '']);
  lines.push(['Purchase Order Number', header.po_number || '']);
  lines.push(['Version', `v${header.version || 1}`]);
  lines.push(['PO Date (Purchase Date)', fmtDate(header.po_date)]);
  lines.push(['Expected Delivery Date', fmtDate(header.expected_delivery_date)]);
  lines.push(['Payment Terms', header.payment_terms || 'Net 30 Days']);
  lines.push(['Delivery Terms', header.delivery_terms || 'FOB Destination']);
  lines.push(['Status', (header.status || 'draft').toUpperCase()]);
  lines.push(['Currency', 'INR (Indian Rupees)']);
  lines.push(['Remarks / Notes', header.remarks || 'Standard Procurement Terms apply.']);
  lines.push(['', '']);

  lines.push(['========================================', '========================================']);
  lines.push(['PURCHASE ORDER LINE ITEMS', '']);
  lines.push(['Line #', 'PO Number', 'PO Date', 'Collection', 'Category', 'Product SKU', 'Product Name', 'Brand', 'Supplier', 'Colour', 'Size Breakdown', 'Quantity', 'Purchase Value (INR)', 'Margin %', 'Selling Price (INR)', 'Total Purchase Value (INR)', 'Grand Total (INR)']);

  let totalQty = 0;
  let totalPurchaseVal = 0;

  for (const item of items) {
    const qty = Number(item.total_quantity) || 0;
    totalQty += qty;
    const purchaseVal = Number(item.purchase_price) || 0;
    const marginPct = Number(item.margin_percent) || 0;
    const sellingPrice = Number(item.final_value_per_unit || (purchaseVal * (1 + marginPct / 100))) || 0;
    const linePurchaseVal = round2(purchaseVal * qty);
    totalPurchaseVal += linePurchaseVal;

    const sizeDetails = (item.quantities || []).map((q) => `${q.sizeLabel || 'Std'}:${q.quantity || 0}`).join(' | ');

    lines.push([
      item.line_no || '', header.po_number || '', fmtDate(header.po_date),
      header.department_name || '', header.section_name || '',
      item.sku || '', item.product_name || '', item.brand_name || '',
      header.supplier_name || '', item.colour_name || 'Standard',
      sizeDetails || `${qty}`, qty, purchaseVal.toFixed(2), `${marginPct.toFixed(1)}%`,
      sellingPrice.toFixed(2), linePurchaseVal.toFixed(2), Number(item.line_total || 0).toFixed(2)
    ]);
  }

  lines.push(['', '']);
  lines.push(['========================================', '========================================']);
  lines.push(['FINANCIAL SUMMARY & TAX BREAKDOWN (INR)', '']);
  lines.push(['Total Items / Lines', items.length]);
  lines.push(['Total Ordered Quantity (Units)', totalQty]);
  lines.push(['Subtotal (Taxable)', Number(header.subtotal || 0).toFixed(2)]);
  for (const t of taxes) lines.push([`${t.tax_name || 'GST'} @ ${t.rate}%`, Number(t.tax_amount || 0).toFixed(2)]);
  if (!taxes.length) lines.push(['Tax Total (GST)', Number(header.tax_amount || 0).toFixed(2)]);
  for (const c of charges) lines.push([`Charge: ${c.charge_type}`, Number(c.amount || 0).toFixed(2)]);
  lines.push(['Grand Total Amount (INR)', Number(header.grand_total || 0).toFixed(2)]);
  lines.push(['', '']);

  lines.push(['========================================', '========================================']);
  lines.push(['TERMS & CONDITIONS', '']);
  lines.push(['1. Goods must be dispatched with Delivery Challan, E-way bill, and Original Tax Invoice.', '']);
  lines.push(['2. Material is subject to quality inspection at the receiving warehouse.', '']);
  lines.push(['3. Any defective or non-compliant merchandise will be rejected and returned at vendor cost.', '']);
  lines.push(['4. Payment will be processed strictly as per agreed credit terms after goods receipt.', '']);
  lines.push(['5. Subject to Bangalore / Davanagere jurisdiction.', '']);

  return BOM + lines.map((row) => row.map(escCsv).join(',')).join('\r\n');
}

// ─── 2. BATCH PO LIST CSV ─────────────────────────────────────────────────────

export function generatePOListCsv(poRows = []) {
  const BOM = '\uFEFF';
  const headers = ['PO Number', 'Version', 'PO Date', 'Status', 'Division', 'Section', 'Supplier', 'Units', 'Subtotal', 'Grand Total', 'Expected Delivery'];
  const rows = [headers];
  for (const p of poRows) {
    rows.push([
      p.po_number || '', `v${p.version || 1}`, fmtDate(p.po_date), (p.status || '').toUpperCase(),
      p.division_name || '', p.section_name || '', p.supplier_name || '',
      p.total_quantity || 0, Number(p.subtotal || 0).toFixed(2), Number(p.grand_total || 0).toFixed(2),
      fmtDate(p.expected_delivery_date)
    ]);
  }
  return BOM + rows.map((r) => r.map(escCsv).join(',')).join('\r\n');
}

// ─── 3. BRANDED PURCHASE ORDER PDF GENERATION ──────────────────────────────────

export async function generatePOPdf({ header, items = [], taxes = [], charges = [], company = {} }, origin = '') {
  // A4 dimensions
  const W = 595.28;
  const H = 841.89;
  const ML = 40;  // left margin
  const MR = 40;  // right margin
  const MT = 36;  // top margin
  const MB = 50;  // bottom margin (footer area)
  const CW = W - ML - MR; // content width = 515.28
  const MAX_Y = H - MB;   // max y before footer

  const pages = [];
  let prims = [];
  let y = MT;

  const qrCodeBuffer = await generatePOQRPNG(header.po_number, origin);

  // Fetch images for all items upfront
  const itemImages = await Promise.all(
    items.map((it) => (it.brand_number ? fetchBrandImage(it.brand_number) : Promise.resolve(null)))
  );

  const NAVY = '#0f2438';
  const GOLD = '#b98a2f';
  const LIGHT = '#f8fafc';
  const GRAY_LINE = '#e2e8f0';
  const TEXT = '#1e293b';
  const MUTED = '#64748b';
  const WHITE = '#ffffff';

  function newPage() {
    if (prims.length) {
      // Footer
      prims.push({ type: 'line', x1: ML, y1: H - 35, x2: W - MR, y2: H - 35, color: GRAY_LINE });
      prims.push({ type: 'text', text: 'BSC Exclusive Pvt. Ltd.  |  Official Purchase Order  |  Valid with authorized signature', x: ML, y: H - 25, size: 7, color: MUTED });
      prims.push({ type: 'text', text: `Page ${pages.length + 1}`, x: W - MR - 40, y: H - 25, size: 7, color: MUTED });
      pages.push(prims);
    }
    prims = [];
    y = MT;
  }

  function checkPage(need) {
    if (y + need > MAX_Y) {
      newPage();
      return true;
    }
    return false;
  }

  function text(str, x, yPos, opts = {}) {
    prims.push({
      type: 'text',
      text: trunc(String(str || ''), opts.maxChars || 200),
      x, y: yPos,
      size: opts.size || 8,
      bold: opts.bold || false,
      color: opts.color || TEXT,
    });
  }

  function rect(x, yPos, w, h, fill) {
    prims.push({ type: 'rect', x, y: yPos, w, h, fill });
  }

  function line(x1, y1, x2, y2, color) {
    prims.push({ type: 'line', x1, y1, x2, y2, color: color || GRAY_LINE });
  }

  // ═══ PAGE 1: HEADER ═══

  // Gold accent bar
  rect(ML, y, CW, 3, GOLD);
  y += 10;

  // Logo
  const logoSz = 38;
  if (bscLogoBuffer) {
    prims.push({ type: 'image', name: 'BscLogo', buffer: bscLogoBuffer, x: ML, y, w: logoSz, h: logoSz });
  } else {
    text('BSC EXCLUSIVE', ML, y + 14, { size: 14, bold: true, color: NAVY });
  }

  const txL = ML + (bscLogoBuffer ? logoSz + 8 : 0);
  const compName = company.company_name || company.legal_name || 'BSC Exclusive Pvt. Ltd.';
  text(compName, txL, y + 6, { size: 10, bold: true, color: NAVY });
  text(company.address || company.registered_address || 'Davanagere, Karnataka', txL, y + 17, { size: 7, color: MUTED });
  const gstLine = `GSTIN: ${company.gstin || company.gst_number || '29AABCB1234F1Z5'}  |  PAN: ${company.pan || 'AABCB1234F'}  |  Email: ${company.email || 'info@bscexclusive.in'}`;
  text(gstLine, txL, y + 27, { size: 7, color: MUTED });

  // PO Box (right)
  const poBoxW = 155;
  const poBoxX = W - MR - poBoxW;
  rect(poBoxX, y, poBoxW, 38, LIGHT);
  line(poBoxX, y, poBoxX + poBoxW, y, NAVY);
  text('PURCHASE ORDER', poBoxX + 8, y + 10, { size: 10, bold: true, color: NAVY });
  if (qrCodeBuffer) {
    prims.push({ type: 'image', name: 'PoQr', buffer: qrCodeBuffer, x: poBoxX + poBoxW - 36, y: y + 4, w: 32, h: 32 });
  }
  text(header.po_number || '', poBoxX + 8, y + 22, { size: 9, bold: true, color: GOLD });
  text(`Status: ${(header.status || 'draft').toUpperCase()} (v${header.version || 1})`, poBoxX + 8, y + 32, { size: 7, color: MUTED });

  y += 46;
  line(ML, y, W - MR, y);
  y += 8;

  // ═══ META ROW ═══
  const metaColW = CW / 4;
  const metaLabels = ['PO DATE', 'EXPECTED DELIVERY', 'PAYMENT TERMS', 'DELIVERY TERMS'];
  const metaValues = [
    fmtDate(header.po_date),
    fmtDate(header.expected_delivery_date),
    header.payment_terms || 'Net 30 Days',
    header.delivery_terms || 'FOB Destination',
  ];
  for (let i = 0; i < 4; i++) {
    const mx = ML + metaColW * i;
    text(metaLabels[i], mx, y, { size: 6.5, bold: true, color: MUTED });
    text(trunc(metaValues[i], 22), mx, y + 11, { size: 8, bold: true, color: TEXT });
  }
  y += 24;

  // ═══ SELLER & SHIP-TO CARDS ═══
  const cardGap = 12;
  const cardW = (CW - cardGap) / 2;
  const cardH = 76;

  // Seller card
  rect(ML, y, cardW, cardH, LIGHT);
  rect(ML, y, cardW, 16, NAVY);
  text('SELLER / VENDOR DETAILS', ML + 6, y + 11, { size: 7.5, bold: true, color: WHITE });
  text(trunc(header.supplier_name, 32), ML + 6, y + 27, { size: 9, bold: true, color: TEXT });
  text(`Code: ${header.supplier_code || 'N/A'}`, ML + 6, y + 38, { size: 7, color: MUTED });
  text(`GSTIN: ${header.supplier_gstin || 'Unregistered'}`, ML + 6, y + 48, { size: 7.5, bold: true, color: NAVY });
  text(trunc(header.supplier_address || 'N/A', 42), ML + 6, y + 58, { size: 7, color: MUTED });
  text(trunc(header.supplier_contact_person || '', 28) + (header.supplier_phone ? ` | ${header.supplier_phone}` : ''), ML + 6, y + 68, { size: 7, color: MUTED });

  // Ship-to card
  const shipX = ML + cardW + cardGap;
  rect(shipX, y, cardW, cardH, LIGHT);
  rect(shipX, y, cardW, 16, '#17324d');
  text('SHIP TO / DELIVERY DESTINATION', shipX + 6, y + 11, { size: 7.5, bold: true, color: WHITE });
  const destName = header.location_name || `${header.division_name || 'Davanagere'} Distribution Hub`;
  text(trunc(destName, 32), shipX + 6, y + 27, { size: 9, bold: true, color: TEXT });
  text(`Division: ${header.division_name || ''} (${header.division_code || ''})`, shipX + 6, y + 38, { size: 7, color: MUTED });
  text(`Section: ${header.section_name || ''}  |  Dept: ${header.department_name || ''}`, shipX + 6, y + 48, { size: 7, color: MUTED });
  text(trunc(header.location_address || header.delivery_terms || 'Company Warehouse', 42), shipX + 6, y + 58, { size: 7, color: MUTED });
  text(`Prepared By: ${header.created_by_name || 'Purchase Manager'}`, shipX + 6, y + 68, { size: 7, color: MUTED });

  y += cardH + 10;

  // ═══ LINE ITEMS TABLE ═══
  const cols = [
    { label: '#', w: 18 },
    { label: 'Image', w: 26 },
    { label: 'SKU & Description', w: 160 },
    { label: 'Brand / Colour', w: 85 },
    { label: 'Sizes / Qty', w: 90 },
    { label: 'Qty', w: 32 },
    { label: 'Rate', w: 45 },
    { label: 'Amount', w: 55 },
  ];

  function drawTableHeader() {
    rect(ML, y, CW, 16, NAVY);
    let cx = ML + 4;
    for (const c of cols) {
      const tx = c.label === 'Qty' || c.label === 'Rate' || c.label === 'Amount'
        ? cx + c.w - 4 - (c.w * 0.6) : cx + 2;
      text(c.label, tx, y + 11, { size: 7, bold: true, color: WHITE });
      cx += c.w;
    }
    y += 18;
  }

  checkPage(120);
  drawTableHeader();

  let totalUnits = 0;
  items.forEach((item, idx) => {
    const rowH = 26; // Increased for image height
    checkPage(rowH + 4);

    totalUnits += Number(item.total_quantity) || 0;
    if (idx % 2 === 0) rect(ML, y, CW, rowH, '#f8fafc');

    let cx = ML + 4;
    // #
    text(String(item.line_no || idx + 1), cx, y + (rowH/2) + 2, { size: 7, color: MUTED });
    cx += cols[0].w;

    // Image
    const imgBuf = itemImages[idx];
    if (imgBuf) {
      prims.push({ type: 'image', name: `Img${item.id || idx}`, buffer: imgBuf, x: cx, y: y + 3, w: 20, h: 20 });
    }
    cx += cols[1].w;

    // SKU & Description
    const skuDesc = `${item.sku || ''} — ${(item.product_name || '').slice(0, 24)}`;
    text(skuDesc, cx, y + (rowH/2) + 2, { size: 7.5, bold: true, color: TEXT });
    cx += cols[2].w;

    // Brand / Colour
    const brandCol = `${(item.brand_name || '').slice(0, 12)} / ${(item.colour_name || 'Std').slice(0, 10)}`;
    text(brandCol, cx, y + (rowH/2) + 2, { size: 7, color: TEXT });
    cx += cols[3].w;

    // Sizes / Qty
    const sizeStr = (item.quantities || []).map((q) => `${q.sizeLabel}:${q.quantity}`).join(' ').slice(0, 20) || '-';
    text(sizeStr, cx, y + (rowH/2) + 2, { size: 6.5, color: MUTED });
    cx += cols[4].w;

    // Qty (right aligned)
    const qtyStr = String(item.total_quantity || 0);
    text(qtyStr, cx + cols[5].w - 12, y + (rowH/2) + 2, { size: 7.5, bold: true, color: NAVY });
    cx += cols[5].w;

    // Rate (right aligned)
    const rateStr = Number(item.final_value_per_unit || item.purchase_price || 0).toFixed(2);
    text(rateStr, cx + cols[6].w - 14, y + (rowH/2) + 2, { size: 7, color: TEXT });
    cx += cols[6].w;

    // Amount (right aligned)
    const amtStr = Number(item.line_total || 0).toFixed(2);
    text(amtStr, cx + cols[7].w - 16, y + (rowH/2) + 2, { size: 7.5, bold: true, color: TEXT });

    line(ML, y + rowH, W - MR, y + rowH, '#f1f5f9');
    y += rowH;
  });

  y += 6;

  // ═══ SUMMARY SECTION ═══
  checkPage(130);

  const summaryW = 220;
  const summaryX = W - MR - summaryW;
  const termsW = CW - summaryW - 12;

  // Terms box (left)
  rect(ML, y, termsW, 80, LIGHT);
  rect(ML, y, termsW, 15, '#334155');
  text('SPECIAL INSTRUCTIONS & REMARKS', ML + 6, y + 10, { size: 7, bold: true, color: WHITE });
  text(trunc(header.remarks || 'Standard BSC Exclusive quality check & packaging required.', 70), ML + 6, y + 26, { size: 7, color: TEXT });
  text('· Dispatch within promised window. Late deliveries attract 1% penalty/week.', ML + 6, y + 38, { size: 6.5, color: MUTED });
  text('· Original GST invoice and E-way bill mandatory on arrival.', ML + 6, y + 48, { size: 6.5, color: MUTED });
  text(`· Total: ${totalUnits} Units across ${items.length} line items.`, ML + 6, y + 60, { size: 7, bold: true, color: NAVY });

  // Financial summary (right)
  rect(summaryX, y, summaryW, 80, LIGHT);
  line(summaryX, y, summaryX + summaryW, y, NAVY);

  let sy = y + 12;
  text('Subtotal (Taxable):', summaryX + 8, sy, { size: 7.5, color: MUTED });
  text(fmtINR(header.subtotal), summaryX + summaryW - 8, sy, { size: 7.5, bold: true, color: TEXT });

  sy += 13;
  const taxLabel = taxes.length ? taxes.map((t) => `${t.tax_name}@${t.rate}%`).join('+') : 'GST 18%';
  text(`${taxLabel}:`, summaryX + 8, sy, { size: 7.5, color: MUTED });
  text(fmtINR(header.tax_amount), summaryX + summaryW - 8, sy, { size: 7.5, bold: true, color: TEXT });

  if (Number(header.charges_amount) > 0) {
    sy += 13;
    text('Freight & Charges:', summaryX + 8, sy, { size: 7.5, color: MUTED });
    text(fmtINR(header.charges_amount), summaryX + summaryW - 8, sy, { size: 7.5, color: TEXT });
  }

  sy += 15;
  rect(summaryX, sy - 6, summaryW, 20, NAVY);
  text('GRAND TOTAL:', summaryX + 8, sy + 6, { size: 8.5, bold: true, color: GOLD });
  text(fmtINR(header.grand_total), summaryX + summaryW - 8, sy + 6, { size: 9.5, bold: true, color: WHITE });

  y += 90;

  // ═══ SIGNATURES ═══
  checkPage(70);
  y += 6;
  const sigW = (CW - 20) / 2;

  line(ML, y + 30, ML + sigW - 10, y + 30);
  text('Authorized Signatory', ML, y + 40, { size: 7.5, bold: true, color: NAVY });
  text('For BSC Exclusive Pvt. Ltd.', ML, y + 50, { size: 7, color: MUTED });

  const sig2X = ML + sigW + 20;
  line(sig2X, y + 30, W - MR, y + 30);
  text('Vendor Acceptance & Stamp', sig2X, y + 40, { size: 7.5, bold: true, color: NAVY });
  text(trunc(header.supplier_name || 'Vendor Representative', 30), sig2X, y + 50, { size: 7, color: MUTED });

  newPage();
  return buildPDF(pages);
}
