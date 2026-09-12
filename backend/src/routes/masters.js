import { Router } from 'express';
import { query, withTransaction, pool } from '../config/db.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
import { generateBrandQR } from '../utils/qrCode.js';
import { fetchBrandImage } from '../utils/brandImage.js';
import { upload, publicUrl, removeStored, fileStorageKey } from '../utils/storage.js';

// Grouped master-data routes — FRS §7 (Master Data Management), §8–§11.
// Lifecycle: active / inactive / archived; hard delete blocked by FK errors → RB-014 archive.
const r = Router();
r.use(authenticate);

const VIEW = requirePermission('masters.view');
const MANAGE = requirePermission('masters.manage');

function scopedDivisionFilter(req, column = 'division_id') {
  if (req.user.isSuperAdmin) return { sql: '', params: [] };
  return { sql: ` AND (${column} IS NULL OR ${column} = ANY($1::uuid[]))`, params: [req.user.divisionIds] };
}

// ---------- DIVISIONS (§5/§7) ----------
r.get('/divisions', ah(async (req, res) => {
  const f = scopedDivisionFilter(req, 'id');
  const { rows } = await query(
    `SELECT * FROM divisions WHERE status <> 'archived' ${f.sql} ORDER BY code`, f.params);
  res.json({ data: rows });
}));

r.post('/divisions', MANAGE, ah(async (req, res) => {
  const { code, name, location, contactPhone, contactEmail } = req.body || {};
  if (!code || !name) throw badRequest('code and name are required');
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO divisions (org_id, code, name, location, contact_phone, contact_email)
       VALUES ((SELECT id FROM organizations LIMIT 1), $1,$2,$3,$4,$5) RETURNING *`,
      [code, name, location || null, contactPhone || null, contactEmail || null]);
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'division', entityId: rows[0].id, afterValue: rows[0] });
    return rows[0];
  });
  res.status(201).json({ data: row });
}));

r.patch('/divisions/:id', MANAGE, ah(async (req, res) => {
  const { name, location, contactPhone, contactEmail, status } = req.body || {};
  const before = (await query(`SELECT * FROM divisions WHERE id=$1`, [req.params.id])).rows[0];
  if (!before) throw badRequest('Division not found');
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE divisions SET name=COALESCE($2,name), location=COALESCE($3,location),
              contact_phone=COALESCE($4,contact_phone), contact_email=COALESCE($5,contact_email),
              status=COALESCE($6,status) WHERE id=$1 RETURNING *`,
      [req.params.id, name || null, location || null, contactPhone || null, contactEmail || null, status || null]);
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'division', entityId: req.params.id, beforeValue: before, afterValue: rows[0] });
    return rows[0];
  });
  res.json({ data: row });
}));

// ---------- DEPARTMENTS (§7) ----------
r.get('/departments', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM departments WHERE status <> 'archived' ORDER BY is_global DESC, code`);
  res.json({ data: rows });
}));

r.post('/departments', MANAGE, ah(async (req, res) => {
  const { code, name, divisionId, isGlobal } = req.body || {};
  if (!code || !name) throw badRequest('code and name are required');
  if (!isGlobal && !divisionId) throw badRequest('divisionId required unless isGlobal=true');
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO departments (code, name, division_id, is_global) VALUES ($1,$2,$3,$4) RETURNING *`,
      [code, name, divisionId || null, !!isGlobal]);
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'department', entityId: rows[0].id, afterValue: rows[0] });
    return rows[0];
  });
  res.status(201).json({ data: row });
}));

r.patch('/departments/:id', MANAGE, ah(async (req, res) => {
  const { name, status } = req.body || {};
  const { rows } = await query(
    `UPDATE departments SET name=COALESCE($2,name), status=COALESCE($3,status) WHERE id=$1 RETURNING *`,
    [req.params.id, name || null, status || null]);
  if (!rows[0]) throw badRequest('Department not found');
  res.json({ data: rows[0] });
}));

