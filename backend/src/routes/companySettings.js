import { Router } from 'express';
import { query, withTransaction } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { publicUrl } from '../utils/storage.js';

const r = Router();
r.use(authenticate);

// GET /api/company-settings
r.get('/', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM company_settings LIMIT 1`);
  res.json({ data: rows[0] || null });
}));

// PUT /api/company-settings
r.put('/', requirePermission('settings.manage'), ah(async (req, res) => {
  const { companyName, logoUrl, address, phone, email, website, gstNumber, panNumber, registrationInfo, invoiceFooter, pdfHeader, pdfFooter, authorizedSignatory, orderPrefix } = req.body || {};
  const existing = (await query(`SELECT * FROM company_settings LIMIT 1`)).rows[0];
  let result;
  if (existing) {
    const { rows } = await query(
      `UPDATE company_settings SET company_name=COALESCE($1,company_name), logo_url=COALESCE($2,logo_url),
       address=COALESCE($3,address), phone=COALESCE($4,phone), email=COALESCE($5,email),
       website=COALESCE($6,website), gst_number=COALESCE($7,gst_number), pan_number=COALESCE($8,pan_number),
       registration_info=COALESCE($9,registration_info), invoice_footer=COALESCE($10,invoice_footer),
       pdf_header=COALESCE($11,pdf_header), pdf_footer=COALESCE($12,pdf_footer),
       authorized_signatory=COALESCE($13,authorized_signatory), order_prefix=COALESCE($14,order_prefix),
       updated_by=$15, updated_at=now() WHERE id=$16 RETURNING *`,
      [companyName||null, logoUrl||null, address||null, phone||null, email||null, website||null, gstNumber||null, panNumber||null, registrationInfo||null, invoiceFooter||null, pdfHeader||null, pdfFooter||null, authorizedSignatory||null, orderPrefix||null, req.user.id, existing.id]);
    result = rows[0];
  } else {
    const { rows } = await query(
      `INSERT INTO company_settings (company_name, logo_url, address, phone, email, website, gst_number, pan_number, registration_info, invoice_footer, pdf_header, pdf_footer, authorized_signatory, order_prefix, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [companyName||'Company', logoUrl||null, address||null, phone||null, email||null, website||null, gstNumber||null, panNumber||null, registrationInfo||null, invoiceFooter||null, pdfHeader||null, pdfFooter||null, authorizedSignatory||null, orderPrefix||'ORD', req.user.id]);
    result = rows[0];
  }
  await logAudit(query, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit',
    entityType: 'company_settings', entityId: result.id, afterValue: { companyName },
  });
  res.json({ data: result });
}));

// POST /api/company-settings/upload-logo
r.post('/upload-logo', requirePermission('settings.manage'), ah(async (req, res) => {
  const { logoUrl } = req.body || {};
  if (!logoUrl) throw badRequest('logoUrl is required');
  await query(`UPDATE company_settings SET logo_url=$1 WHERE id=(SELECT id FROM company_settings LIMIT 1)`, [logoUrl]);
  res.json({ ok: true });
}));

export default r;
