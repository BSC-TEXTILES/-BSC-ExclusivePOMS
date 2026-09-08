import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errMessage } from '../api.js';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [sections, setSections] = useState([]);
  const [brands, setBrands] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [allColours, setAllColours] = useState([]);
  const [allSizes, setAllSizes] = useState([]);

  const [sectionId, setSectionId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [productTypes, setProductTypes] = useState([]);

  const [form, setForm] = useState({
    sku: '', name: '', description: '', gender: 'men', collection: 'mens_wear',
    material: '', pattern: '', fit: '', neckType: '', sleeveType: '', season: '',
    purchasePrice: '', sellingPrice: '', manualSize: '',
  });
  const [selectedColours, setSelectedColours] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/sections').then((r) => setSections(r.data.data || [])).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data.data || [])).catch(() => {});
    api.get('/manufacturers').then((r) => setManufacturers(r.data.data || [])).catch(() => {});
    api.get('/colours').then((r) => setAllColours(r.data.data || [])).catch(() => {});
    api.get('/sizes').then((r) => setAllSizes(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sectionId) { setCategories([]); return; }
    api.get('/categories', { params: { sectionId } }).then((r) => {
      const cats = (r.data.data || []).filter((c) => !c.parent_category_id);
      setCategories(cats);
      setSubcategories([]);
      setCategoryId(''); setSubcategoryId(''); setProductTypeId('');
    }).catch(() => {});
  }, [sectionId]);

  useEffect(() => {
    if (!sectionId || !categoryId) { setSubcategories([]); return; }
    api.get('/categories', { params: { sectionId } }).then((r) => {
      const subs = (r.data.data || []).filter((c) => c.parent_category_id === categoryId);
      setSubcategories(subs);
      setSubcategoryId(''); setProductTypeId('');
    }).catch(() => {});
  }, [sectionId, categoryId]);

  useEffect(() => {
    if (!sectionId) { setProductTypes([]); return; }
    const params = { sectionId };
    if (categoryId) params.categoryId = categoryId;
    if (subcategoryId) params.subcategoryId = subcategoryId;
    api.get('/product-types', { params }).then((r) => setProductTypes(r.data.data || [])).catch(() => {});
  }, [sectionId, categoryId, subcategoryId]);

  useEffect(() => {
    if (!id) return;
    api.get(`/products/${id}`).then((r) => {
      const p = r.data.data;
      setForm({
        sku: p.sku || '', name: p.name || '', description: p.description || '',
        gender: p.gender || 'men', collection: p.collection || 'mens_wear',
        material: p.material || '', pattern: p.pattern || '', fit: p.fit || '',
        neckType: p.neck_type || '', sleeveType: p.sleeve_type || '', season: p.season || '',
        purchasePrice: p.purchase_price || '', sellingPrice: p.selling_price || '',
        manualSize: p.manual_size || '',
      });
      setSectionId(p.section_id || '');
      setBrandId(p.brand_id || '');
      setCategoryId(p.category_id || '');
      setSubcategoryId(p.subcategory_id || '');
      setProductTypeId(p.product_type_id || '');
      setSelectedColours((p.colours || p.colors || []).map((c) => c.id || c));
      setSelectedSizes((p.sizes || []).map((s) => s.id || s));
    }).catch((e) => setError(errMessage(e)));
  }, [id]);

  const toggleColour = (cid) => setSelectedColours((prev) => prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]);
  const toggleSize = (sid) => setSelectedSizes((prev) => prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        sku: form.sku, name: form.name, description: form.description || null,
        sectionId, brandId, categoryId: categoryId || null, subcategoryId: subcategoryId || null,
        productTypeId: productTypeId || null, manufacturerId: manufacturerId || null,
        gender: form.gender, collection: form.collection,
        material: form.material || null, pattern: form.pattern || null,
        fit: form.fit || null, neckType: form.neckType || null,
        sleeveType: form.sleeveType || null, season: form.season || null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : 0,
        manualSize: form.manualSize || null,
        colourIds: selectedColours, sizeIds: selectedSizes,
      };
      if (isEdit) {
        await api.patch(`/products/${id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      navigate('/products');
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  }

  const profit = (Number(form.sellingPrice) || 0) - (Number(form.purchasePrice) || 0);
  const margin = Number(form.purchasePrice) > 0 ? ((profit / Number(form.purchasePrice)) * 100).toFixed(1) : '0.0';

  return (
    <div className="content">
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
      </div>
      {error && <div className="alert error">{error}</div>}

      <form onSubmit={submit}>
        {/* Hierarchy Selection */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Product Hierarchy</h3>
          <div className="fields-3">
            <label className="field"><span className="field-label">Section *</span>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
                <option value="">— select —</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Brand *</span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} required>
                <option value="">— select —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Category</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— none —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="fields-3">
            <label className="field"><span className="field-label">Subcategory</span>
              <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
                <option value="">— none —</option>
                {subcategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Product Type</span>
              <select value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}>
                <option value="">— none —</option>
                {productTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Manufacturer</span>
              <select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)}>
                <option value="">— none —</option>
                {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Product Info */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Product Details</h3>
          <div className="fields-2">
            <label className="field"><span className="field-label">SKU *</span>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required placeholder="e.g. MTS-001" />
            </label>
            <label className="field"><span className="field-label">Product Name *</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Premium Cotton T-Shirt" />
            </label>
          </div>
          <label className="field"><span className="field-label">Description</span>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Product description…" />
          </label>
          <div className="fields-3">
            <label className="field"><span className="field-label">Gender</span>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="men">Men</option><option value="women">Women</option><option value="kids">Kids</option><option value="unisex">Unisex</option>
              </select>
            </label>
            <label className="field"><span className="field-label">Collection</span>
              <select value={form.collection} onChange={(e) => setForm({ ...form, collection: e.target.value })}>
                <option value="mens_wear">Men's Wear</option><option value="womens_wear">Women's Wear</option><option value="kids_wear">Kids' Wear</option><option value="home">Home</option>
              </select>
            </label>
            <label className="field"><span className="field-label">Material</span>
              <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="e.g. 100% Cotton" />
            </label>
          </div>
          <div className="fields-3">
            <label className="field"><span className="field-label">Pattern</span>
              <input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} placeholder="e.g. Solid" />
            </label>
            <label className="field"><span className="field-label">Fit</span>
              <input value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })} placeholder="e.g. Regular Fit" />
            </label>
            <label className="field"><span className="field-label">Neck Type</span>
              <input value={form.neckType} onChange={(e) => setForm({ ...form, neckType: e.target.value })} placeholder="e.g. Round Neck" />
            </label>
          </div>
          <div className="fields-3">
            <label className="field"><span className="field-label">Sleeve Type</span>
              <input value={form.sleeveType} onChange={(e) => setForm({ ...form, sleeveType: e.target.value })} placeholder="e.g. Half Sleeve" />
            </label>
            <label className="field"><span className="field-label">Season</span>
              <input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="e.g. Summer" />
            </label>
            <label className="field"><span className="field-label">Manual/Custom Size</span>
              <input value={form.manualSize} onChange={(e) => setForm({ ...form, manualSize: e.target.value })} placeholder="e.g. 5XL (if not in master sizes)" />
            </label>
          </div>
        </div>

        {/* Colors */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Colors</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allColours.map((c) => (
              <button key={c.id} type="button" className={`btn sm ${selectedColours.includes(c.id) ? 'primary' : ''}`}
                onClick={() => toggleColour(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.swatch_hex && <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.swatch_hex, border: '1px solid #d1d5db', display: 'inline-block' }} />}
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Sizes</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allSizes.map((s) => (
              <button key={s.id} type="button" className={`btn sm ${selectedSizes.includes(s.id) ? 'primary' : ''}`}
                onClick={() => toggleSize(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Pricing</h3>
          <div className="fields-3">
            <label className="field"><span className="field-label">Purchase Price (INR) *</span>
              <input type="number" step="0.01" min="0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} required />
            </label>
            <label className="field"><span className="field-label">Selling Price (INR) *</span>
              <input type="number" step="0.01" min="0" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
            </label>
            <div className="field"><span className="field-label">Profit / Margin</span>
              <div style={{ padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  ₹{profit.toLocaleString('en-IN')} ({margin}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => navigate('/products')}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Update Product' : 'Create Product'}</button>
        </div>
      </form>
    </div>
  );
}
