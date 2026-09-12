// Import processor — mapping, validation, and transactional execution for the
// Product catalogue import. No product row is ever written during upload/preview;
// execution only happens after the admin explicitly confirms (and the backend
// re-validates everything at that point).

import {
  mapField, productFieldOptions, defaultMappingFromHeaders,
  normalizeTax, parsePrice, normalizeStatus, normKey,
} from './importMapping.js';

// Load reference lookups (brand/section/category) for name->id resolution.
async function loadRefs(db) {
  const brands = (await db.query(
    `SELECT id, brand_name, brand_code, brand_number FROM brands WHERE status <> 'archived'`)).rows;
  const sections = (await db.query(
    `SELECT s.id, s.name, s.code, s.department_id, d.name AS department_name
       FROM sections s JOIN departments d ON d.id = s.department_id
      WHERE s.status <> 'archived'`)).rows;
  const categories = (await db.query(
    `SELECT id, name, code, section_id, parent_category_id FROM categories WHERE status <> 'archived'`)).rows;
  const brandIndex = {};
  for (const b of brands) {
    brandIndex[String(b.brand_name || '').trim().toLowerCase()] = b;
    if (b.brand_code) brandIndex[String(b.brand_code).trim().toLowerCase()] = b;
    if (b.brand_number) brandIndex[String(b.brand_number).trim().toLowerCase()] = b;
  }
  const sectionIndex = {};
  for (const s of sections) {
    sectionIndex[String(s.name || '').trim().toLowerCase()] = s;
    if (s.code) sectionIndex[String(s.code).trim().toLowerCase()] = s;
    if (s.department_name) sectionIndex[String(s.department_name).trim().toLowerCase()] = s;
  }
  const categoryIndex = {};
  for (const c of categories) {
    categoryIndex[String(c.name || '').trim().toLowerCase()] = c;
    if (c.code) categoryIndex[String(c.code).trim().toLowerCase()] = c;
  }
  return { brandIndex, sectionIndex, categoryIndex };
}

function cleanVal(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  return String(v).trim();
}

// Resolve one record against the mapping + refs -> { mapped, errors, warnings }.
function mapRecord(raw, mapping, refs) {
  const mapped = {};
  const errors = [];
  const warnings = [];
  for (const [fieldKey, header] of Object.entries(mapping)) {
    const val = cleanVal(raw[header]);
    if (val === '') continue;
    switch (fieldKey) {
      case 'sku': mapped.sku = String(val); break;
      case 'name': mapped.name = String(val); break;
      case 'hsn': mapped.hsn_sac = String(val).trim(); break;
      case 'barcode': mapped.barcode = String(val).trim(); break;
      case 'internalRef': mapped.internal_ref = String(val).trim(); break;
      case 'material': mapped.material = String(val).trim(); break;
      case 'collection': mapped.collection = String(val).trim().toLowerCase().replace(/\s+/g, '_'); break;
      case 'gender': {
        const g = String(val).toLowerCase();
        mapped.gender = (g.startsWith('w') || g.startsWith('f')) ? 'women' : (g.startsWith('k') ? 'kids' : 'men');
        break;
      }
      case 'purchasePrice': {
        const p = parsePrice(val);
        if (p === null) errors.push('Purchase price must be a number');
        else mapped.purchase_price = p;
        break;
      }
      case 'sellingPrice': {
        const p = parsePrice(val);
        if (p === null) errors.push('Selling price must be a number');
        else mapped.selling_price = p;
        break;
      }
      case 'taxCategory': {
        const t = normalizeTax(val);
        if (t) mapped.tax_category = t;
        else { mapped.tax_category = null; warnings.push(`Tax category "${val}" is unknown - left blank (not guessed).`); }
        break;
      }
      case 'brand': {
        const b = refs.brandIndex[String(val).trim().toLowerCase()];
        if (b) mapped.brand_id = b.id;
        else { mapped.brand_label = String(val); errors.push(`Brand "${val}" was not found in the catalogue.`); }
        break;
      }
      case 'section': {
        const s = refs.sectionIndex[String(val).trim().toLowerCase()];
        if (s) { mapped.section_id = s.id; mapped.department_id = s.department_id; }
        else { mapped.section_label = String(val); errors.push(`Collection/Section "${val}" was not found. Create it in Master Data first, or use an existing section name/code.`); }
        break;
      }
      case 'category': {
        const c = refs.categoryIndex[String(val).trim().toLowerCase()];
        if (c) mapped.category_id = c.id;
        else { mapped.category_label = String(val); warnings.push(`Category "${val}" not found - left unassigned (not guessed).`); }
        break;
      }
      default: break;
    }
  }

  // Required fields
  if (!mapped.sku || !String(mapped.sku).trim()) errors.push('SKU is required');
  if (!mapped.name) errors.push('Product name is required');
  if (!mapped.brand_id) errors.push('A valid brand is required');
  if (!mapped.section_id) errors.push('A valid collection/section is required');
  return { mapped, errors, warnings };
}

