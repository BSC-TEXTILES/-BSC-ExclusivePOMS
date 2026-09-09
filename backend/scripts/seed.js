// Seed script — FRS §7 master data, §8.1 section catalogue, §9 sizes/colours,
// §14 approval thresholds, §6.1 roles, §11.1 suppliers, plus demo users.
// Idempotent: safe to run repeatedly (ON CONFLICT DO NOTHING / existence checks).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/config/db.js';
import { selfTest } from '../src/utils/pricing.js';
import { scaleCatalogue, seedChat } from './seed-catalogue.js';

selfTest();
console.log('✔ Pricing engine self-test passed (FRS §13.3 worked example: ₹65,520.00)');

async function main() {
  // ---------- Permissions (module:action codes) ----------
  const PERMISSIONS = [
    ['masters.view', 'masters', 'View master data'],
    ['masters.manage', 'masters', 'Create/edit/activate/archive master data'],
    ['po.view', 'purchase_order', 'View purchase orders (scope-limited)'],
    ['po.create', 'purchase_order', 'Create draft POs'],
    ['po.edit', 'purchase_order', 'Edit draft POs'],
    ['po.submit', 'purchase_order', 'Submit POs for approval'],
    ['po.amend', 'purchase_order', 'Amend approved/issued POs (version event)'],
    ['po.issue', 'purchase_order', 'Issue approved POs'],
    ['po.close', 'purchase_order', 'Close POs'],
    ['po.commercial.override', 'purchase_order', 'Override margin/discount policy with justification (RB-009/RB-010)'],
    ['approvals.view', 'approval', 'View approval queue'],
    ['approvals.act', 'approval', 'Approve/reject/send-back/hold/escalate'],
    ['receipt.view', 'receipt', 'View receipts'],
    ['receipt.create', 'receipt', 'Create and post receipts'],
    ['inventory.view', 'inventory', 'View inventory balances and transactions'],
    ['reports.view', 'report', 'View dashboards and reports'],
    ['audit.view', 'audit', 'View immutable audit trail'],
    ['users.manage', 'user', 'Manage users, roles and division scope'],
    ['settings.manage', 'settings', 'Manage system settings'],
  ];
  for (const [code, module, description] of PERMISSIONS) {
    await query(`INSERT INTO permissions (code, module, description) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING`, [code, module, description]);
  }
  const ALL_PERMS = (await query(`SELECT id FROM permissions`)).rows.map((r) => r.id);

  // ---------- Roles (§6.1) ----------
  const ROLES = [
    ['super_admin', 'Super Admin'],
    ['domain_admin', 'Domain Admin'],
    ['purchase_manager', 'Purchase Manager'],
    ['purchase_executive', 'Purchase Executive'],
    ['approver', 'Approver'],
    ['receiving_user', 'Receiving User'],
    ['viewer', 'Viewer'],
    ['auditor', 'Auditor'],
    ['division_supervisor', 'Division Supervisor'],
  ];
  for (const [code, name] of ROLES) {
    await query(`INSERT INTO roles (code, name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`, [code, name]);
  }

  const ROLE_PERMS = {
    super_admin: ALL_PERMS,
    domain_admin: ['masters.view', 'masters.manage', 'po.view', 'po.create', 'po.edit', 'po.submit', 'po.amend', 'po.issue', 'po.close', 'po.commercial.override', 'approvals.view', 'approvals.act', 'receipt.view', 'receipt.create', 'inventory.view', 'reports.view', 'audit.view'],
    purchase_manager: ['masters.view', 'po.view', 'po.create', 'po.edit', 'po.submit', 'po.amend', 'po.issue', 'po.close', 'po.commercial.override', 'approvals.view', 'approvals.act', 'reports.view'],
    purchase_executive: ['masters.view', 'po.view', 'po.create', 'po.edit', 'po.submit'],
    approver: ['po.view', 'approvals.view', 'approvals.act'],
    receiving_user: ['po.view', 'receipt.view', 'receipt.create', 'inventory.view'],
    viewer: ['po.view', 'reports.view', 'inventory.view'],
    // Division Supervisor: strictly read-only, section-scoped (Men's section only
    // in the demo seed). Can browse the catalogue (read-only) and view PO
    // details and the restricted summary — no create/edit/submit/approve
    // rights at all (RB-001 / RB-018).
    division_supervisor: ['masters.view', 'po.view', 'reports.view'],
    auditor: ['po.view', 'audit.view', 'reports.view'],
  };
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMS)) {
    for (const code of permCodes) {
      await query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r, permissions p WHERE r.code=$1 AND p.code=$2
         ON CONFLICT DO NOTHING`, [roleCode, code]);
    }
  }
  console.log('✔ Roles, permissions and role-permission grants seeded');

  // ---------- Organization + divisions (§5) ----------
  await query(`INSERT INTO organizations (name) SELECT 'BSC Exclusive' WHERE NOT EXISTS (SELECT 1 FROM organizations)`);
  const orgId = (await query(`SELECT id FROM organizations LIMIT 1`)).rows[0].id;
  for (const [code, name, location] of [
    ['DVG', 'Davanagere', 'Davanagere'],
    ['SMG', 'Shivamogga', 'Shivamogga'],
    ['BLG', 'Belagavi', 'Belagavi'],
  ]) {
    await query(
      `INSERT INTO divisions (org_id, code, name, location) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO NOTHING`, [orgId, code, name, location]);
  }
  const divisions = Object.fromEntries((await query(`SELECT id, code FROM divisions`)).rows.map((d) => [d.code, d.id]));

  // ---------- Departments (§5/§7 — global) ----------
  for (const [code, name] of [
    ['MEN', "Men's Wear"], ['WOMEN', "Women's Wear"], ['KIDS', 'Kids'], ['HOME', 'Home & Lifestyle'],
  ]) {
    await query(
      `INSERT INTO departments (code, name, division_id, is_global) VALUES ($1,$2,NULL,true)
       ON CONFLICT (division_id, code) DO NOTHING`, [code, name]);
  }
  const departments = Object.fromEntries((await query(`SELECT id, code FROM departments`)).rows.map((d) => [d.code, d.id]));

  // ---------- Size methods + sizes (§9.1) ----------
  for (const [code, name] of [
    ['standard_apparel', 'Standard Apparel'], ['numeric_waist', 'Numeric Waist'],
    ['free_size', 'Free Size'], ['age_group', 'Age Group'],
    ['footwear_uk', 'Footwear UK'], ['custom', 'Custom'],
  ]) {
    await query(`INSERT INTO size_methods (code, name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`, [code, name]);
  }
  const methods = Object.fromEntries((await query(`SELECT id, code FROM size_methods`)).rows.map((m) => [m.code, m.id]));

  const SIZES = {
    standard_apparel: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    numeric_waist: ['28', '30', '32', '34', '36', '38', '40', '42', '44'],
    free_size: ['Free Size'],
    age_group: ['0-2 Yrs', '2-4 Yrs', '4-6 Yrs', '6-8 Yrs', '8-10 Yrs', '10-12 Yrs', '12-14 Yrs', '14-16 Yrs'],
    footwear_uk: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
    custom: ['Single', 'Set of 2', 'Set of 4', 'Set of 6', 'Custom'],
  };
  for (const [methodCode, labels] of Object.entries(SIZES)) {
    for (let i = 0; i < labels.length; i++) {
      const numeric = /^\d+$/.test(labels[i]) ? Number(labels[i]) : null;
      await query(
        `INSERT INTO sizes (size_method_id, label, numeric_value, display_order) VALUES ($1,$2,$3,$4)
         ON CONFLICT (size_method_id, label) DO NOTHING`,
        [methods[methodCode], labels[i], numeric, i]);
    }
  }
  console.log('✔ Size methods and size sets seeded');

  // ---------- Colours (§9.2) ----------
  const COLOURS = [
    ['NAVY-BLUE', 'Navy Blue', 'Blue', '#1B2A4A'], ['BLACK', 'Black', 'Black', '#111111'],
    ['WHITE', 'White', 'White', '#F5F5F5'], ['MAROON', 'Maroon', 'Red', '#5E1224'],
    ['RED', 'Red', 'Red', '#C62828'], ['GREEN', 'Green', 'Green', '#1B5E20'],
    ['BEIGE', 'Beige', 'Neutral', '#D9C7A7'], ['GREY', 'Grey', 'Neutral', '#757575'],
    ['GOLD', 'Gold', 'Metallic', '#C9A227'], ['MULTI', 'Multicolour', 'Multi', null],
  ];
  for (const [code, name, family, hex] of COLOURS) {
    await query(
      `INSERT INTO colours (code, name, colour_family, swatch_hex) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO NOTHING`, [code, name, family, hex]);
  }

  // ---------- Sections (§8.1 initial catalogue + furniture §8.3 + toys) ----------
  const SECTIONS = [
    ['MEN-SHIRTS', "Men's Shirts", 'MEN', 'standard_apparel', 1],
    ['MEN-TROUSERS', "Men's Trousers & Jeans", 'MEN', 'numeric_waist', 2],
    ['MEN-TSHIRTS', "Men's T-Shirts", 'MEN', 'standard_apparel', 3],
    ['MEN-ETHNIC', "Men's Ethnic Wear (Kurta/Sherwani)", 'MEN', 'standard_apparel', 4],
    ['MEN-INNERWEAR', "Men's Innerwear", 'MEN', 'standard_apparel', 5],
    ['FOOTWEAR-M', "Footwear — Men", 'MEN', 'footwear_uk', 6],
    ['WOM-SAREES', "Women's Sarees", 'WOMEN', 'free_size', 10],
    ['WOM-KURTIS', "Women's Kurtis & Salwar Sets", 'WOMEN', 'standard_apparel', 11],
    ['WOM-WESTERN', "Women's Western Wear", 'WOMEN', 'standard_apparel', 12],
    ['WOM-BLOUSE', "Women's Ethnic / Blouse Fabric", 'WOMEN', 'free_size', 13],
    ['WOM-INNERWEAR', "Women's Innerwear", 'WOMEN', 'standard_apparel', 14],
    ['JWL-FASHION', 'Jewellery — Fashion / Artificial', 'WOMEN', 'free_size', 15],
    ['JWL-BANGLES', 'Jewellery — Bangles & Sets', 'WOMEN', 'custom', 16],
    ['FOOTWEAR-W', 'Footwear — Women', 'WOMEN', 'footwear_uk', 17],
    ['ACCESSORIES', 'Accessories (Belts, Bags, Watches)', 'WOMEN', 'custom', 18],
    ['KIDS-BOYS', 'Kids Boys Wear', 'KIDS', 'age_group', 20],
    ['KIDS-GIRLS', 'Kids Girls Wear', 'KIDS', 'age_group', 21],
    ['KIDS-INFANT', 'Kids Infant Wear', 'KIDS', 'age_group', 22],
    ['KIDS-TOYS', 'Toys & Games', 'KIDS', 'age_group', 23],
    ['HOME-FURN', 'Home Furnishing (Textiles & Decor)', 'HOME', 'custom', 30],
    ['FURNITURE', 'Furniture & Home Interiors', 'HOME', 'custom', 31],
  ];
  for (const [code, name, deptCode, methodCode, order] of SECTIONS) {
    await query(
      `INSERT INTO sections (code, name, department_id, parent_group, sizing_method_id, display_order)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (department_id, code) DO NOTHING`,
      [code, name, departments[deptCode], { MEN: "Men's Wear", WOMEN: "Women's Wear", KIDS: 'Kids', HOME: 'Home & Lifestyle' }[deptCode], methods[methodCode], order]);
  }
  console.log(`✔ ${SECTIONS.length} sections seeded (§8.1 + furniture §8.3 + toys)`);

  // Load sections map for user-section assignments
  const sections = Object.fromEntries((await query(`SELECT id, code FROM sections`)).rows.map((s) => [s.code, s.id]));

  // ---------- Sample brands + products (§10) ----------
  const BRANDS = [
    ['BN-1001', 'BSR-1001', "Levi's", 'LVS', "Levi Strauss & Co."],
    ['BN-1002', 'BSR-1002', 'Raymond', 'RYM', 'Raymond Group'],
    ['BN-1003', 'BSR-1003', 'Pachaiyappa Silks', 'PCH', 'Sri Pachaiyappa Silks'],
    ['BN-1004', 'BSR-1004', 'BSC Home Collection', 'BSCH', 'B.S. Channabasappa & Sons'],
  ];
  for (const [num, serial, name, code, mfr] of BRANDS) {
    await query(
      `INSERT INTO brands (brand_number, brand_serial, brand_name, brand_code, manufacturer)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (brand_number) DO NOTHING`, [num, serial, name, code, mfr]);
  }
  const brands = Object.fromEntries((await query(`SELECT id, brand_name FROM brands`)).rows.map((b) => [b.brand_name, b.id]));

  const PRODUCTS = [
    ['PRD-00001', 'LVS-FS-001', "Levi's Men's Formal Shirt", brands["Levi's"], 'MEN-SHIRTS'],
    ['PRD-00002', 'RYM-TR-001', 'Raymond Super 150s Menino Trouser', brands['Raymond'], 'MEN-TROUSERS'],
    ['PRD-00003', 'PCH-KS-001', 'Kanjivaram Zari Gold Bridal Saree', brands['Pachaiyappa Silks'], 'WOM-SAREES'],
    ['PRD-00004', 'BSC-TL-001', 'Teak Living Set — Handcrafted (6-Seat)', brands['BSC Home Collection'], 'FURNITURE'],
    ['PRD-00005', 'BSC-BD-001', 'Queen Bed — Sheesham Wood with Storage', brands['BSC Home Collection'], 'FURNITURE'],
  ];
  for (const [serial, sku, name, brandId, sectionCode] of PRODUCTS) {
    await query(
      `INSERT INTO products (product_serial, sku, name, brand_id, section_id)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (product_serial) DO NOTHING`, [serial, sku, name, brandId, sections[sectionCode]]);
  }

  // ---------- Suppliers (§11.1) ----------
  const SUPPLIERS = [
    ['SUP-001', 'Sri Pachaiyappa Silks Ltd', 'R. Meenakshi Sundaram', '33AAHCS2918K1Z5', 'net_30'],
    ['SUP-002', 'Raymond Heritage Textiles', 'A. Kuruvilla', '27AAACR1092P1ZV', 'net_60'],
    ['SUP-003', 'Malabar Atelier Crafts LLP', 'F. Rahman', '32AABFM9812A1ZQ', 'against_delivery'],
  ];
  for (const [code, company, person, gstin, terms] of SUPPLIERS) {
    await query(
      `INSERT INTO suppliers (code, company_name, contact_person, gstin, payment_terms)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING`, [code, company, person, gstin, terms]);
    const supId = (await query(`SELECT id FROM suppliers WHERE code=$1`, [code])).rows[0].id;
    for (const divId of Object.values(divisions)) {
      await query(`INSERT INTO supplier_divisions (supplier_id, division_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [supId, divId]);
    }
  }
  console.log('✔ Brands, products and suppliers seeded');

  // ---------- Approval rules (§14 example thresholds — configurable) ----------
  const rulesExist = (await query(`SELECT 1 FROM approval_rules LIMIT 1`)).rows.length > 0;
  if (!rulesExist) {
    const domainAdmin = (await query(`SELECT id FROM roles WHERE code='domain_admin'`)).rows[0].id;
    const purchaseMgr = (await query(`SELECT id FROM roles WHERE code='purchase_manager'`)).rows[0].id;
    const superAdmin = (await query(`SELECT id FROM roles WHERE code='super_admin'`)).rows[0].id;

    const { rows: [r1] } = await query(
      `INSERT INTO approval_rules (name, priority, min_value, max_value) VALUES ('Tier 1: Admin (≤ ₹25,000)', 10, 0, 25000) RETURNING id`);
    await query(`INSERT INTO approval_levels (rule_id, level_no, approver_role_id) VALUES ($1,1,$2)`, [r1.id, domainAdmin]);

    const { rows: [r2] } = await query(
      `INSERT INTO approval_rules (name, priority, min_value, max_value) VALUES ('Tier 2: Division Manager (₹25,001–₹1,00,000)', 10, 25000.01, 100000) RETURNING id`);
    await query(`INSERT INTO approval_levels (rule_id, level_no, approver_role_id) VALUES ($1,1,$2)`, [r2.id, purchaseMgr]);

    const { rows: [r3] } = await query(
      `INSERT INTO approval_rules (name, priority, min_value, max_value) VALUES ('Tier 3: Enterprise (> ₹1,00,000)', 10, 100000.01, NULL) RETURNING id`);
    await query(`INSERT INTO approval_levels (rule_id, level_no, approver_role_id) VALUES ($1,1,$2), ($1,2,$3)`, [r3.id, purchaseMgr, superAdmin]);
    console.log('✔ Approval rules seeded (₹25k / ₹1L thresholds, §14)');
  }

  // ---------- Settings ----------
  const SETTINGS = [
    ['gst_percent', 18, 'Default GST percent applied to taxable base (§13.2)'],
    ['max_discount_percent', 15, 'RB-009: discount above this needs exception approval'],
    ['max_margin_percent', 60, 'RB-010: margin above this needs override permission'],
    ['po_auto_close_on_full_receipt', false, 'Auto-move PO to closed when fully received (§31.1)'],
  ];
  for (const [key, value, description] of SETTINGS) {
    await query(
      `INSERT INTO settings (key, value, description) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO NOTHING`, [key, JSON.stringify(value), description]);
  }

  // ---------- Users (§6.1 demo accounts) ----------
  const USERS = [
    ['admin@bsc.local', 'admin', 'Rajeshwar V. Rao', ['super_admin'], ['DVG', 'SMG', 'BLG'], [], 'Admin@123'],
    ['dvg.admin@bsc.local', 'dvg.admin', 'Davanagere Domain Admin', ['domain_admin'], ['DVG'], [], 'Admin@123'],
    ['pm.dvg@bsc.local', 'pm.dvg', 'Davanagere Purchase Manager', ['purchase_manager'], ['DVG'], [], 'PM@12345'],
    ['buyer.dvg@bsc.local', 'buyer.dvg', 'Davanagere Purchase Executive', ['purchase_executive'], ['DVG'], [], 'PE@12345'],
    ['approver.dvg@bsc.local', 'approver.dvg', 'Davanagere Approver', ['approver'], ['DVG'], [], 'AP@12345'],
    ['receiver.dvg@bsc.local', 'receiver.dvg', 'Davanagere Receiving User', ['receiving_user'], ['DVG'], [], 'RC@12345'],
    ['viewer@bsc.local', 'viewer', 'Enterprise Viewer', ['viewer'], ['DVG', 'SMG', 'BLG'], [], 'VW@12345'],
    ['auditor@bsc.local', 'auditor', 'Enterprise Auditor', ['auditor'], ['DVG', 'SMG', 'BLG'], [], 'AU@12345'],
    ['sureshmen', 'sureshmen', 'Suresh Men', ['purchase_executive'], ['DVG'], ['MEN-SHIRTS'], 'Buyer@12345'],
    ['men.supervisor@bsc.local', 'men.supervisor', "Men's Section Division Supervisor", ['division_supervisor'], ['DVG'], ['MEN-SHIRTS', 'MEN-TROUSERS', 'MEN-TSHIRTS', 'MEN-ETHNIC', 'MEN-INNERWEAR', 'FOOTWEAR-M'], 'DS@12345'],
  ];
  for (const [email, username, fullName, roleCodes, divCodes, secCodes, password] of USERS) {
    const { rows } = await query(
      `INSERT INTO users (email, username, password_hash, full_name)
       VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING id`,
      [email, username, await bcrypt.hash(password, 10), fullName]);
    if (!rows.length) continue;
    const uid = rows[0].id;
    for (const rc of roleCodes) {
      await query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code=$2`, [uid, rc]);
    }
    for (const dc of divCodes) {
      await query(`INSERT INTO user_divisions (user_id, division_id) VALUES ($1,$2)`, [uid, divisions[dc]]);
    }
    for (const sc of secCodes) {
      await query(`INSERT INTO user_sections (user_id, section_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [uid, sections[sc]]);
    }
  }
  // ---------- SCALE-UP: 30+ brands with providers, 1000+ products, team chat ----------
  await scaleCatalogue();
  await seedChat();

  console.log('✔ Users seeded');

  console.log('\n=== Seed complete — demo accounts (dev only) ===');
  for (const [email, , , , , password] of USERS) {
    console.log(`  ${email.padEnd(28)} ${password}`);
  }
  console.log('\nSuper Admin can create further users, sections and rules from the UI (no code changes — §7).');
}

main()
  .then(() => pool.end())
  .catch((e) => { console.error('Seed failed:', e); pool.end(); process.exit(1); });