// ---------- SECTIONS (§8 — dynamic, configuration-driven; RB-014 archive) ----------
r.get('/sections', VIEW, ah(async (req, res) => {
  const { departmentId, status, search } = req.query;
  const clauses = []; const params = [];
  if (departmentId) { params.push(departmentId); clauses.push(`s.department_id = $${params.length}`); }
  if (status) { params.push(status); clauses.push(`s.status = $${params.length}`); }
  else clauses.push(`s.status <> 'archived'`);
  if (search) { params.push(`%${search}%`); clauses.push(`(s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`); }
  const { rows } = await query(
    `SELECT s.*, d.name AS department_name, sm.code AS sizing_method_code, sm.name AS sizing_method_name,
            (SELECT count(*) FROM purchase_orders po WHERE po.section_id = s.id) AS transaction_count
       FROM sections s
       JOIN departments d ON d.id = s.department_id
       JOIN size_methods sm ON sm.id = s.sizing_method_id
      ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
      ORDER BY s.display_order, s.name`, params);
  res.json({ data: rows });
}));

r.post('/sections', MANAGE, ah(async (req, res) => {
  const { code, name, departmentId, parentGroup, sizingMethodId, displayOrder, attributes, iconUrl } = req.body || {};
  if (!code || !name || !departmentId || !sizingMethodId) throw badRequest('code, name, departmentId, sizingMethodId are required (§8.4 Add Section)');
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO sections (code, name, department_id, parent_group, sizing_method_id, display_order, attributes, icon_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [code, name, departmentId, parentGroup || null, sizingMethodId, displayOrder || 0,
       attributes ? JSON.stringify(attributes) : '{}', iconUrl || null, req.user.id]);
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'section', entityId: rows[0].id, afterValue: rows[0] });
    return rows[0];
  });
  res.status(201).json({ data: row });
}));

// Edit / activate / deactivate / archive — §8.4 lifecycle table
r.patch('/sections/:id', MANAGE, ah(async (req, res) => {
  const { name, parentGroup, sizingMethodId, displayOrder, attributes, iconUrl, status } = req.body || {};
  const before = (await query(`SELECT * FROM sections WHERE id=$1`, [req.params.id])).rows[0];
  if (!before) throw badRequest('Section not found');
  if (status === 'deleted') throw badRequest('Hard delete is not permitted for sections — use archive (RB-014)');
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE sections SET name=COALESCE($2,name), parent_group=COALESCE($3,parent_group),
              sizing_method_id=COALESCE($4,sizing_method_id), display_order=COALESCE($5,display_order),
              attributes=COALESCE($6,attributes), icon_url=COALESCE($7,icon_url), status=COALESCE($8,status)
        WHERE id=$1 RETURNING *`,
      [req.params.id, name || null, parentGroup || null, sizingMethodId || null,
       displayOrder === undefined ? null : displayOrder,
       attributes ? JSON.stringify(attributes) : null, iconUrl || null, status || null]);
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'section', entityId: req.params.id, divisionId: null, sectionId: req.params.id, beforeValue: before, afterValue: rows[0] });
    return rows[0];
  });
  res.json({ data: row });
}));

// Hard delete only when no dependencies (§8.4); FK violation surfaces as 409 RB-014 via error handler
r.delete('/sections/:id', MANAGE, ah(async (req, res) => {
  const { rowCount } = await query(`DELETE FROM sections WHERE id=$1`, [req.params.id]);
  if (!rowCount) throw badRequest('Section not found');
  res.status(204).end();
}));

// Sizes configured for a section's sizing method — drives the colour × size matrix (§9.3)
r.get('/sections/:id/sizes', VIEW, ah(async (req, res) => {
  const { rows } = await query(
    `SELECT z.id, z.label, z.numeric_value, z.display_order
       FROM sections s JOIN sizes z ON z.size_method_id = s.sizing_method_id
      WHERE s.id = $1 ORDER BY z.display_order, z.numeric_value NULLS LAST, z.label`, [req.params.id]);
  res.json({ data: rows });
}));

// ---------- CATEGORIES (§7) ----------
r.get('/categories', VIEW, ah(async (req, res) => {
  const { sectionId } = req.query;
  const params = sectionId ? [sectionId] : [];
  const { rows } = await query(
    `SELECT * FROM categories WHERE status <> 'archived' ${sectionId ? 'AND section_id=$1' : ''} ORDER BY code`, params);
  res.json({ data: rows });
}));

r.post('/categories', MANAGE, ah(async (req, res) => {
  const { sectionId, parentCategoryId, code, name } = req.body || {};
  if (!sectionId || !code || !name) throw badRequest('sectionId, code, name are required');
  const { rows } = await query(
    `INSERT INTO categories (section_id, parent_category_id, code, name) VALUES ($1,$2,$3,$4) RETURNING *`,
    [sectionId, parentCategoryId || null, code, name]);
  res.status(201).json({ data: rows[0] });
}));

// ---------- SIZE METHODS + SIZES (§9.1) ----------
r.get('/size-methods', VIEW, ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM size_methods ORDER BY code`);
  res.json({ data: rows });
}));