// Build preview records (no DB write) for a set of sheets.
export async function stageSheets(db, sheets, mapping) {
  const refs = await loadRefs(db);
  const records = [];
  const seen = new Set();
  const summary = { total: 0, create: 0, update: 0, duplicate: 0, invalid: 0, needs_review: 0, warningRows: 0, unmappedHeaders: [] };
  const sheetDefs = sheets;
  let mappingUsed = mapping;
  for (const sheet of sheetDefs) {
    let idx = sheet.pdf ? 0 : 1;
    if (!sheet.pdf && (!mappingUsed || Object.keys(mappingUsed).length === 0)) {
      mappingUsed = defaultMappingFromHeaders(sheet.headers);
    }
    for (const raw of sheet.rows) {
      idx++;
      if (sheet.pdf && !raw) continue;
      if (Object.values(raw).every((v) => String(v || '').trim() === '')) continue;
      const rec = { rowIndex: idx, sheet: sheet.name, extracted: raw, mapped: {}, warnings: [], errors: [], action: 'needs_review' };
      const { mapped, errors, warnings } = mapRecord(raw, mappingUsed, refs);
      rec.mapped = mapped; rec.warnings = warnings; rec.errors = errors;
      if (errors.length) { rec.action = 'invalid'; summary.invalid++; records.push(rec); continue; }
      const key = normKey(mapped.sku);
      if (seen.has(key)) { rec.action = 'duplicate'; summary.duplicate++; records.push(rec); continue; }
      seen.add(key);
      const existing = (await db.query('SELECT id FROM products WHERE sku ILIKE $1 LIMIT 1', [mapped.sku])).rows[0];
      if (existing) { rec.action = 'update'; rec.existingId = existing.id; summary.update++; }
      else { rec.action = 'create'; summary.create++; }
      if (sheet.pdf) { rec.needsReview = true; summary.needs_review++; }
      if (warnings.length) summary.warningRows++;
      records.push(rec);
    }
  }
  summary.total = records.length;
  // report headers that could not be mapped to any project field
  if (sheetDefs.length && !sheetDefs[0].pdf) {
    const mappedHeaders = new Set(Object.values(mappingUsed).map((h) => String(h).toLowerCase().trim()));
    for (const sheet of sheetDefs) {
      for (const h of sheet.headers) {
        const hl = String(h || '').toLowerCase().trim();
        if (hl && !mappedHeaders.has(hl) && mapField(h) === null) summary.unmappedHeaders.push(h);
      }
    }
    summary.unmappedHeaders = [...new Set(summary.unmappedHeaders)];
  }
  return { records, summary, mapping: mappingUsed, fields: productFieldOptions(), info: 'product' };
}

// Map staged records into a display-friendly preview payload.
export function buildPreviewPayload(records, mapping, summary, fileMeta, fields) {
  const headers = Object.keys(mapping || {});
  return {
    file: fileMeta,
    mapping,
    fields,
    summary,
    headers,
    records: records.map((r) => ({
      rowIndex: r.rowIndex,
      sheet: r.sheet,
      action: r.action,
      needsReview: !!r.needsReview,
      mapped: r.mapped,
      extracted: r.extracted,
      warnings: r.warnings,
      errors: r.errors,
    })),
  };
}

export { mapField, productFieldOptions, defaultMappingFromHeaders, normKey, parsePrice, normalizeStatus };

// ── transactional execution ────────────────────────────────────────────────

