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
    ['order.create', 'order', 'Create customer orders'],
    ['order.read', 'order', 'View customer orders'],
    ['order.update', 'order', 'Update customer orders'],
    ['order.delete', 'order', 'Delete customer orders'],
    ['order.approve', 'order', 'Approve customer orders'],
    ['order.cancel', 'order', 'Cancel customer orders'],
    ['order.assign', 'order', 'Assign production users to orders'],
    ['production.read', 'production', 'View production tasks'],
    ['production.update', 'production', 'Update production task status'],
    ['pdf.generate', 'pdf', 'Generate order PDFs'],
    ['pdf.share', 'pdf', 'Share order PDFs'],
    ['pdf.download', 'pdf', 'Download order PDFs'],
    ['csv.export', 'csv', 'Export data to CSV'],
    ['csv.read', 'csv', 'View CSV export history'],
    ['men_section.manage', 'men_section', 'Manage Men Section and production users'],
    ['men_section.view', 'men_section', 'View Men Section dashboard'],
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
    ['men_section_supervisor', 'Men Section Supervisor'],
    ['men_production_user', 'Men Production User'],
  ];
  for (const [code, name] of ROLES) {
    await query(`INSERT INTO roles (code, name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`, [code, name]);
  }

  const ROLE_PERMS = {
    super_admin: ALL_PERMS,
    domain_admin: ['masters.view', 'masters.manage', 'po.view', 'po.create', 'po.edit', 'po.submit', 'po.amend', 'po.issue', 'po.close', 'po.commercial.override', 'approvals.view', 'approvals.act', 'receipt.view', 'receipt.create', 'inventory.view', 'reports.view', 'audit.view', 'order.create', 'order.read', 'order.update', 'order.approve', 'order.assign', 'production.read', 'production.update', 'pdf.generate', 'pdf.share', 'pdf.download', 'csv.export', 'csv.read', 'men_section.manage', 'men_section.view'],
    purchase_manager: ['masters.view', 'po.view', 'po.create', 'po.edit', 'po.submit', 'po.amend', 'po.issue', 'po.close', 'po.commercial.override', 'approvals.view', 'approvals.act', 'reports.view', 'order.create', 'order.read', 'order.update', 'order.approve', 'pdf.generate', 'csv.export'],
    purchase_executive: ['masters.view', 'po.view', 'po.create', 'po.edit', 'po.submit', 'order.create', 'order.read'],
    approver: ['po.view', 'approvals.view', 'approvals.act', 'order.read', 'order.approve'],
    receiving_user: ['po.view', 'receipt.view', 'receipt.create', 'inventory.view'],
    viewer: ['po.view', 'reports.view', 'inventory.view', 'order.read'],
    auditor: ['po.view', 'audit.view', 'reports.view', 'csv.read', 'order.read'],
    men_section_supervisor: ['men_section.view', 'production.read', 'production.update', 'order.read', 'order.assign', 'reports.view', 'pdf.generate', 'pdf.share', 'csv.export'],
    men_production_user: ['production.read', 'production.update', 'order.read'],
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
  const sections = Object.fromEntries((await query(`SELECT id, code FROM sections`)).rows.map((s) => [s.code, s.id]));

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
    ['admin@bsc.local', 'admin', 'Rajeshwar V. Rao', ['super_admin'], ['DVG', 'SMG', 'BLG'], 'Admin@123'],
    ['dvg.admin@bsc.local', 'dvg.admin', 'Davanagere Domain Admin', ['domain_admin'], ['DVG'], 'Admin@123'],
    ['pm.dvg@bsc.local', 'pm.dvg', 'Davanagere Purchase Manager', ['purchase_manager'], ['DVG'], 'PM@12345'],
    ['buyer.dvg@bsc.local', 'buyer.dvg', 'Davanagere Purchase Executive', ['purchase_executive'], ['DVG'], 'PE@12345'],
    ['approver.dvg@bsc.local', 'approver.dvg', 'Davanagere Approver', ['approver'], ['DVG'], 'AP@12345'],
    ['receiver.dvg@bsc.local', 'receiver.dvg', 'Davanagere Receiving User', ['receiving_user'], ['DVG'], 'RC@12345'],
    ['viewer@bsc.local', 'viewer', 'Enterprise Viewer', ['viewer'], ['DVG', 'SMG', 'BLG'], 'VW@12345'],
    ['auditor@bsc.local', 'auditor', 'Enterprise Auditor', ['auditor'], ['DVG', 'SMG', 'BLG'], 'AU@12345'],
    ['supervisor.men@bsc.local', 'supervisor.men', 'Men Section Supervisor', ['men_section_supervisor'], ['DVG'], 'SUP@12345'],
    ['prod1@bsc.local', 'prod.user1', 'Arjun Kumar (Production)', ['men_production_user'], ['DVG'], 'PROD@123'],
    ['prod2@bsc.local', 'prod.user2', 'Ravi Patel (Production)', ['men_production_user'], ['DVG'], 'PROD@123'],
    ['prod3@bsc.local', 'prod.user3', 'Suresh Singh (Production)', ['men_production_user'], ['DVG'], 'PROD@123'],
  ];
  for (const [email, username, fullName, roleCodes, divCodes, password] of USERS) {
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
  }
  // ---------- SCALE-UP: 30+ brands with providers, 1000+ products, team chat ----------
  await scaleCatalogue();
  await seedChat();

  // ---------- Company Settings ----------
  const csExists = (await query(`SELECT 1 FROM company_settings LIMIT 1`)).rows.length > 0;
  if (!csExists) {
    await query(
      `INSERT INTO company_settings (company_name, address, phone, email, website, gst_number, order_prefix, authorized_signatory, pdf_footer)
       VALUES ('BSC Exclusive', 'Davanagere, Karnataka, India', '+91 98765 43210', 'info@bscexclusive.com', 'https://bscexclusive.com', '29AABCB1234C1Z5', 'ORD', 'Rajeshwar V. Rao', 'Thank you for your business. Terms and conditions apply.')`);
    console.log('✔ Company settings seeded');
  }

  // ---------- Product Sheets ----------
  const sheetsExist = (await query(`SELECT 1 FROM product_sheets LIMIT 1`)).rows.length > 0;
  if (!sheetsExist) {
    const SHEETS = [
      ['SHEET-001', 'Premium Matte', 'Navy Blue', 'NB-01', '#1B2A4A', 'Matte', 'Cotton Blend'],
      ['SHEET-002', 'Premium Matte', 'Black', 'BK-01', '#111111', 'Matte', 'Cotton Blend'],
      ['SHEET-003', 'Premium Matte', 'White', 'WH-01', '#F5F5F5', 'Matte', 'Cotton Blend'],
      ['SHEET-004', 'Premium Matte', 'Grey', 'GR-01', '#757575', 'Matte', 'Cotton Blend'],
      ['SHEET-005', 'Premium Matte', 'Maroon', 'MR-01', '#5E1224', 'Matte', 'Cotton Blend'],
      ['SHEET-006', 'Premium Glossy', 'Red', 'RD-01', '#C62828', 'Glossy', 'Silk Blend'],
      ['SHEET-007', 'Premium Glossy', 'Gold', 'GD-01', '#C9A227', 'Glossy', 'Silk Blend'],
      ['SHEET-008', 'Standard Cotton', 'Beige', 'BG-01', '#D9C7A7', 'Plain', 'Pure Cotton'],
      ['SHEET-009', 'Standard Cotton', 'Green', 'GN-01', '#1B5E20', 'Plain', 'Pure Cotton'],
      ['SHEET-010', 'Denim Wash', 'Indigo', 'IN-01', '#3F51B5', 'Washed', 'Denim'],
    ];
    for (const [code, name, color, ccode, hex, finish, material] of SHEETS) {
      await query(
        `INSERT INTO product_sheets (sheet_code, sheet_name, color_name, color_code, swatch_hex, finish, material)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (sheet_code) DO NOTHING`,
        [code, name, color, ccode, hex, finish, material]);
    }
    console.log('✔ Product sheets seeded');
  }

  // ---------- Customers ----------
  const custExist = (await query(`SELECT 1 FROM customers LIMIT 1`)).rows.length > 0;
  if (!custExist) {
    const CUSTOMERS = [
      ['CUST-0001', 'Mumbai Fashion House', 'MFH Pvt Ltd', 'Priya Sharma', '9876543210', 'priya@mfh.in', 'Andheri West, Mumbai', 'Mumbai', 'Maharashtra', '29AABCM1234C1Z5'],
      ['CUST-0002', 'Bangalore Trends', 'BT Retail', 'Karthik Reddy', '9876543211', 'karthik@blr.in', 'MG Road, Bangalore', 'Bangalore', 'Karnataka', '29AABCB5678D1Z5'],
      ['CUST-0003', 'Delhi Garments Corp', 'DGC Trading', 'Amit Singh', '9876543212', 'amit@dgc.in', 'Karol Bagh, New Delhi', 'New Delhi', 'Delhi', '29AABCD9012E1Z5'],
      ['CUST-0004', 'Chennai Silks & Sarees', 'CSS Exports', 'Lakshmi N', '9876543213', 'lakshmi@css.in', 'T Nagar, Chennai', 'Chennai', 'Tamil Nadu', '29AABCE3456F1Z5'],
      ['CUST-0005', 'Pune Lifestyle Store', 'PLS Retail', 'Sneha Patil', '9876543214', 'sneha@pls.in', 'FC Road, Pune', 'Pune', 'Maharashtra', '29AABCF7890G1Z5'],
    ];
    for (const [code, name, company, contact, phone, email, address, city, state, gst] of CUSTOMERS) {
      await query(
        `INSERT INTO customers (customer_code, name, company, contact_person, phone, email, address, city, state, gst_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (customer_code) DO NOTHING`,
        [code, name, company, contact, phone, email, address, city, state, gst]);
    }
    console.log('✔ Customers seeded');
  }

  // ---------- Sample Orders (OM) ----------
  const ordersExist = (await query(`SELECT 1 FROM om_orders LIMIT 1`)).rows.length > 0;
  if (!ordersExist) {
    const adminId = (await query(`SELECT id FROM users WHERE email='admin@bsc.local'`)).rows[0]?.id;
    const supId = (await query(`SELECT id FROM users WHERE email='supervisor.men@bsc.local'`)).rows[0]?.id;
    const prod1Id = (await query(`SELECT id FROM users WHERE email='prod1@bsc.local'`)).rows[0]?.id;
    const prod2Id = (await query(`SELECT id FROM users WHERE email='prod2@bsc.local'`)).rows[0]?.id;
    const cust1 = (await query(`SELECT id FROM customers WHERE customer_code='CUST-0001'`)).rows[0]?.id;
    const cust2 = (await query(`SELECT id FROM customers WHERE customer_code='CUST-0002'`)).rows[0]?.id;
    const prod1 = (await query(`SELECT id FROM products WHERE product_serial='PRD-00001'`)).rows[0]?.id;
    const prod2 = (await query(`SELECT id FROM products WHERE product_serial='PRD-00002'`)).rows[0]?.id;
    const sheet1 = (await query(`SELECT id FROM product_sheets WHERE sheet_code='SHEET-001'`)).rows[0]?.id;
    const sheet2 = (await query(`SELECT id FROM product_sheets WHERE sheet_code='SHEET-002'`)).rows[0]?.id;
    if (adminId && cust1 && prod1) {
      const { rows: [o1] } = await query(
        `INSERT INTO om_orders (order_number, customer_id, order_date, created_by, assigned_supervisor_id, priority, status, notes, subtotal, tax_amount, grand_total)
         VALUES ('ORD-2026-000001', $1, current_date, $2, $3, 'high', 'approved', 'Urgent order for Mumbai', 15000, 2700, 17700) RETURNING id`,
        [cust1, adminId, supId]);
      if (o1) {
        await query(
          `INSERT INTO om_order_items (order_id, line_no, product_id, size_label, quantity, unit_price, tax_percent, tax_amount, total)
           VALUES ($1, 1, $2, 'M', 10, 1500, 18, 2700, 17700)`, [o1.id, prod1]);
        if (prod1Id) {
          await query(`INSERT INTO production_tasks (order_id, order_item_id, assigned_user_id, assigned_by, supervisor_id, priority, status, due_date)
                       VALUES ($1, (SELECT id FROM om_order_items WHERE order_id=$1 LIMIT 1), $2, $3, $4, 'high', 'pending', current_date + 7)`,
            [o1.id, prod1Id, adminId, supId]);
        }
        await query(`INSERT INTO order_status_history (order_id, new_status, changed_by, remarks) VALUES ($1, 'draft', $2, 'Created')`, [o1.id, adminId]);
        await query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, remarks) VALUES ($1, 'draft', 'submitted', $2, 'Submitted')`, [o1.id, adminId]);
        await query(`UPDATE om_orders SET submitted_at=now() WHERE id=$1`, [o1.id]);
        await query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, remarks) VALUES ($1, 'submitted', 'approved', $2, 'Approved')`, [o1.id, adminId]);
        await query(`UPDATE om_orders SET approved_at=now() WHERE id=$1`, [o1.id]);
        await query(`INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, remarks) VALUES ($1, 'approved', 'assigned', $2, 'Assigned to production')`, [o1.id, adminId]);
      }
      const { rows: [o2] } = await query(
        `INSERT INTO om_orders (order_number, customer_id, order_date, created_by, priority, status, notes, subtotal, tax_amount, grand_total)
         VALUES ('ORD-2026-000002', $1, current_date, $2, 'normal', 'draft', 'Regular order', 8500, 1530, 10030) RETURNING id`,
        [cust2, adminId]);
      if (o2) {
        await query(
          `INSERT INTO om_order_items (order_id, line_no, product_id, size_label, quantity, unit_price, tax_percent, tax_amount, total)
           VALUES ($1, 1, $2, 'L', 5, 1700, 18, 1530, 10030)`, [o2.id, prod2 || prod1]);
      }
      console.log('✔ Sample orders seeded');
    }
  }

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
