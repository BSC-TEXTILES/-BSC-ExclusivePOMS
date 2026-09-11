// Complete Purchase Order Export Engine — CSV & Branded PDF
// Produces RFC 4180 UTF-8 CSV (with BOM) and professional A4 PDF documents.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPDF } from './pdfWriter.js';
import { round2 } from './pricing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read BSC logo if available for PDF embedding
let bscLogoBuffer = null;
const possibleLogoPaths = [
  path.resolve(__dirname, '../../../frontend/public/bsc-logo.png'),
  path.resolve(__dirname, '../../../frontend/bsc-logo.png'),
];
for (const p of possibleLogoPaths) {
  try {
    if (fs.existsSync(p)) {
      bscLogoBuffer = fs.readFileSync(p);
      break;
    }
  } catch {}
}

function escCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function fmtINR(n) {
  const v = Number(n) || 0;
  return 'Rs. ' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── 1. PURCHASE ORDER CSV GENERATION ─────────────────────────────────────────

export function generatePOCsv({ header, items = [], taxes = [], charges = [], company = {} }) {
  const lines = [];

  // UTF-8 BOM for automatic Microsoft Excel Unicode detection
  const BOM = '\uFEFF';

  // Section 1: Buyer Information
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

  // Section 2: Seller / Supplier Information
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

  // Section 3: PO Header Information
  lines.push(['========================================', '========================================']);
  lines.push(['PURCHASE ORDER METADATA', '']);
  lines.push(['Purchase Order Number', header.po_number || '']);
  lines.push(['Version', `v${header.version || 1}`]);
  lines.push(['PO Date (Purchase Date)', fmtDate(header.po_date)]);
  lines.push(['Expected Delivery Date', fmtDate(header.expected_delivery_date)]);
  lines.push(['Delivery Location / Warehouse', header.location_name ? `${header.location_name} (${header.location_code})` : (header.division_name || 'Primary Hub')]);
  lines.push(['Delivery Location Address', header.location_address || header.delivery_terms || 'Company Warehouse']);
  lines.push(['Payment Terms', header.payment_terms || 'Net 30 Days']);
  lines.push(['Delivery Terms', header.delivery_terms || 'FOB Destination']);
  lines.push(['Tax Scheme', header.tax_scheme || 'GST_INTRA']);
  lines.push(['Status', (header.status || 'draft').toUpperCase()]);
  lines.push(['Currency', 'INR (Indian Rupees)']);
  lines.push(['Remarks / Notes', header.remarks || 'Standard Procurement Terms apply.']);
  lines.push(['', '']);

  // Section 4: Line Items Table
  lines.push(['========================================', '========================================']);
  lines.push(['PURCHASE ORDER LINE ITEMS', '']);
  lines.push([
    'Line #',
    'PO Number',
    'PO Date',
    'Collection',
    'Category',
    'Product SKU',
    'Product Name',
    'Brand',
    'Supplier',
    'Colour',
    'Size Breakdown',
    'Quantity',
    'Purchase Value (INR)',
    'Margin %',
    'Selling Price (INR)',
    'Profit Per Piece (INR)',
    'Total Purchase Value (INR)',
    'Total Selling Value (INR)',
    'Total Profit (INR)'
  ]);

  let totalQty = 0;
  let totalPurchaseVal = 0;
  let totalSellingVal = 0;
  let totalExpectedProfit = 0;

  for (const item of items) {
    const qty = Number(item.total_quantity) || 0;
    totalQty += qty;
    const purchaseVal = Number(item.purchase_price) || 0;
    const marginPct = Number(item.margin_percent) || 0;
    const sellingPrice = Number(item.final_value_per_unit || (purchaseVal * (1 + marginPct / 100))) || 0;
    const profitPerPiece = round2(sellingPrice - purchaseVal);
    const linePurchaseVal = round2(purchaseVal * qty);
    const lineSellingVal = round2(sellingPrice * qty);
    const lineProfit = round2(profitPerPiece * qty);

    totalPurchaseVal += linePurchaseVal;
    totalSellingVal += lineSellingVal;
    totalExpectedProfit += lineProfit;

    const sizeDetails = (item.quantities || [])
      .map((q) => `${q.sizeLabel || 'Standard'}:${q.quantity || 0}`)
      .join(' | ');

    lines.push([
      item.line_no || '',
      header.po_number || '',
      fmtDate(header.po_date),
      header.department_name || header.division_name || '',
      header.section_name || '',
      item.sku || '',
      item.product_name || '',
      item.brand_name || '',
      header.supplier_name || '',
      item.colour_name || 'Standard',
      sizeDetails || `${qty}`,
      qty,
      purchaseVal.toFixed(2),
      `${marginPct.toFixed(1)}%`,
      sellingPrice.toFixed(2),
      profitPerPiece.toFixed(2),
      linePurchaseVal.toFixed(2),
      lineSellingVal.toFixed(2),
      lineProfit.toFixed(2)
    ]);
  }

  lines.push(['', '']);

  // Section 5: Financial Summary
  lines.push(['========================================', '========================================']);
  lines.push(['FINANCIAL SUMMARY & TAX BREAKDOWN (INR)', '']);
  lines.push(['Total Items / Lines', items.length]);
  lines.push(['Total Ordered Quantity (Units)', totalQty]);
  lines.push(['Subtotal (Taxable Merchandise Value)', Number(header.subtotal || 0).toFixed(2)]);
  lines.push(['Order Level Discount', Number(header.order_discount_amount || 0).toFixed(2)]);

  // Tax breakups
  for (const t of taxes) {
    lines.push([`${t.tax_name || 'GST'} @ ${t.rate}%`, Number(t.tax_amount || 0).toFixed(2)]);
  }
  if (!taxes.length) {
    lines.push(['Tax Total (GST)', Number(header.tax_amount || 0).toFixed(2)]);
  }

  // Additional charges
  for (const c of charges) {
    lines.push([`Charge: ${c.charge_type || 'Other'} (${c.description || ''})`, Number(c.amount || 0).toFixed(2)]);
  }

  lines.push(['Grand Total Amount (INR)', Number(header.grand_total || 0).toFixed(2)]);
  lines.push(['', '']);

  // Section 6: Standard Terms & Declarations
  lines.push(['========================================', '========================================']);
  lines.push(['TERMS & CONDITIONS', '']);
  lines.push(['1. Goods must be dispatched along with Delivery Challan, E-way bill, and Original Tax Invoice.', '']);
  lines.push(['2. Material is subject to quality inspection at the receiving warehouse.', '']);
  lines.push(['3. Any defective or non-compliant merchandise will be rejected and returned at vendor cost.', '']);
  lines.push(['4. Payment will be processed strictly as per agreed credit terms after goods receipt confirmation.', '']);
  lines.push(['5. Subject to Bangalore / Davanagere jurisdiction.', '']);

  const csvContent = BOM + lines.map((row) => row.map(escCsv).join(',')).join('\r\n');
  return csvContent;
}

// ─── 2. BATCH PO LIST CSV GENERATION ──────────────────────────────────────────

export function generatePOListCsv(poRows = []) {
  const BOM = '\uFEFF';
  const headers = [
    'PO Number',
    'Version',
    'PO Date',
    'Status',
    'Division Code',
    'Division Name',
    'Section Name',
    'Supplier / Seller Name',
    'Total Quantity (Units)',
    'Subtotal (INR)',
    'Grand Total (INR)',
    'Expected Delivery Date'
  ];

  const rows = [headers];
  for (const p of poRows) {
    rows.push([
      p.po_number || '',
      `v${p.version || 1}`,
      fmtDate(p.po_date),
      (p.status || '').toUpperCase(),
      p.division_code || '',
      p.division_name || '',
      p.section_name || '',
      p.supplier_name || '',
      p.total_quantity || 0,
      Number(p.subtotal || 0).toFixed(2),
      Number(p.grand_total || 0).toFixed(2),
      fmtDate(p.expected_delivery_date)
    ]);
  }

  return BOM + rows.map((r) => r.map(escCsv).join(',')).join('\r\n');
}

// ─── 3. BRANDED PURCHASE ORDER PDF GENERATION ──────────────────────────────────

export function generatePOPdf({ header, items = [], taxes = [], charges = [], company = {} }) {
  const W = 595.28;
  const H = 841.89;
  const M = 36;
  const CONTENT_W = W - M * 2; // 523.28

  const pages = [];
  let prims = [];
  let y = M;

  const NAVY = '#0f2438';
  const ACCENT = '#b98a2f';
  const LIGHT_BG = '#f8fafc';
  const LINE_COLOR = '#e2e8f0';
  const TEXT_MAIN = '#1e293b';
  const TEXT_MUTED = '#64748b';
  const WHITE = '#ffffff';

  function pushPage() {
    // Page footer on every page
    prims.push({ type: 'line', x1: M, y1: 805, x2: W - M, y2: 805, color: LINE_COLOR });
    prims.push({
      type: 'text',
      text: 'BSC Exclusive Private Limited  ·  Official Purchase Order  ·  Valid with authorized signature',
      x: M,
      y: 818,
      size: 7.5,
      color: TEXT_MUTED
    });
    prims.push({
      type: 'text',
      text: `Page ${pages.length + 1}`,
      x: W - M - 35,
      y: 818,
      size: 7.5,
      color: TEXT_MUTED
    });
    pages.push(prims);
    prims = [];
    y = M;
  }

  // --- PAGE 1: HEADER & METADATA ---
  // Top Banner
  prims.push({ type: 'rect', x: M, y: y, w: CONTENT_W, h: 4, fill: ACCENT });
  y += 12;

  // Header Left: Logo & Company Info
  const logoSize = 44;
  if (bscLogoBuffer) {
    prims.push({ type: 'image', name: 'BscLogo', buffer: bscLogoBuffer, x: M, y: y - 2, w: logoSize, h: logoSize });
  } else {
    prims.push({ type: 'text', text: 'BSC EXCLUSIVE', x: M, y: y + 16, size: 16, bold: true, color: NAVY });
  }

  const textLeft = bscLogoBuffer ? M + logoSize + 10 : M;
  const compName = company.company_name || company.legal_name || 'B. S. Channabasappa & Sons (BSC Exclusive)';
  prims.push({ type: 'text', text: compName, x: textLeft, y: y + 8, size: 10.5, bold: true, color: NAVY });
  prims.push({
    type: 'text',
    text: company.registered_address || company.address || '#42, Commercial Avenue, PB Road, Davanagere - 577002, India',
    x: textLeft,
    y: y + 20,
    size: 7.5,
    color: TEXT_MUTED
  });
  prims.push({
    type: 'text',
    text: `GSTIN: ${company.gstin || company.gst_number || '29AABCB1234F1Z5'}  ·  PAN: ${company.pan || 'AABCB1234F'}  ·  Email: ${company.email || 'contact@bschannabasappa.com'}`,
    x: textLeft,
    y: y + 31,
    size: 7.5,
    color: TEXT_MUTED
  });

  // Header Right: PURCHASE ORDER Box
  const poBoxW = 160;
  const poBoxX = W - M - poBoxW;
  prims.push({ type: 'rect', x: poBoxX, y: y, w: poBoxW, h: 42, fill: LIGHT_BG });
  prims.push({ type: 'line', x1: poBoxX, y1: y, x2: poBoxX + poBoxW, y2: y, color: NAVY });
  prims.push({ type: 'text', text: 'PURCHASE ORDER', x: poBoxX + 10, y: y + 13, size: 11, bold: true, color: NAVY });
  prims.push({ type: 'text', text: `PO #: ${header.po_number || ''}`, x: poBoxX + 10, y: y + 25, size: 9, bold: true, color: ACCENT });
  prims.push({ type: 'text', text: `Status: ${(header.status || 'draft').toUpperCase()} (v${header.version || 1})`, x: poBoxX + 10, y: y + 36, size: 7.5, color: TEXT_MUTED });

  y += 50;
  prims.push({ type: 'line', x1: M, y1: y, x2: W - M, y2: y, color: LINE_COLOR });
  y += 12;

  // Metadata Row (4 columns)
  const colW = CONTENT_W / 4;
  prims.push({ type: 'text', text: 'PO DATE (PURCHASE DATE)', x: M, y: y + 8, size: 7, bold: true, color: TEXT_MUTED });
  prims.push({ type: 'text', text: fmtDate(header.po_date), x: M, y: y + 19, size: 9, bold: true, color: TEXT_MAIN });

  prims.push({ type: 'text', text: 'EXPECTED DELIVERY', x: M + colW, y: y + 8, size: 7, bold: true, color: TEXT_MUTED });
  prims.push({ type: 'text', text: fmtDate(header.expected_delivery_date), x: M + colW, y: y + 19, size: 9, bold: true, color: TEXT_MAIN });

  prims.push({ type: 'text', text: 'PAYMENT TERMS', x: M + colW * 2, y: y + 8, size: 7, bold: true, color: TEXT_MUTED });
  prims.push({ type: 'text', text: header.payment_terms || 'Net 30 Days', x: M + colW * 2, y: y + 19, size: 9, color: TEXT_MAIN });

  prims.push({ type: 'text', text: 'DELIVERY TERMS', x: M + colW * 3, y: y + 8, size: 7, bold: true, color: TEXT_MUTED });
  prims.push({ type: 'text', text: header.delivery_terms || 'FOB Destination', x: M + colW * 3, y: y + 19, size: 9, color: TEXT_MAIN });

  y += 28;

  // Seller (Left) and Delivery Destination (Right) Cards
  const cardW = (CONTENT_W - 14) / 2;
  const cardH = 88;

  // Seller Card
  prims.push({ type: 'rect', x: M, y: y, w: cardW, h: cardH, fill: LIGHT_BG });
  prims.push({ type: 'rect', x: M, y: y, w: cardW, h: 18, fill: NAVY });
  prims.push({ type: 'text', text: 'SELLER / VENDOR DETAILS', x: M + 8, y: y + 12, size: 8, bold: true, color: WHITE });

  prims.push({ type: 'text', text: header.supplier_name || 'N/A', x: M + 8, y: y + 31, size: 9.5, bold: true, color: TEXT_MAIN });
  prims.push({ type: 'text', text: `Vendor ID / Code: ${header.supplier_code || header.supplier_id?.slice(0, 8) || 'N/A'}`, x: M + 8, y: y + 42, size: 7.5, color: TEXT_MUTED });
  prims.push({ type: 'text', text: `GSTIN: ${header.supplier_gstin || 'Unregistered'}`, x: M + 8, y: y + 53, size: 8, bold: true, color: NAVY });
  prims.push({ type: 'text', text: `Address: ${(header.supplier_address || 'Registered vendor facility').slice(0, 50)}`, x: M + 8, y: y + 64, size: 7.5, color: TEXT_MUTED });
  prims.push({ type: 'text', text: `Contact: ${header.supplier_contact_person || 'Sales'}  |  ${header.supplier_phone || ''}`, x: M + 8, y: y + 75, size: 7.5, color: TEXT_MUTED });

  // Ship To Card
  const shipX = M + cardW + 14;
  prims.push({ type: 'rect', x: shipX, y: y, w: cardW, h: cardH, fill: LIGHT_BG });
  prims.push({ type: 'rect', x: shipX, y: y, w: cardW, h: 18, fill: '#17324d' });
  prims.push({ type: 'text', text: 'SHIP TO / DELIVERY DESTINATION', x: shipX + 8, y: y + 12, size: 8, bold: true, color: WHITE });

  const destName = header.location_name || `${header.division_name || 'Davanagere'} Central Distribution Hub`;
  prims.push({ type: 'text', text: destName, x: shipX + 8, y: y + 31, size: 9.5, bold: true, color: TEXT_MAIN });
  prims.push({ type: 'text', text: `Division: ${header.division_name || ''} (${header.division_code || ''})`, x: shipX + 8, y: y + 42, size: 7.5, color: TEXT_MUTED });
  prims.push({ type: 'text', text: `Section: ${header.section_name || ''}  ·  Dept: ${header.department_name || ''}`, x: shipX + 8, y: y + 53, size: 7.5, color: TEXT_MUTED });
  prims.push({ type: 'text', text: `Address: ${(header.location_address || header.delivery_terms || 'Company Receiving Dock, Industrial Estate').slice(0, 50)}`, x: shipX + 8, y: y + 64, size: 7.5, color: TEXT_MUTED });
  prims.push({ type: 'text', text: `Prepared By: ${header.created_by_name || 'Procurement Executive'}`, x: shipX + 8, y: y + 75, size: 7.5, color: TEXT_MUTED });

  y += cardH + 16;

  // Line Items Table Columns
  // Total Width = 523
  const tableCols = [
    { label: '#', w: 22, align: 'left' },
    { label: 'SKU & Description', w: 175, align: 'left' },
    { label: 'Brand & Colour', w: 105, align: 'left' },
    { label: 'Sizes / Qty', w: 65, align: 'left' },
    { label: 'Qty', w: 36, align: 'right' },
    { label: 'Rate (Rs)', w: 56, align: 'right' },
    { label: 'Total (Rs)', w: 64, align: 'right' }
  ];

  function drawItemsHeader() {
    prims.push({ type: 'rect', x: M, y: y, w: CONTENT_W, h: 18, fill: NAVY });
    let cx = M + 6;
    for (const col of tableCols) {
      const tx = col.align === 'right' ? cx + col.w - 12 : cx;
      prims.push({ type: 'text', text: col.label, x: tx, y: y + 12, size: 7.5, bold: true, color: WHITE });
      cx += col.w;
    }
    y += 20;
  }

  drawItemsHeader();

  // Draw Items
  let totalUnits = 0;
  items.forEach((item, idx) => {
    if (y > 720) {
      pushPage();
      prims.push({ type: 'text', text: `Purchase Order ${header.po_number || ''} (continued)`, x: M, y: y + 10, size: 9, bold: true, color: NAVY });
      y += 18;
      drawItemsHeader();
    }

    totalUnits += Number(item.total_quantity) || 0;
    const isEven = idx % 2 === 0;
    if (isEven) {
      prims.push({ type: 'rect', x: M, y: y, w: CONTENT_W, h: 20, fill: '#f8fafc' });
    }

    let cx = M + 6;
    // 1. Line No
    prims.push({ type: 'text', text: String(item.line_no || idx + 1), x: cx, y: y + 13, size: 7.5, color: TEXT_MUTED });
    cx += tableCols[0].w;

    // 2. SKU & Description
    const skuText = `${item.sku || ''} - ${(item.product_name || '').slice(0, 26)}`;
    prims.push({ type: 'text', text: skuText, x: cx, y: y + 13, size: 7.5, bold: true, color: TEXT_MAIN });
    cx += tableCols[1].w;

    // 3. Brand & Colour
    const brandColor = `${(item.brand_name || '').slice(0, 12)} / ${(item.colour_name || 'Std').slice(0, 10)}`;
    prims.push({ type: 'text', text: brandColor, x: cx, y: y + 13, size: 7.5, color: TEXT_MAIN });
    cx += tableCols[2].w;

    // 4. Sizes breakdown preview
    const sizePreview = (item.quantities || []).map((q) => `${q.sizeLabel}:${q.quantity}`).join(' ').slice(0, 16) || '-';
    prims.push({ type: 'text', text: sizePreview, x: cx, y: y + 13, size: 7, color: TEXT_MUTED });
    cx += tableCols[3].w;

    // 5. Quantity
    const qtyStr = String(item.total_quantity || 0);
    prims.push({ type: 'text', text: qtyStr, x: cx + tableCols[4].w - 12, y: y + 13, size: 8, bold: true, color: NAVY });
    cx += tableCols[4].w;

    // 6. Rate
    const rateStr = Number(item.final_value_per_unit || item.purchase_price || 0).toFixed(2);
    prims.push({ type: 'text', text: rateStr, x: cx + tableCols[5].w - 12, y: y + 13, size: 7.5, color: TEXT_MAIN });
    cx += tableCols[5].w;

    // 7. Total
    const lineTotalStr = Number(item.line_total || 0).toFixed(2);
    prims.push({ type: 'text', text: lineTotalStr, x: cx + tableCols[6].w - 12, y: y + 13, size: 8, bold: true, color: TEXT_MAIN });

    prims.push({ type: 'line', x1: M, y1: y + 20, x2: W - M, y2: y + 20, color: '#f1f5f9' });
    y += 20;
  });

  y += 10;

  // Check if summary fits on this page, else push page
  if (y > 640) {
    pushPage();
  }

  // Summary and Signatures block
  const summaryBoxW = 210;
  const summaryBoxX = W - M - summaryBoxW;
  const termsBoxW = CONTENT_W - summaryBoxW - 16;

  // Left: Remarks and Terms
  prims.push({ type: 'rect', x: M, y: y, w: termsBoxW, h: 90, fill: LIGHT_BG });
  prims.push({ type: 'rect', x: M, y: y, w: termsBoxW, h: 16, fill: '#334155' });
  prims.push({ type: 'text', text: 'SPECIAL INSTRUCTIONS & REMARKS', x: M + 8, y: y + 11, size: 7.5, bold: true, color: WHITE });
  prims.push({ type: 'text', text: header.remarks || 'Standard BSC Exclusive quality check & packaging standards required.', x: M + 8, y: y + 28, size: 7.5, color: TEXT_MAIN });
  prims.push({ type: 'text', text: '· Dispatch within promised delivery window. Late deliveries attract 1% penalty/week.', x: M + 8, y: y + 42, size: 7, color: TEXT_MUTED });
  prims.push({ type: 'text', text: '· Original GST invoice and E-way bill mandatory upon arrival at receiving warehouse.', x: M + 8, y: y + 54, size: 7, color: TEXT_MUTED });
  prims.push({ type: 'text', text: '· Total Ordered Quantity: ' + totalUnits + ' Units across ' + items.length + ' line items.', x: M + 8, y: y + 68, size: 7.5, bold: true, color: NAVY });

  // Right: Financial Totals Block
  prims.push({ type: 'rect', x: summaryBoxX, y: y, w: summaryBoxW, h: 90, fill: LIGHT_BG });
  prims.push({ type: 'line', x1: summaryBoxX, y1: y, x2: summaryBoxX + summaryBoxW, y2: y, color: NAVY });

  let sy = y + 14;
  prims.push({ type: 'text', text: 'Subtotal (Taxable):', x: summaryBoxX + 10, y: sy, size: 8, color: TEXT_MUTED });
  prims.push({ type: 'text', text: fmtINR(header.subtotal), x: summaryBoxX + summaryBoxW - 10, y: sy, size: 8, bold: true, color: TEXT_MAIN });

  if (Number(header.order_discount_amount) > 0) {
    sy += 12;
    prims.push({ type: 'text', text: 'Order Discount:', x: summaryBoxX + 10, y: sy, size: 8, color: '#dc2626' });
    prims.push({ type: 'text', text: '-' + fmtINR(header.order_discount_amount), x: summaryBoxX + summaryBoxW - 10, y: sy, size: 8, bold: true, color: '#dc2626' });
  }

  sy += 12;
  const taxLabel = taxes.length ? taxes.map(t => `${t.tax_name}@${t.rate}%`).join('+') : 'Taxes (GST):';
  prims.push({ type: 'text', text: taxLabel, x: summaryBoxX + 10, y: sy, size: 8, color: TEXT_MUTED });
  prims.push({ type: 'text', text: fmtINR(header.tax_amount), x: summaryBoxX + summaryBoxW - 10, y: sy, size: 8, bold: true, color: TEXT_MAIN });

  if (Number(header.charges_amount) > 0) {
    sy += 12;
    prims.push({ type: 'text', text: 'Freight & Charges:', x: summaryBoxX + 10, y: sy, size: 8, color: TEXT_MUTED });
    prims.push({ type: 'text', text: fmtINR(header.charges_amount), x: summaryBoxX + summaryBoxW - 10, y: sy, size: 8, color: TEXT_MAIN });
  }

  sy += 14;
  prims.push({ type: 'rect', x: summaryBoxX, y: sy - 10, w: summaryBoxW, h: 22, fill: NAVY });
  prims.push({ type: 'text', text: 'GRAND TOTAL:', x: summaryBoxX + 10, y: sy + 4, size: 9, bold: true, color: ACCENT });
  prims.push({ type: 'text', text: fmtINR(header.grand_total), x: summaryBoxX + summaryBoxW - 10, y: sy + 4, size: 10, bold: true, color: WHITE });

  y += 105;

  // Signatures Row
  const sigColW = (CONTENT_W - 20) / 2;
  prims.push({ type: 'line', x1: M, y1: y + 36, x2: M + sigColW - 10, y2: y + 36, color: LINE_COLOR });
  prims.push({ type: 'text', text: 'Authorized Signatory', x: M, y: y + 48, size: 8, bold: true, color: NAVY });
  prims.push({ type: 'text', text: 'For BSC Exclusive Private Limited', x: M, y: y + 58, size: 7.5, color: TEXT_MUTED });

  const sig2X = M + sigColW + 20;
  prims.push({ type: 'line', x1: sig2X, y1: y + 36, x2: W - M, y2: y + 36, color: LINE_COLOR });
  prims.push({ type: 'text', text: 'Vendor Acceptance & Stamp', x: sig2X, y: y + 48, size: 8, bold: true, color: NAVY });
  prims.push({ type: 'text', text: header.supplier_name || 'Vendor Representative Signature', x: sig2X, y: y + 58, size: 7.5, color: TEXT_MUTED });

  // Push final page
  pushPage();

  return buildPDF(pages);
}