export async function executeImport(db, importId, records) {
  const out = { imported: 0, updated: 0, failed: 0, perRow: [] };
  const client = await db;
  await client.query('BEGIN');
  try {
    for (const rec of records) {
      const row = {
        rowIndex: rec.rowIndex, sheet: rec.sheet, action: rec.action,
        operation: null, warnings: rec.warnings || [], errors: rec.errors || [],
        mapped: rec.mapped,
      };
      try {
        if (rec.action === 'invalid' || rec.action === 'duplicate' || rec.action === 'skipped') {
          row.operation = rec.action;
          out.failed++;
          out.perRow.push(row);
          continue;
        }
        if (!rec.mapped || !rec.mapped.sku) {
          row.operation = 'invalid';
          row.errors = ['SKU missing — cannot save'];
          out.failed++;
          out.perRow.push(row);
          continue;
        }

        const mapped = {
          sku: rec.mapped.sku,
          name: rec.mapped.name || rec.mapped.sku,
          brand_id: rec.mapped.brand_id || null,
          section_id: rec.mapped.section_id || null,
          category_id: rec.mapped.category_id || null,
          hsn_sac: rec.mapped.hsn_sac || null,
          tax_category: rec.mapped.tax_category || null,
          purchase_price: rec.mapped.purchase_price ?? null,
          selling_price: rec.mapped.selling_price ?? null,
          barcode: rec.mapped.barcode || null,
          internal_ref: rec.mapped.internal_ref || null,
          material: rec.mapped.material || null,
          collection: rec.mapped.collection || null,
          gender: rec.mapped.gender || null,
          status: rec.mapped.status || 'active',
          attributes: {},
          created_by: rec.existingId ? null : client.userId,
          updated_by: client.userId,
        };

        if (rec.action === 'update' && rec.existingId) {
          const { rows } = await client.query(
            `UPDATE products SET name=$2, brand_id=$3, section_id=$4, category_id=$5,
              hsn_sac=$6, tax_category=$7, purchase_price=$8, selling_price=$9,
              barcode=$10, internal_ref=$11, material=$12, collection=$13, gender=$14, status=$15,
              updated_by=$16, updated_at=now()
             WHERE id=$1 RETURNING id`, [
              rec.existingId,
              mapped.name, mapped.brand_id, mapped.section_id, mapped.category_id,
              mapped.hsn_sac, mapped.tax_category, mapped.purchase_price, mapped.selling_price,
              mapped.barcode, mapped.internal_ref, mapped.material, mapped.collection,
              mapped.gender, mapped.status,
              mapped.updated_by,
            ]);
          if (rows[0]) {
            row.operation = 'update';
            out.updated++;
          } else throw new Error('Existing product row not found at update time');
        } else {
          const { rows } = await client.query(
            `INSERT INTO products (sku, name, brand_id, section_id, category_id, hsn_sac, tax_category,
              purchase_price, selling_price, barcode, internal_ref, material, collection, gender, status,
              attributes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             ON CONFLICT (sku) DO UPDATE SET
               name=excluded.name, brand_id=excluded.brand_id, section_id=excluded.section_id,
               category_id=excluded.category_id, hsn_sac=excluded.hsn_sac, tax_category=excluded.tax_category,
               purchase_price=excluded.purchase_price, selling_price=excluded.selling_price,
               barcode=excluded.barcode, internal_ref=excluded.internal_ref,
               material=excluded.material, collection=excluded.collection, gender=excluded.gender,
               status=excluded.status, updated_by=$17, updated_at=now()
             RETURNING id`, [
              mapped.sku, mapped.name, mapped.brand_id, mapped.section_id, mapped.category_id,
              mapped.hsn_sac, mapped.tax_category, mapped.purchase_price, mapped.selling_price,
              mapped.barcode, mapped.internal_ref, mapped.material, mapped.collection,
              mapped.gender, mapped.status,
              JSON.stringify(mapped.attributes), mapped.created_by,
            ]);
          if (rows[0]) {
            row.operation = 'create';
            out.imported++;
          } else throw new Error('Insert/conflict returned no row');
        }
        out.perRow.push(row);
      } catch (e) {
        row.operation = 'failed';
        row.errors = [e.message];
        out.failed++;
        out.perRow.push(row);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return out;
}

// ── cleanup ────────────────────────────────────────────────────────────────

export function cleanupTemp(storageKey) {
  if (!storageKey) return;
  import('./storage.js').then(({ removeStored }) => removeStored(storageKey)).catch(() => { /* best effort */ });
}