r.get('/sizes', VIEW, ah(async (req, res) => {
  const { methodId } = req.query;
  const params = methodId ? [methodId] : [];
  const { rows } = await query(
    `SELECT z.*, m.code AS method_code FROM sizes z JOIN size_methods m ON m.id = z.size_method_id
     ${methodId ? 'WHERE z.size_method_id=$1' : ''} ORDER BY m.code, z.display_order, z.label`, params);
  res.json({ data: rows });
}));

r.post('/sizes', MANAGE, ah(async (req, res) => {
  const { sizeMethodId, label, numericValue, displayOrder } = req.body || {};
  if (!sizeMethodId || !label) throw badRequest('sizeMethodId and label are required');
  const { rows } = await query(
    `INSERT INTO sizes (size_method_id, label, numeric_value, display_order) VALUES ($1,$2,$3,$4)
     ON CONFLICT (size_method_id, label) DO UPDATE SET display_order = EXCLUDED.display_order
     RETURNING *`, [sizeMethodId, label, numericValue || null, displayOrder || 0]);
  res.status(201).json({ data: rows[0] });
}));

// ---------- COLOURS (§9.2 — case-insensitive anti-duplicate) ----------
r.get('/colours', VIEW, ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM colours WHERE status <> 'archived' ORDER BY name`);
  res.json({ data: rows });
}));

r.post('/colours', MANAGE, ah(async (req, res) => {
  const { code, name, colourFamily, swatchHex, isCustom } = req.body || {};
  if (!name) throw badRequest('name is required');
  const dup = await query(`SELECT id FROM colours WHERE lower(name) = lower($1)`, [name]); // §9.2 duplicate guard
  if (dup.rows[0]) throw badRequest(`Colour "${name}" already exists (anti-duplicate check)`, { existingId: dup.rows[0].id });
  const { rows } = await query(
    `INSERT INTO colours (code, name, colour_family, swatch_hex, is_custom) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [code || name.toUpperCase().replace(/\s+/g, '-').slice(0, 12), name, colourFamily || null, swatchHex || null, !!isCustom]);
  res.status(201).json({ data: rows[0] });
}));

