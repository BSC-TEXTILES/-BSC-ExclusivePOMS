import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { publicUrl } from '../utils/storage.js';

const r = Router();
r.use(authenticate);

// GET /api/om-orders/:id/pdfs — list PDFs for an order
r.get('/:id/pdfs', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM pdf_documents WHERE order_id=$1 ORDER BY version DESC`, [req.params.id]);
  res.json({ data: rows.map(x => ({ ...x, url: publicUrl(x.storage_key) })) });
}));

// POST /api/om-orders/:id/generate-pdf — generate a PDF document record
r.post('/:id/generate-pdf', ah(async (req, res) => {
  const { rows: orders } = await query(
    `SELECT o.*, c.name AS customer_name, c.company AS customer_company, c.contact_person, c.phone AS customer_phone,
            c.email AS customer_email, c.address AS customer_address, c.city AS customer_city, c.state AS customer_state,
            c.gst_number AS customer_gst,
            cs.company_name AS cs_company_name, cs.logo_url AS cs_logo, cs.address AS cs_address, cs.phone AS cs_phone,
            cs.email AS cs_email, cs.gst_number AS cs_gst, cs.pdf_header, cs.pdf_footer, cs.authorized_signatory
     FROM om_orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN company_settings cs ON true
     WHERE o.id = $1`, [req.params.id]);
  if (!orders[0]) throw notFoundError('Order not found');

  const { rows: items } = await query(
    `SELECT i.*, p.name AS product_name, p.sku AS product_code,
            ps.sheet_name, ps.color_name, ps.swatch_hex, ps.sheet_code,
            img.storage_key AS image_storage_key
     FROM om_order_items i
     LEFT JOIN products p ON p.id = i.product_id
     LEFT JOIN product_sheets ps ON ps.id = i.sheet_id
     LEFT JOIN product_images img ON img.product_id = i.product_id AND img.is_primary = true
     WHERE i.order_id = $1 ORDER BY i.line_no`, [req.params.id]);

  const order = orders[0];

  // Generate simple HTML-based PDF record (actual PDF rendering done client-side or via library)
  const { rows: [existingMax] } = await query(`SELECT COALESCE(max(version),0)::int AS maxv FROM pdf_documents WHERE order_id=$1`, [req.params.id]);
  const version = existingMax.maxv + 1;
  const fileName = `${order.order_number}_v${version}.pdf`;
  const storageKey = `order-pdfs/${order.order_number}/${fileName}`;

  // Build the PDF HTML content
  const itemsHtml = items.map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${it.product_name || ''}</td>
      <td>${it.product_code || ''}</td>
      <td>${it.sheet_name || ''} ${it.color_name ? '/ ' + it.color_name : ''}</td>
      <td>${it.size_label}</td>
      <td style="text-align:right">${it.quantity}</td>
      <td style="text-align:right">₹${Number(it.unit_price).toLocaleString('en-IN')}</td>
      <td style="text-align:right">₹${Number(it.total).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #17324d; padding-bottom: 16px; margin-bottom: 20px; }
  .company-info h2 { margin: 0; color: #17324d; font-size: 20px; }
  .company-info p { margin: 2px 0; color: #666; font-size: 11px; }
  .order-title { text-align: right; }
  .order-title h1 { margin: 0; color: #17324d; font-size: 24px; }
  .order-title p { margin: 2px 0; color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #17324d; color: white; padding: 8px; text-align: left; font-size: 11px; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  tr:nth-child(even) { background: #f9fafb; }
  .totals { float: right; width: 280px; margin-top: 16px; }
  .totals table td { padding: 4px 8px; }
  .totals .grand { font-weight: bold; font-size: 14px; border-top: 2px solid #17324d; }
  .footer { clear: both; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 30px; font-size: 10px; color: #999; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { width: 200px; border-top: 1px solid #333; padding-top: 6px; text-align: center; font-size: 11px; }
</style></head><body>
<div class="header">
  <div class="company-info">
    <h2>${order.cs_company_name || 'Company'}</h2>
    ${order.cs_address ? `<p>${order.cs_address}</p>` : ''}
    ${order.cs_phone ? `<p>Phone: ${order.cs_phone}</p>` : ''}
    ${order.cs_email ? `<p>Email: ${order.cs_email}</p>` : ''}
    ${order.cs_gst ? `<p>GST: ${order.cs_gst}</p>` : ''}
  </div>
  <div class="order-title">
    <h1>ORDER</h1>
    <p><strong>${order.order_number}</strong></p>
    <p>Date: ${new Date(order.order_date).toLocaleDateString('en-IN')}</p>
    ${order.required_date ? `<p>Required: ${new Date(order.required_date).toLocaleDateString('en-IN')}</p>` : ''}
  </div>
</div>
<div style="display:flex;gap:40px;margin-bottom:20px;">
  <div style="flex:1">
    <h3 style="margin:0 0 8px;color:#17324d;">Customer Details</h3>
    <p style="margin:2px 0"><strong>${order.customer_name || ''}</strong></p>
    ${order.customer_company ? `<p style="margin:2px 0">${order.customer_company}</p>` : ''}
    ${order.contact_person ? `<p style="margin:2px 0">Contact: ${order.contact_person}</p>` : ''}
    ${order.customer_phone ? `<p style="margin:2px 0">Phone: ${order.customer_phone}</p>` : ''}
    ${order.customer_email ? `<p style="margin:2px 0">Email: ${order.customer_email}</p>` : ''}
    ${order.customer_address ? `<p style="margin:2px 0">${order.customer_address}</p>` : ''}
    ${order.customer_city ? `<p style="margin:2px 0">${order.customer_city}${order.customer_state ? ', ' + order.customer_state : ''}</p>` : ''}
    ${order.customer_gst ? `<p style="margin:2px 0">GST: ${order.customer_gst}</p>` : ''}
  </div>
  <div style="flex:1">
    <h3 style="margin:0 0 8px;color:#17324d;">Order Information</h3>
    <p style="margin:2px 0">Priority: <strong>${order.priority}</strong></p>
    <p style="margin:2px 0">Status: <strong>${order.status.replace(/_/g, ' ').toUpperCase()}</strong></p>
    ${order.supervisor_name ? `<p style="margin:2px 0">Supervisor: ${order.supervisor_name}</p>` : ''}
    ${order.notes ? `<p style="margin:2px 0">Notes: ${order.notes}</p>` : ''}
  </div>
</div>
<table>
  <thead><tr><th>#</th><th>Product</th><th>Code</th><th>Sheet/Color</th><th>Size</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${itemsHtml || '<tr><td colspan="8" style="text-align:center;color:#999">No items</td></tr>'}</tbody>
</table>
<div class="totals">
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">₹${Number(order.subtotal).toLocaleString('en-IN')}</td></tr>
    <tr><td>Tax</td><td style="text-align:right">₹${Number(order.tax_amount).toLocaleString('en-IN')}</td></tr>
    <tr><td>Discount</td><td style="text-align:right">-₹${Number(order.discount_amount).toLocaleString('en-IN')}</td></tr>
    <tr class="grand"><td>Grand Total</td><td style="text-align:right">₹${Number(order.grand_total).toLocaleString('en-IN')}</td></tr>
  </table>
</div>
<div class="signatures">
  <div class="sig-box"><p>Authorized Signatory<br/>${order.authorized_signatory || ''}</p></div>
  <div class="sig-box"><p>Customer Signature</p></div>
</div>
<div class="footer">
  ${order.pdf_header ? `<p>${order.pdf_header}</p>` : ''}
  ${order.pdf_footer ? `<p>${order.pdf_footer}</p>` : ''}
  <p>Generated on ${new Date().toLocaleString('en-IN')} • ${order.cs_company_name || ''}</p>
</div>
</body></html>`;

  // Save PDF record
  const { rows: [pdf] } = await query(
    `INSERT INTO pdf_documents (order_id, file_name, storage_key, file_size, generated_by, version, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING *`,
    [req.params.id, fileName, storageKey, Buffer.byteLength(html), req.user.id, version]);

  // Mark previous versions as superseded
  await query(`UPDATE pdf_documents SET status='superseded' WHERE order_id=$1 AND id != $2 AND status='active'`,
    [req.params.id, pdf.id]);

  // Store HTML as file for download
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
  const dir = path.join(uploadsDir, 'order-pdfs', order.order_number);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), html, 'utf-8');

  await logAudit(query, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'pdf_generate',
    entityType: 'pdf_document', entityId: pdf.id, afterValue: { orderNumber: order.order_number, version },
  });
  res.json({ data: { ...pdf, url: publicUrl(pdf.storage_key), html } });
}));

// GET /api/om-orders/:id/pdfs/:pdfId/download
r.get('/:id/pdfs/:pdfId/download', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM pdf_documents WHERE id=$1 AND order_id=$2`, [req.params.pdfId, req.params.id]);
  if (!rows[0]) throw notFoundError('PDF not found');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
  const filePath = path.join(uploadsDir, rows[0].storage_key);
  if (!fs.existsSync(filePath)) throw notFoundError('PDF file not found on disk');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="${rows[0].file_name}"`);
  fs.createReadStream(filePath).pipe(res);
}));

export default r;
