// ============================================================================
// SCALE-UP — large brand catalogue with manufacturers/providers, 1000+ products
// across every section (§8/§10), and team-chat welcome messages (§18).
// Deterministic (index arithmetic, no randomness) → fully idempotent.
// ============================================================================
import { query } from '../src/config/db.js';

const BRAND_CATALOGUE = [
  // [brandName, manufacturer, departmentAffinity, supplierCodes]
  ["Levi's", 'Levi Strauss & Co.', 'MEN', ['SUP-002']],
  ['Raymond', 'Raymond Group', 'MEN', ['SUP-002']],
  ['Van Heusen', 'Aditya Birla Fashion', 'MEN', ['SUP-002', 'SUP-001']],
  ['Peter England', 'Aditya Birla Fashion', 'MEN', ['SUP-002']],
  ['Allen Solly', 'Aditya Birla Fashion', 'MEN', ['SUP-001']],
  ['Louis Philippe', 'Aditya Birla Fashion', 'MEN', ['SUP-002']],
  ['U.S. Polo Assn.', 'Authentic Apparel', 'MEN', ['SUP-001']],
  ['Arrow', 'Arvind Fashions', 'MEN', ['SUP-002']],
  ['Jockey', 'Page Industries', 'MEN', ['SUP-001']],
  ['Bata', 'Bata India Ltd', 'MEN', ['SUP-003']],
  ['Pachaiyappa Silks', 'Sri Pachaiyappa Silks', 'WOMEN', ['SUP-001']],
  ['Nalli', 'Nalli Silks', 'WOMEN', ['SUP-001']],
  ['Meena Bazaar', 'Meena Bazaar Fashions', 'WOMEN', ['SUP-001', 'SUP-003']],
  ['Biba', 'Biba Apparels', 'WOMEN', ['SUP-003']],
  ['Aurelia', 'Biba Apparels', 'WOMEN', ['SUP-003']],
  ['W', 'Womens Worldwide', 'WOMEN', ['SUP-001']],
  ['Global Desi', 'Aurex Lifestyle', 'WOMEN', ['SUP-003']],
  ['Zaveri Classics', 'Zaveri & Sons Jewellers', 'WOMEN', ['SUP-001']],
  ['Aakshi Jewels', 'Aakshi Fashion Jewellery', 'WOMEN', ['SUP-003']],
  ['Mochi', 'Mochi Footwear', 'WOMEN', ['SUP-003']],
  ['Babyhug', 'Babyhug Kids Care', 'KIDS', ['SUP-001']],
  ['FirstCry', 'Brainbees Solutions', 'KIDS', ['SUP-003']],
  ['Tiny Duds', 'Tiny Duds Garments', 'KIDS', ['SUP-001']],
  ['FunSkool', 'Funskool India Ltd', 'KIDS', ['SUP-003']],
  ['BrickMate', 'BrickMate Toys Pvt Ltd', 'KIDS', ['SUP-001', 'SUP-003']],
  ['PlushPal', 'PlushPal Soft Toys', 'KIDS', ['SUP-003']],
  ['BSC Home Collection', 'B.S. Channabasappa & Sons', 'HOME', ['SUP-001', 'SUP-002']],
  ['SleepWell Home', 'Sheela Foam Ltd', 'HOME', ['SUP-002']],
  ['DecorHaus', 'DecorHaus Textiles', 'HOME', ['SUP-001']],
  ['Trident Living', 'Trident Ltd', 'HOME', ['SUP-002']],
  ['TeakCraft', 'TeakCraft Furnishings', 'HOME', ['SUP-003']],
  ['UrbanNest', 'UrbanNest Interiors', 'HOME', ['SUP-003']],
  ['Malabar Atelier', 'Malabar Atelier Crafts LLP', 'HOME', ['SUP-003']],
];

