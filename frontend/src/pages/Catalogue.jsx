import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errMessage, fileKind } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import ProductGallery from '../components/ProductGallery.jsx';
import { Field } from '../components/DataTable.jsx';

// Product Catalogue — browses the full 1000+ SKU catalogue with server-side
// search / department / section / brand filters + pagination (§10, SC-6).
// Cascading filters: Department → Section → Brand → Products
export default function Catalogue() {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const canManage = hasPermission('masters.manage');
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [brands, setBrands] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: searchParams.get('q') || '',
    departmentId: searchParams.get('departmentId') || '',
    sectionId: searchParams.get('sectionId') || '',
    brandId: searchParams.get('brandId') || '',
  });
  const [galleryProduct, setGalleryProduct] = useState(null);
  const pageSize = 20;

  // Load departments on mount
  useEffect(() => {
    api.get('/departments')
      .then((r) => setDepartments(r.data.data || []))
      .catch((e) => setError(errMessage(e)));
  }, []);

  // Load sections filtered by department (cascading)
  useEffect(() => {
    const params = { status: 'active' };
    if (filters.departmentId) params.departmentId = filters.departmentId;
    api.get('/sections', { params })
      .then((r) => setSections(r.data.data || []))
      .catch(() => {});
  }, [filters.departmentId]);

  // Load brands filtered by section (cascading)
  useEffect(() => {
    const params = {};
    if (filters.sectionId) params.sectionId = filters.sectionId;
    else if (filters.departmentId) params.departmentId = filters.departmentId;
    api.get('/brands', { params })
      .then((r) => setBrands(r.data.data || []))
      .catch(() => {});
  }, [filters.sectionId, filters.departmentId]);

  const load = useCallback(() => {
    const params = { page, pageSize };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/products', { params })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); setError(''); })
      .catch((e) => setError(errMessage(e)));
  }, [page, filters]);

  useEffect(load, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Cascading setF: resets downstream filters
  const setF = (patch) => {
    setPage(1);
    const next = { ...filters, ...patch };
    if ('departmentId' in patch && patch.departmentId !== filters.departmentId) {
      next.sectionId = '';
      next.brandId = '';
    }
    if ('sectionId' in patch && patch.sectionId !== filters.sectionId) {
      next.brandId = '';
    }
    setFilters(next);
  };

  return (
    <div className="page">
      <h1 className="page-title">Product Catalogue</h1>
      <p className="page-sub">{total.toLocaleString('en-IN')} products across every department — brand, manufacturer and provider visible for informed choosing (§10)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row">
          <label className="field grow"><span className="field-label">Search (product / SKU / brand)</span>
            <input value={filters.search} onChange={(e) => setF({ search: e.target.value })} placeholder="e.g. silk saree, jeans, Levi's…" />
          </label>
          <label className="field"><span className="field-label">Department</span>
            <select value={filters.departmentId} onChange={(e) => setF({ departmentId: e.target.value })}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Section</span>
            <select value={filters.sectionId} onChange={(e) => setF({ sectionId: e.target.value })}>
              <option value="">All sections</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Brand</span>
            <select value={filters.brandId} onChange={(e) => setF({ brandId: e.target.value })}>
              <option value="">All brands</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
            </select>
          </label>
        </div>

        {/* Active filter chips */}
        {(filters.departmentId || filters.sectionId || filters.brandId || filters.search) && (
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6b7280', lineHeight: '28px' }}>Active filters:</span>
            {filters.search && (
              <span style={{ fontSize: 12, background: '#ede9fe', color: '#6d28d9', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                Search: "{filters.search}" <button onClick={() => setF({ search: '' })} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#6d28d9', cursor: 'pointer', fontWeight: 800 }}>×</button>
              </span>
            )}
            {filters.departmentId && (
              <span style={{ fontSize: 12, background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                Dept: {departments.find((d) => d.id === filters.departmentId)?.name}
                <button onClick={() => setF({ departmentId: '' })} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontWeight: 800 }}>×</button>
              </span>
            )}
            {filters.sectionId && (
              <span style={{ fontSize: 12, background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                Section: {sections.find((s) => s.id === filters.sectionId)?.name}
                <button onClick={() => setF({ sectionId: '' })} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 800 }}>×</button>
              </span>
            )}
            {filters.brandId && (
              <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                Brand: {brands.find((b) => b.id === filters.brandId)?.brand_name}
                <button onClick={() => setF({ brandId: '' })} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontWeight: 800 }}>×</button>
              </span>
            )}
            <button
              onClick={() => { setFilters({ search: '', departmentId: '', sectionId: '', brandId: '' }); setPage(1); }}
              style={{ fontSize: 11, background: '#f3f4f6', border: '1px solid #d1d5db', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', color: '#374151', fontWeight: 600 }}
            >
              Clear all
            </button>
          </div>
        )}

        <table className="grid">
          <thead>
            <tr><th>Product</th><th>Image</th><th>Brand</th><th>Manufacturer</th><th>Providers (dealers)</th><th>Department</th><th>Section</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><div className="mono muted">{p.sku} · {p.product_serial}</div></td>
                <td>
                  <button className="thumb" title="Open gallery" onClick={() => setGalleryProduct(p)}>
                    {p.primary_image_key
                      ? <img src={`/uploads/${p.primary_image_key.split(/[\\/]/).join('/')}`} alt={p.name} loading="lazy" />
                      : <span className="thumb-empty"><Icon name="image" size={16} /></span>}
                    {!!p.image_count && p.image_count > 0 && <span className="thumb-count">{p.image_count}</span>}
                  </button>
                </td>
                <td>{p.brand_name}<div className="mono muted">{p.brand_number}</div></td>
                <td>{p.manufacturer || '—'}</td>
                <td className="muted">{(p.providers || []).join(', ') || '—'}</td>
                <td>{p.department_name}</td>
                <td>{p.section_name}</td>
                <td>{p.status}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">No products match the filters.</td></tr>}
          </tbody>
        </table>

        <div className="row mt">
          <span className="muted">Page {page} of {pages} · {total.toLocaleString('en-IN')} products</span>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </div>

      {galleryProduct && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setGalleryProduct(null)}>
          <div className="modal wide">
            <div className="modal-head">
              <h3>{galleryProduct.name} <span className="mono muted">· {galleryProduct.sku}</span></h3>
              <button className="icon-btn" onClick={() => setGalleryProduct(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body">
              <ProductGallery product={galleryProduct} canManage={canManage} onChanged={load} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