// ---------- BRANDS (§10.1 — brand number ≠ brand serial, RB-005) ----------
r.get('/brands', VIEW, ah(async (req, res) => {
  const { search, sectionId, departmentId, collectionId } = req.query;
  const params = [];
  let where = `b.status <> 'archived'`;
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (b.brand_name ILIKE $${params.length} OR b.brand_number ILIKE $${params.length} OR b.brand_serial ILIKE $${params.length})`;
  }
  if (sectionId) {
    params.push(sectionId);
    where += ` AND EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id AND p.section_id = $${params.length} AND p.status <> 'archived')`;
  }
  if (departmentId) {
    params.push(departmentId);
    where += ` AND EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id AND p.department_id = $${params.length} AND p.status <> 'archived')`;
  }
  if (collectionId) {
    params.push(collectionId);
    where += ` AND EXISTS (SELECT 1 FROM brand_collections bc WHERE bc.brand_id = b.id AND bc.collection_id = $${params.length})`;
  }
  const { rows } = await query(
    `SELECT b.*,
            COALESCE((SELECT json_agg(sup.company_name) FROM supplier_brands sb JOIN suppliers sup ON sup.id = sb.supplier_id WHERE sb.brand_id = b.id), '[]') AS providers,
            (SELECT count(*)::int FROM products p2 WHERE p2.brand_id = b.id) AS product_count,
            COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'code', c.code))
                      FROM brand_collections bc JOIN collections c ON c.id = bc.collection_id
                      WHERE bc.brand_id = b.id), '[]') AS collections
       FROM brands b
      WHERE ${where}
     ORDER BY b.brand_name`, params);
  res.json({ data: rows });
}));

r.post('/brands', requireAnyPermission(['masters.manage', 'po.create']), ah(async (req, res) => {
  let { brandNumber, brandSerial, brandName, brandCode, manufacturer, collectionIds } = req.body || {};
  brandName = (brandName || '').trim();
  if (!brandName) throw badRequest('Brand name is required');

  const randCode = Date.now().toString(36).slice(-5).toUpperCase();
  if (!brandNumber) brandNumber = `BN-${randCode}`;
  if (!brandSerial) brandSerial = `BS-${randCode}`;
  if (!brandCode) brandCode = brandName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'BRAND';

  const dup = await query(
    `SELECT id, brand_number, brand_name FROM brands WHERE lower(brand_name) = lower($1) OR (brand_number = $2 AND brand_number IS NOT NULL)`,
    [brandName, brandNumber]);
  if (dup.rows[0]) throw badRequest(`Brand "${brandName}" already exists.`, { matches: dup.rows });

  const [qrCode, imageUrl] = await Promise.all([
    generateBrandQR(brandNumber, brandName),
    fetchBrandImage(brandName),
  ]);

  const result = await withTransaction(async (client) => {
    const { rows: [brand] } = await client.query(
      `INSERT INTO brands (brand_number, brand_serial, brand_name, brand_code, manufacturer, qr_code, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [brandNumber, brandSerial, brandName, brandCode || null, manufacturer || null, qrCode, imageUrl]);

    if (Array.isArray(collectionIds) && collectionIds.length) {
      for (const cid of collectionIds) {
        await client.query(`INSERT INTO brand_collections (brand_id, collection_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [brand.id, cid]);
      }
    }
    return brand;
  });

  res.status(201).json({ data: result });
}));

r.post('/brands/:id/logo', MANAGE, upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('file is required (multipart field "file")');
  const brand = (await query(`SELECT id, logo_url FROM brands WHERE id=$1`, [req.params.id])).rows[0];
  if (!brand) throw badRequest('Brand not found');
  if (brand.logo_url) removeStored(brand.logo_url.replace('/uploads/', ''));
  const storageKey = fileStorageKey(req.file.path);
  const url = `/uploads/${storageKey}`;
  const { rows } = await query(`UPDATE brands SET logo_url=$2 WHERE id=$1 RETURNING *`, [req.params.id, url]);
  res.json({ data: rows[0] });
}));

r.patch('/brands/:id', MANAGE, ah(async (req, res) => {
  const { brandName, brandCode, manufacturer, status, logoUrl, collectionIds } = req.body || {};
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE brands SET brand_name=COALESCE($2,brand_name), brand_code=COALESCE($3,brand_code),
              manufacturer=COALESCE($4,manufacturer), status=COALESCE($5,status),
              logo_url=COALESCE($6,logo_url) WHERE id=$1 RETURNING *`,
      [req.params.id, brandName || null, brandCode || null, manufacturer || null, status || null, logoUrl || null]);
    if (!rows[0]) throw badRequest('Brand not found');

    if (Array.isArray(collectionIds)) {
      await client.query(`DELETE FROM brand_collections WHERE brand_id=$1`, [req.params.id]);
      for (const cid of collectionIds) {
        await client.query(`INSERT INTO brand_collections (brand_id, collection_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, cid]);
      }
    }
    return rows[0];
  });
  res.json({ data: result });
}));

r.delete('/brands/:id', MANAGE, ah(async (req, res) => {
  const { rowCount } = await query(`DELETE FROM brands WHERE id=$1`, [req.params.id]);
  if (!rowCount) throw badRequest('Brand not found');
  res.status(204).end();
}));

r.delete('/brands', MANAGE, ah(async (req, res) => {
  await query(`DELETE FROM supplier_brands`);
  await query(`DELETE FROM collection_brands`);
  await query(`DELETE FROM inventory_transactions`);
  await query(`DELETE FROM receipt_items`);
  await query(`DELETE FROM purchase_order_quantities`);
  await query(`DELETE FROM purchase_order_items`);
  await query(`DELETE FROM products`);
  await query(`DELETE FROM brands`);
  res.status(204).end();
}));

// ---------- PRODUCTS (§10.2 — serial generated, SKU unique RB-004) ----------
r.get('/products', VIEW, ah(async (req, res) => {
  const { sectionId, brandId, departmentId, search, status, page = 1, pageSize = 20 } = req.query;
  const clauses = []; const params = [];
  if (sectionId) { params.push(sectionId); clauses.push(`p.section_id = $${params.length}`); }
  if (brandId) { params.push(brandId); clauses.push(`p.brand_id = $${params.length}`); }
  if (departmentId) { params.push(departmentId); clauses.push(`s.department_id = $${params.length}`); }
  if (status) { params.push(status); clauses.push(`p.status = $${params.length}`); } else clauses.push(`p.status <> 'archived'`);
  if (search) { params.push(`%${search}%`); clauses.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.product_serial ILIKE $${params.length} OR b.brand_name ILIKE $${params.length})`); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const limit = Math.min(Number(pageSize) || 20, 1000);
  const offset = (Math.max(Number(page), 1) - 1) * limit;
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT p.id, p.product_serial, p.sku, p.name, p.status, p.hsn_sac,
            p.brand_id, p.section_id, p.category_id, p.purchase_price,
            b.brand_name, b.brand_number, b.manufacturer,
            s.name AS section_name, dep.name AS department_name, dep.id AS department_id,
            (SELECT pi.storage_key FROM product_images pi WHERE pi.product_id = p.id
              ORDER BY pi.is_primary DESC, pi.sort_order, pi.uploaded_at LIMIT 1) AS primary_image_key,
            (SELECT count(*)::int FROM product_images pi WHERE pi.product_id = p.id) AS image_count,
            COALESCE((SELECT json_agg(sup.company_name)
                        FROM supplier_brands sb JOIN suppliers sup ON sup.id = sb.supplier_id
                       WHERE sb.brand_id = p.brand_id), '[]') AS providers
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN sections s ON s.id = p.section_id
       JOIN departments dep ON dep.id = s.department_id
       ${where}
       ORDER BY p.name
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  // Count query only uses the filter parameters — limit/offset (last two) must be excluded.
  const { rows: [{ count }] } = await query(
    `SELECT count(*)::int AS count
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN sections s ON s.id = p.section_id
       ${where}`, params.slice(0, params.length - 2));
  res.json({ data: rows, total: count, page: Number(page), pageSize: limit });
}));

r.post('/products', MANAGE, ah(async (req, res) => {
  const { sku, name, description, brandId, sectionId, categoryId, attributes, hsnSac, taxCategory, purchasePrice, sellingPrice } = req.body || {};
  if (!sku || !name || !brandId || !sectionId) throw badRequest('sku, name, brandId, sectionId are required');
  const row = await withTransaction(async (client) => {
    const year = new Date().getFullYear();
    const { rows } = await client.query(
      `INSERT INTO products (product_serial, sku, name, description, brand_id, section_id, category_id, attributes, hsn_sac, tax_category, purchase_price, selling_price)
       VALUES ((SELECT next_number('PRD', NULL, $1)), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [year, sku, name, description || null, brandId, sectionId, categoryId || null,
       attributes ? JSON.stringify(attributes) : '{}', hsnSac || null, taxCategory || null,
       purchasePrice || null, sellingPrice || null]);
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'product', entityId: rows[0].id, afterValue: { sku, name } });
    return rows[0];
  });
  res.status(201).json({ data: row });
}));

r.patch('/products/:id', MANAGE, ah(async (req, res) => {
  const { name, description, categoryId, attributes, hsnSac, status } = req.body || {};
  const { rows } = await query(
    `UPDATE products SET name=COALESCE($2,name), description=COALESCE($3,description),
            category_id=COALESCE($4,category_id), attributes=COALESCE($5,attributes),
            hsn_sac=COALESCE($6,hsn_sac), status=COALESCE($7,status) WHERE id=$1 RETURNING *`,
    [req.params.id, name || null, description || null, categoryId || null,
     attributes ? JSON.stringify(attributes) : null, hsnSac || null, status || null]);
  if (!rows[0]) throw badRequest('Product not found');
  res.json({ data: rows[0] });
}));

// ---------- SUPPLIERS / DEALERS (§11.1 + §11.2 ledger) ----------
r.get('/suppliers', VIEW, ah(async (req, res) => {
  const { search, divisionId, status } = req.query;
  const clauses = []; const params = [];
  if (status) { params.push(status); clauses.push(`s.status = $${params.length}`); } else clauses.push(`s.status <> 'archived'`);
  if (search) { params.push(`%${search}%`); clauses.push(`(s.company_name ILIKE $${params.length} OR s.code ILIKE $${params.length} OR s.gstin ILIKE $${params.length})`); }
  if (divisionId) { params.push(divisionId); clauses.push(`EXISTS (SELECT 1 FROM supplier_divisions sd WHERE sd.supplier_id = s.id AND sd.division_id = $${params.length})`); }
  else if (!req.user.isSuperAdmin) { params.push(req.user.divisionIds); clauses.push(`EXISTS (SELECT 1 FROM supplier_divisions sd WHERE sd.supplier_id = s.id AND sd.division_id = ANY($${params.length}::uuid[]))`); }
  const { rows } = await query(
    `SELECT s.*, COALESCE((SELECT json_agg(d.id) FROM supplier_divisions sd JOIN divisions d ON d.id = sd.division_id WHERE sd.supplier_id = s.id), '[]') AS division_ids
       FROM suppliers s ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY s.company_name`, params);
  res.json({ data: rows });
}));

r.post('/suppliers', MANAGE, ah(async (req, res) => {
  const { code, companyName, contactPerson, mobile, email, address, gstin, pan, paymentTerms, divisionIds = [], notes } = req.body || {};
  if (!code || !companyName) throw badRequest('code and companyName are required');
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO suppliers (code, company_name, contact_person, mobile, email, address, gstin, pan, payment_terms, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [code, companyName, contactPerson || null, mobile || null, email || null, address || null, gstin || null, pan || null, paymentTerms || 'net_30', notes || null]);
    for (const d of divisionIds) {
      await client.query(`INSERT INTO supplier_divisions (supplier_id, division_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [rows[0].id, d]);
    }
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'create', entityType: 'supplier', entityId: rows[0].id, afterValue: rows[0] });
    return rows[0];
  });
  res.status(201).json({ data: row });
}));