const SECTION_RECIPES = {
  'MEN-SHIRTS':    { dept: 'MEN', count: 70, min: 799, max: 4999, items: ['Formal Shirt', 'Casual Shirt', 'Oxford Shirt', 'Checked Shirt', 'Linen Shirt', 'Slim-Fit Shirt', 'Party Wear Shirt'] },
  'MEN-TROUSERS':  { dept: 'MEN', count: 50, min: 999, max: 4499, items: ['Chino Trousers', 'Formal Trousers', 'Denim Jeans', 'Slim Jeans', 'Cargo Pants', 'Comfort Trousers'] },
  'MEN-TSHIRTS':   { dept: 'MEN', count: 60, min: 399, max: 2499, items: ['Round Neck T-Shirt', 'Polo T-Shirt', 'V-Neck T-Shirt', 'Graphic Tee', 'Henley Tee', 'Oversized Tee'] },
  'MEN-ETHNIC':    { dept: 'MEN', count: 45, min: 1499, max: 14999, items: ['Kurta Pyjama Set', 'Nehru Jacket Set', 'Sherwani', 'Short Kurta', 'Pathani Set', 'Bandhgala Set'] },
  'MEN-INNERWEAR': { dept: 'MEN', count: 40, min: 199, max: 1299, items: ['Vest Pack', 'Trunks', 'Brief Set', 'Thermal Set', 'Boxer Pack'] },
  'FOOTWEAR-M':    { dept: 'MEN', count: 45, min: 899, max: 7999, items: ['Leather Formal Shoes', 'Sneakers', 'Loafers', 'Sandals', 'Sports Shoes', 'Slip-Ons'] },
  'WOM-SAREES':    { dept: 'WOMEN', count: 90, min: 1499, max: 49999, items: ['Kanjivaram Silk Saree', 'Banarasi Saree', 'Chiffon Saree', 'Cotton Saree', 'Tussar Silk Saree', 'Georgette Saree', 'Jamdani Saree', 'Organza Saree', 'Mysore Silk Saree'] },
  'WOM-KURTIS':    { dept: 'WOMEN', count: 70, min: 699, max: 5999, items: ['Anarkali Kurti Set', 'Straight Kurti', 'A-Line Kurti', 'Palazzo Set', 'Sharara Set', 'Long Kurti'] },
  'WOM-WESTERN':   { dept: 'WOMEN', count: 55, min: 899, max: 6999, items: ['Midi Dress', 'Maxi Dress', 'Jeans', 'Top & Skirt Set', 'Jumpsuit', 'Blazer'] },
  'WOM-BLOUSE':    { dept: 'WOMEN', count: 45, min: 499, max: 4999, items: ['Banarasi Blouse Piece', 'Silk Blouse Fabric', 'Cotton Blouse Piece', 'Designer Blouse', 'Brocade Blouse Piece'] },
  'WOM-INNERWEAR': { dept: 'WOMEN', count: 40, min: 249, max: 1999, items: ['Camisole', 'Slip', 'Bralette Set', 'Thermal Set', 'Lounge Set'] },
  'JWL-FASHION':   { dept: 'WOMEN', count: 55, min: 299, max: 9999, items: ['Necklace Set', 'Jhumka Earrings', 'Bangle Set', 'Choker Set', 'Pendant Set', 'Kada Pair'] },
  'JWL-BANGLES':   { dept: 'WOMEN', count: 40, min: 399, max: 12999, items: ['Gold-Plated Bangle Set', 'Kada Set', 'Chudi Bangle Set', 'Bridal Bangle Stack', 'Meenakari Bangles'] },
  'FOOTWEAR-W':    { dept: 'WOMEN', count: 45, min: 599, max: 6999, items: ['Kolhapuri Chappal', 'Heels', 'Juttis', 'Flats', 'Wedges', 'Block Heels'] },
  'ACCESSORIES':   { dept: 'WOMEN', count: 45, min: 299, max: 9999, items: ['Leather Belt', 'Handbag', 'Wrist Watch', 'Wallet', 'Sunglasses', 'Sling Bag'] },
  'KIDS-BOYS':     { dept: 'KIDS', count: 50, min: 399, max: 2999, items: ['Boys Shirt Set', 'Boys Shorts Set', 'Boys Kurta Set', 'Boys T-Shirt', 'Boys Dungaree', 'Boys Track Set'] },
  'KIDS-GIRLS':    { dept: 'KIDS', count: 50, min: 399, max: 3499, items: ['Girls Frock', 'Girls Lehenga Set', 'Girls Top & Legging', 'Girls Kurti Set', 'Girls Skirt Set'] },
  'KIDS-INFANT':   { dept: 'KIDS', count: 45, min: 299, max: 2499, items: ['Infant Romper Set', 'Infant Onesie Pack', 'Baby Gift Set', 'Infant Jhabla Set', 'Baby Towel Set'] },
  'KIDS-TOYS':     { dept: 'KIDS', count: 60, min: 199, max: 7999, items: ['Building Blocks Set', 'Soft Teddy', 'Remote Control Car', 'Educational Puzzle', 'Musical Toy', 'Doll House Set', 'Board Game'] },
  'HOME-FURN':     { dept: 'HOME', count: 65, min: 249, max: 9999, items: ['Double Bedsheet Set', 'Blanket', 'Curtain Pair', 'Bath Towel Set', 'Cushion Cover Set', 'Table Cover', 'Sofa Cover', 'Door Mat', 'Rug'] },
  'FURNITURE':     { dept: 'HOME', count: 60, min: 4999, max: 149999, items: ['3-Seater Sofa', 'Coffee Table', 'TV Unit', 'Queen Bed with Storage', '3-Door Wardrobe', '6-Seater Dining Set', 'Study Table', 'Ergonomic Office Chair', 'Bookshelf', 'Shoe Rack', 'Nightstand', 'Recliner'] },
};

