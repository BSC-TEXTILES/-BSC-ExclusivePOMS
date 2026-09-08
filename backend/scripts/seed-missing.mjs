import { query } from '../src/config/db.js';

async function seedData() {
  console.log('Seeding categories and manufacturers...');

  // Get section IDs
  const { rows: sections } = await query('SELECT id, code FROM sections');
  const sectionMap = {};
  sections.forEach(s => sectionMap[s.code] = s.id);

  // Create categories
  const cats = [
    ['MEN-SHIRTS', 'MS-FORMAL', 'Formal Shirts'],
    ['MEN-SHIRTS', 'MS-CASUAL', 'Casual Shirts'],
    ['MEN-SHIRTS', 'MS-LINEN', 'Linen Shirts'],
    ['MEN-TROUSERS', 'MT-FORMAL', 'Formal Trousers'],
    ['MEN-TROUSERS', 'MT-DENIM', 'Denim Jeans'],
    ['MEN-TROUSERS', 'MT-CARGO', 'Cargo Pants'],
    ['MEN-TSHIRTS', 'MTS-ROUND', 'Round Neck Tees'],
    ['MEN-TSHIRTS', 'MTS-POLO', 'Polo Tees'],
    ['MEN-TSHIRTS', 'MTS-GRAPHIC', 'Graphic Tees'],
    ['MEN-ETHNIC', 'ME-KURTA', 'Kurta Pyjama Sets'],
    ['MEN-ETHNIC', 'ME-SHERWANI', 'Sherwanis'],
    ['MEN-ETHNIC', 'ME-NEHRU', 'Nehru Jacket Sets'],
    ['MEN-INNERWEAR', 'MI-VEST', 'Vests and Undershirts'],
    ['MEN-INNERWEAR', 'MI-TRUNK', 'Trunks and Boxers'],
    ['FOOTWEAR-M', 'FM-FORMAL', 'Formal Shoes'],
    ['FOOTWEAR-M', 'FM-CASUAL', 'Casual Sneakers'],
    ['FOOTWEAR-M', 'FM-SANDAL', 'Sandals and Floaters'],
    ['WOM-SAREES', 'WS-SILK', 'Silk Sarees'],
    ['WOM-SAREES', 'WS-COTTON', 'Cotton Sarees'],
    ['WOM-SAREES', 'WS-CHIFFON', 'Chiffon and Georgette'],
    ['WOM-KURTIS', 'WK-ANARKALI', 'Anarkali Sets'],
    ['WOM-KURTIS', 'WK-STRAIGHT', 'Straight Kurtis'],
    ['WOM-KURTIS', 'WK-PALAZZO', 'Palazzo Sets'],
    ['WOM-WESTERN', 'WW-DRESS', 'Dresses'],
    ['WOM-WESTERN', 'WW-TOP', 'Tops and Blouses'],
    ['WOM-WESTERN', 'WW-JUMPSUIT', 'Jumpsuits'],
    ['WOM-BLOUSE', 'WB-SILK', 'Silk Blouse Pieces'],
    ['WOM-BLOUSE', 'WB-BANARASI', 'Banarasi Blouse'],
    ['WOM-INNERWEAR', 'WI-CAMISOLE', 'Camisoles and Slips'],
    ['JWL-FASHION', 'JF-NECKLACE', 'Necklace Sets'],
    ['JWL-FASHION', 'JF-EARRING', 'Earrings and Jhumkas'],
    ['JWL-FASHION', 'JF-CHOKER', 'Choker Sets'],
    ['JWL-BANGLES', 'JB-GOLD', 'Gold-Plated Bangles'],
    ['JWL-BANGLES', 'JB-MEENAKARI', 'Meenakari Bangles'],
    ['FOOTWEAR-W', 'FW-HEELS', 'Heels and Wedges'],
    ['FOOTWEAR-W', 'FW-JUTTI', 'Juttis and Flats'],
    ['ACCESSORIES', 'AC-BAG', 'Bags and Handbags'],
    ['ACCESSORIES', 'AC-WATCH', 'Watches'],
    ['ACCESSORIES', 'AC-BELT', 'Belts and Wallets'],
    ['KIDS-BOYS', 'KB-SHIRT', 'Shirt Sets'],
    ['KIDS-BOYS', 'KB-TSHIRT', 'T-Shirts and Shorts'],
    ['KIDS-BOYS', 'KB-ETHNIC', 'Ethnic Wear'],
    ['KIDS-GIRLS', 'KG-FROCK', 'Frocks and Dresses'],
    ['KIDS-GIRLS', 'KG-LEHENGA', 'Lehenga Sets'],
    ['KIDS-GIRLS', 'KG-KURTA', 'Kurti Sets'],
    ['KIDS-INFANT', 'KI-ROMPER', 'Romper Sets'],
    ['KIDS-INFANT', 'KI-ONESIE', 'Onesies and Bodysuits'],
    ['KIDS-TOYS', 'KT-BUILDING', 'Building Blocks'],
    ['KIDS-TOYS', 'KT-SOFT', 'Soft Toys'],
    ['KIDS-TOYS', 'KT-EDUCATIONAL', 'Educational Toys'],
    ['HOME-FURN', 'HF-BEDSHEET', 'Bedsheets and Covers'],
    ['HOME-FURN', 'HF-CURTAIN', 'Curtains and Drapes'],
    ['HOME-FURN', 'HF-TOWEL', 'Towels and Bath'],
    ['HOME-FURN', 'HF-CUSHION', 'Cushions and Rugs'],
    ['FURNITURE', 'FU-SOFA', 'Sofas and Seating'],
    ['FURNITURE', 'FU-TABLE', 'Tables and Desks'],
    ['FURNITURE', 'FU-BED', 'Beds and Headboards'],
    ['FURNITURE', 'FU-WARDROBE', 'Wardrobes and Storage'],
  ];

  let catCreated = 0, catSkipped = 0;
  for (const [secCode, code, name] of cats) {
    const sid = sectionMap[secCode];
    if (!sid) { catSkipped++; continue; }
    try {
      await query('INSERT INTO categories (section_id, code, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [sid, code, name]);
      catCreated++;
    } catch (e) { catSkipped++; }
  }
  console.log(`Categories: ${catCreated} created, ${catSkipped} skipped`);

  // Create manufacturers
  const mfrs = [
    ['MF-RAYMOND', 'Raymond Group', 'A. Kuruvilla', '022-66661000', 'Mumbai', 'Maharashtra', '27AAACR1092P1ZV'],
    ['MF-ADITYA', 'Aditya Birla Fashion', 'S. Singh', '022-66911000', 'Mumbai', 'Maharashtra', '27AAAAA1234A1Z5'],
    ['MF-ARVIND', 'Arvind Fashions', 'R. Patel', '079-66661000', 'Ahmedabad', 'Gujarat', '24AAAAA5678B1Z3'],
    ['MF-PAGE', 'Page Industries', 'K. Thomas', '080-66661000', 'Bangalore', 'Karnataka', '29AAAAA9012C1Z1'],
    ['MF-BATA', 'Bata India Ltd', 'M. Dutta', '033-66661000', 'Kolkata', 'West Bengal', '19AAAAA3456D1Z9'],
    ['MF-NALLI', 'Nalli Silks', 'N. Nalli', '044-66661000', 'Chennai', 'Tamil Nadu', '33AAAAA7890E1Z7'],
    ['MF-MEENA', 'Meena Bazaar', 'F. Rahman', '011-66661000', 'Delhi', 'Delhi', '07AAAAA1234F1Z5'],
    ['MF-BIBA', 'Biba Apparels', 'S. Khanna', '011-66662000', 'Delhi', 'Delhi', '07AAAAA5678G1Z3'],
    ['MF-FUNSKOOL', 'Funskool India', 'G. Rathnam', '044-66663000', 'Chennai', 'Tamil Nadu', '33AAAAA9012H1Z1'],
    ['MF-TRIDENT', 'Trident Ltd', 'R. Chadha', '0172-6666100', 'Chandigarh', 'Chandigarh', '04AAAAA3456I1Z9'],
    ['MF-TEAKCRAFT', 'TeakCraft Furnishings', 'P. Sharma', '080-66664000', 'Bangalore', 'Karnataka', '29AAAAA7890J1Z7'],
    ['MF-URBANNEST', 'UrbanNest Interiors', 'A. Gupta', '022-66665000', 'Mumbai', 'Maharashtra', '27AAAAA1234K1Z5'],
    ['MF-MALABAR', 'Malabar Atelier', 'K. Nair', '0495-6666100', 'Kozhikode', 'Kerala', '32AAAAA5678L1Z3'],
    ['MF-ZAVERI', 'Zaveri and Sons', 'R. Zaveri', '079-66662000', 'Ahmedabad', 'Gujarat', '24AAAAA9012M1Z1'],
    ['MF-SHEELA', 'Sheela Foam', 'S. Mathur', '080-66665000', 'Bangalore', 'Karnataka', '29AAAAA3456N1Z9'],
  ];

  let mfrCreated = 0, mfrSkipped = 0;
  for (const [code, name, contact, phone, city, state, gstin] of mfrs) {
    try {
      await query('INSERT INTO manufacturers (code, name, contact_person, phone, city, state, gstin) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', [code, name, contact, phone, city, state, gstin]);
      mfrCreated++;
    } catch (e) { mfrSkipped++; }
  }
  console.log(`Manufacturers: ${mfrCreated} created, ${mfrSkipped} skipped`);

  // Verify
  const catCount = (await query('SELECT count(*)::int FROM categories')).rows[0].count;
  const mfrCount = (await query('SELECT count(*)::int FROM manufacturers')).rows[0].count;
  console.log(`\nFinal: ${catCount} categories, ${mfrCount} manufacturers`);

  process.exit(0);
}

seedData().catch(e => { console.error(e); process.exit(1); });