r.patch('/suppliers/:id', MANAGE, ah(async (req, res) => {
  const { companyName, contactPerson, mobile, email, address, gstin, pan, paymentTerms, divisionIds, status, notes } = req.body || {};
  const before = (await query(`SELECT * FROM suppliers WHERE id=$1`, [req.params.id])).rows[0];
  if (!before) throw badRequest('Supplier not found');
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE suppliers SET company_name=COALESCE($2,company_name), contact_person=COALESCE($3,contact_person),
              mobile=COALESCE($4,mobile), email=COALESCE($5,email), address=COALESCE($6,address),
              gstin=COALESCE($7,gstin), pan=COALESCE($8,pan), payment_terms=COALESCE($9,payment_terms),
              status=COALESCE($10,status), notes=COALESCE($11,notes)
       WHERE id=$1 RETURNING *`,
      [req.params.id, companyName || null, contactPerson || null, mobile || null, email || null, address || null,
       gstin || null, pan || null, paymentTerms || null, status || null, notes || null]);
    if (divisionIds) {
      await client.query(`DELETE FROM supplier_divisions WHERE supplier_id=$1`, [req.params.id]);
      for (const d of divisionIds) {
        await client.query(`INSERT INTO supplier_divisions (supplier_id, division_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, d]);
      }
    }
    await logAudit(client, { userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit', entityType: 'supplier', entityId: req.params.id, beforeValue: before, afterValue: rows[0] });
    return rows[0];
  });
  res.json({ data: row });
}));

// GET /api/suppliers/:id/history — dealer ledger (§11.2)
r.get('/suppliers/:id/history', VIEW, ah(async (req, res) => {
  const { id } = req.params;
  const { rows: [ledger] } = await query(
    `SELECT count(*) AS total_pos,
            COALESCE(SUM(grand_total), 0) AS total_ordered_value,
            COALESCE(SUM(CASE WHEN status IN ('partially_received','received','closed') THEN grand_total ELSE 0 END), 0) AS received_value
       FROM purchase_orders WHERE supplier_id = $1`, [id]);
  const { rows: history } = await query(
    `SELECT po.id, po.po_number, po.po_date, po.status, po.grand_total, d.name AS division_name
       FROM purchase_orders po JOIN divisions d ON d.id = po.division_id
      WHERE po.supplier_id = $1 ORDER BY po.po_date DESC LIMIT 100`, [id]);
  res.json({ ledger, history });
}));

export default r;