const FINISH_WORDS = ['Premium', 'Classic', 'Elite', 'Signature', 'Designer', 'Everyday', 'Festive', 'Deluxe'];

export async function scaleCatalogue() {
  const deptRows = Object.fromEntries((await query(`SELECT id, code FROM departments`)).rows.map((d) => [d.code, d.id]));
  const sectionRows = Object.fromEntries((await query(`SELECT id, code FROM sections`)).rows.map((s) => [s.code, s.id]));
  const colourRows = (await query(`SELECT id FROM colours ORDER BY code`)).rows.map((c) => c.id);
  const existingBrands = Object.fromEntries((await query(`SELECT brand_name, id FROM brands`)).rows.map((b) => [b.brand_name, b.id]));

  // 1) Brands (brand number ≠ brand serial, RB-005) + supplier links (provider names)
  let brandNo = 2000;
  const brandIdsByDept = { MEN: [], WOMEN: [], KIDS: [], HOME: [] };
  for (const [name, manufacturer, dept, suppliers] of BRAND_CATALOGUE) {
    let id = existingBrands[name];
    if (!id) {
      brandNo += 1;
      const { rows } = await query(
        `INSERT INTO brands (brand_number, brand_serial, brand_name, brand_code, manufacturer)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (brand_number) DO NOTHING RETURNING id`,
        [`BN-${brandNo}`, `BSR-${brandNo}`, name, name.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 6), manufacturer]);
      id = rows[0]?.id;
      if (!id) id = (await query(`SELECT id FROM brands WHERE brand_name = $1`, [name])).rows[0].id;
    } else {
      await query(`UPDATE brands SET manufacturer = COALESCE(manufacturer, $2) WHERE id = $1`, [id, manufacturer]);
    }
    brandIdsByDept[dept].push(id);
    for (const supCode of suppliers) {
      await query(
        `INSERT INTO supplier_brands (supplier_id, brand_id)
         SELECT s.id, $2 FROM suppliers s WHERE s.code = $1 ON CONFLICT DO NOTHING`,
        [supCode, id]);
    }
  }
  console.log(`✔ ${BRAND_CATALOGUE.length} brands with manufacturers + provider links ready`);

  // 2) Products — 1000+ across every section, deterministic and idempotent
  let serial = 10000; // PRD-00001..00005 reserved for the handcrafted samples
  let inserted = 0;
  const recipes = Object.entries(SECTION_RECIPES);
  for (const [sectionCode, recipe] of recipes) {
    const sectionId = sectionRows[sectionCode];
    const pool = brandIdsByDept[recipe.dept];
    const chunk = [];
    for (let i = 0; i < recipe.count; i++) {
      serial += 1;
      const item = recipe.items[i % recipe.items.length];
      const finish = FINISH_WORDS[Math.floor(i / recipe.items.length) % FINISH_WORDS.length];
      const colour = colourRows[i % colourRows.length];
      const brandId = pool[i % pool.length];
      const price = recipe.min + Math.floor(((i * 37) % (recipe.max - recipe.min)));
      const priceStr = String(Math.round(price / 10) * 10);
      const name = `${item} — ${finish}`;
      const sku = `${sectionCode}-${String(i + 1).padStart(4, '0')}`;
      chunk.push([`PRD-${serial}`, sku, name, brandId, sectionId, colour, priceStr]);
    }
    for (let start = 0; start < chunk.length; start += 200) {
      const part = chunk.slice(start, start + 200);
      const values = part.map((_, j) => {
        const b = j * 7;
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6}::jsonb,$${b + 7})`;
      }).join(',');
      const flat = part.flatMap(([ser, sku, name, brandId, sectionId, colourId, price]) =>
        [ser, sku, name, brandId, sectionId, JSON.stringify({ colour_id: colourId, base_purchase_price: price }), price]);
      const res = await query(
        `INSERT INTO products (product_serial, sku, name, brand_id, section_id, attributes, hsn_sac)
         VALUES ${values}
         ON CONFLICT (sku) DO NOTHING`, flat);
      inserted += res.rowCount;
    }
  }
  const total = (await query(`SELECT count(*)::int AS c FROM products`)).rows[0].c;
  console.log(`✔ Catalogue scale-up: ${inserted} new products inserted — ${total} products total across ${recipes.length} sections`);

  const orphans = (await query(
    `SELECT count(*)::int AS c FROM brands b
      WHERE NOT EXISTS (SELECT 1 FROM supplier_brands sb WHERE sb.brand_id = b.id)`)).rows[0].c;
  if (orphans > 0) console.log(`  ⚠ ${orphans} brands have no provider link`);
  void deptRows;
}

// Brand ↔ Collection mapping — fills the storefront collection pages (Men, Women,
// Kids, Home Furnishing, Jewellery, Wedding, Suits, Dothis/Dozolo, Towels).
// Deterministic and idempotent: every brand lands in its department collection
// plus the topical collections its merchandise belongs to.
export async function seedCollections() {
  const colRows = Object.fromEntries((await query(`SELECT code, id FROM collections`)).rows.map((c) => [c.code, c.id]));
  if (!Object.keys(colRows).length) {
    console.log('  ⚠ collections table empty — run migration 008 first');
    return;
  }
  const brandDept = (await query(`
    SELECT DISTINCT b.id AS brand_id, d.code AS dept
      FROM brands b
      JOIN products p ON p.brand_id = b.id
      JOIN sections s ON s.id = p.section_id
      JOIN departments d ON d.id = s.department_id`)).rows;

  // department → default collection
  const DEPT_COLLECTION = { MEN: 'mens_wear', WOMEN: 'womens_wear', KIDS: 'kids_wear', HOME: 'home_furnishing' };

  // brand-name keywords → additional topical collections
  const KEYWORD_MAP = [
    [/silk|zaveri|aakshi|malabar/i, ['jewellery', 'wedding']],
    [/biba|aurelia|meena|global des/i, ['wedding']],
    [/raymond|van heusen|louis|peter england|allen|arrow/i, ['suits']],
    // Silk-heritage houses also weave the traditional dhoti/veshti/mundu range
    // (the "Dothis / Dozolo" collection), so they anchor that shelf too.
    [/pachaiyappa|nalli/i, ['dothis_dozolo']],
    [/teakcraft|urbanNest/i, ['other']],
    [/home|sleepwell|decor|trident/i, ['towels']],
  ];

  for (const { brand_id: brandId, dept } of brandDept) {
    const targetCodes = new Set();
    const base = DEPT_COLLECTION[dept] || 'other';
    if (colRows[base]) targetCodes.add(base);
    const { rows: nameRows } = await query(`SELECT brand_name FROM brands WHERE id = $1`, [brandId]);
    const bn = nameRows[0]?.brand_name || '';
    for (const [re, codes] of KEYWORD_MAP) {
      if (re.test(bn)) for (const code of codes) if (colRows[code]) targetCodes.add(code);
    }
    for (const code of targetCodes) {
      await query(`INSERT INTO brand_collections (brand_id, collection_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [brandId, colRows[code]]);
    }
  }
  const { rows: [{ c: total }] } = await query(`SELECT count(*)::int AS c FROM brand_collections`);
  console.log(`✔ Brand ↔ collection links ready (${total} total mappings across ${Object.keys(colRows).length} collections)`);
}

export async function seedChat() {
  const empty = (await query(`SELECT count(*)::int AS c FROM chat_messages`)).rows[0].c === 0;
  if (!empty) return;
  const admin = (await query(`SELECT id FROM users WHERE email = 'admin@bsc.local'`)).rows[0];
  const divisions = (await query(`SELECT id, code FROM divisions ORDER BY code`)).rows;
  const welcome = [
    ['Welcome to BSC POMS team chat 🎉 — raise PO queries, share dealer updates and approval notes here. Messages are division-scoped.', null],
    ["Reminder: the Levi's worked-example PO (₹65,520) is the pricing reference for all Men's Shirts negotiation.", 'DVG'],
    ['Saree suppliers: please log delivery slippage in chat so Receiving can plan partial GRNs.', 'DVG'],
  ];
  for (const [body, divCode] of welcome) {
    const divisionId = divCode ? divisions.find((d) => d.code === divCode)?.id : null;
    await query(`INSERT INTO chat_messages (division_id, user_id, body) VALUES ($1,$2,$3)`, [divisionId, admin.id, body]);
  }
  console.log('✔ Team chat welcome messages seeded');
}
