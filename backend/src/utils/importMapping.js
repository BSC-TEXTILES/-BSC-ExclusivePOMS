// Product catalogue import — field mapping + validation (the "sheet" definition).
// Auto-maps imported column headers to real products.* columns using exact,
// case-insensitive, and known-alias matches. Unknown/mismatched fields are
// reported back to the admin rather than silently dropped.
//
// Unique key = SKU (RB-004). Create vs Update is decided on SKU.

const TAX_CATEGORY_ALIASES = {
  'gst_0': ['0%', '0', 'zero', 'nil', 'exempt', 'gst 0', 'gst@0'],
  'gst_3': ['3%', '3', 'gst 3', 'gst@3'],
  'gst_5': ['5%', '5', 'gst 5', 'gst@5'],
  'gst_12': ['12%', '12', 'gst 12', 'gst@12'],
  'gst_18': ['18%', '18', 'gst 18', 'gst@18'],
  'gst_28': ['28%', '28', 'gst 28', 'gst@28'],
};

// Normalize a tax category string ("12%", "GST 12", "12") -> "gst_12" (or null)
export function normalizeTax(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  for (const [code, aliases] of Object.entries(TAX_CATEGORY_ALIASES)) {
    if (aliases.includes(s)) return code;
  }
  const num = s.replace(/%/g, '').replace(/[^\d]/g, '');
  if (num && ['0', '3', '5', '12', '18', '28'].includes(num)) return `gst_${num}`;
  return null; // unknown rate -> needs review (never invent a rate)
}

export function parsePrice(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).replace(/[₹,\s]/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

export function normalizeStatus(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'active';
  if (/(ar?)chiv/.test(s)) return 'archived';
  if (s === 'inactive' || s === 'no' || s === '0') return 'inactive';
  return 'active';
}

// Canonical product fields we can import, with known column aliases.
export const PRODUCT_FIELDS = [
  { key: 'sku', label: 'SKU / Product Code', required: true, uniqueKey: true,
    aliases: ['sku', 'product code', 'productcode', 'code', 'item code', 'itemcode', 'style code', 'stylecode', 'product sku', 'productsku', 'item'] },
  { key: 'name', label: 'Product Name', required: true,
    aliases: ['product name', 'productname', 'name', 'product', 'title', 'item name', 'description', 'product description'] },
  { key: 'brand', label: 'Brand', required: true,
    aliases: ['brand', 'brand name', 'brandname', 'brand code', 'brandcode', 'manufacturer', 'company', 'label'] },
  { key: 'section', label: 'Collection / Section', required: true,
    aliases: ['collection', 'section', 'section name', 'sectionname', 'department', 'product type', 'producttype', 'category type', 'categorytype'] },
  { key: 'category', label: 'Category', required: false,
    aliases: ['category', 'category name', 'categoryname', 'subcategory', 'sub category', 'class', 'sub-category'] },
  { key: 'hsn', label: 'HSN / SAC', required: false,
    aliases: ['hsn', 'hsn code', 'hsncode', 'hsn/sac', 'hsn sac', 'sac', 'gst hsn', 'custom duty hsn'] },
  { key: 'taxCategory', label: 'Tax Category', required: false,
    aliases: ['tax category', 'taxcategory', 'tax', 'gst', 'gst category', 'gst %', 'gst%', 'tax rate', 'taxrate', 'gst rate'] },
  { key: 'purchasePrice', label: 'Purchase Price', required: false,
    aliases: ['purchase price', 'purchaseprice', 'price', 'unit price', 'unitprice', 'cost', 'buying price', 'purchase cost', 'buying cost', 'rate'] },
  { key: 'sellingPrice', label: 'Selling Price (MRP)', required: false,
    aliases: ['selling price', 'sellingprice', 'mrp', 'sale price', 'retail price', 'selling'] },
  { key: 'barcode', label: 'Barcode', required: false,
    aliases: ['barcode', 'bar code', 'barcode no', 'ean', 'upc', 'gtin', 'barcode number', 'sku barcode'] },
  { key: 'internalRef', label: 'Internal Ref', required: false,
    aliases: ['internal ref', 'internalref', 'internal reference', 'reference', 'ref', 'vendor code', 'vendor ref'] },
  { key: 'material', label: 'Material', required: false,
    aliases: ['material', 'fabric', 'fabric composition', 'fabric content'] },
  { key: 'collection', label: 'Collection Group', required: false,
    aliases: ['collection group', 'collectiongroup', 'group', 'sub collection', 'theme'] },
  { key: 'gender', label: 'Gender', required: false,
    aliases: ['gender', 'sex', 'gents', 'ladies'] },
  { key: 'status', label: 'Status', required: false,
    aliases: ['status', 'state', 'active', 'product status', 'availability'] },
];

// Map a raw header (or alias) to a canonical field key.
export function mapField(header) {
  const h = String(header || '').trim();
  const hl = h.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!h) return null;
  const exact = PRODUCT_FIELDS.find((f) => f.key === hl);
  if (exact) return exact.key;
  const byAlias = PRODUCT_FIELDS.find((f) => f.aliases.some((a) => a.toLowerCase() === hl));
  if (byAlias) return byAlias.key;
  const bySubstr = PRODUCT_FIELDS.find((f) => f.aliases.some((a) => {
    const al = a.toLowerCase();
    return hl.includes(al) || al.includes(hl);
  }));
  if (bySubstr) return bySubstr.key;
  return null; // unmatched -> reported as unmapped
}

// Return the list of import field definitions (for UI mapping selector).
export function productFieldOptions() {
  return PRODUCT_FIELDS.map((f) => ({ key: f.key, label: f.label, required: f.required, uniqueKey: !!f.uniqueKey }));
}

// Human helper describing the sheet for the import flow.
export const PRODUCT_IMPORT_INFO = {
  type: 'product',
  title: 'Product Catalogue Import',
  description: 'Import products (SKU, name, brand, collection/section, category, HSN, prices, barcode). Creates new products and updates existing ones by SKU.',
  uniqueKey: 'SKU',
};

// Build a sensible default column -> field mapping from detected headers.
export function defaultMappingFromHeaders(headers) {
  const mapping = {};
  const used = new Set();
  for (const h of headers) {
    const key = mapField(h);
    if (key && !used.has(key)) { mapping[key] = h; used.add(key); }
  }
  return mapping;
}

// Normalize a value for a unique-key comparison (SKU, barcode...).
export function normKey(v) {
  return String(v || '').trim().toUpperCase();
}
