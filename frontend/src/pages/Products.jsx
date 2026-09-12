import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Products({ gender }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [deleteModal, setDeleteModal] = useState(null);

  const load = () => {
    const params = { page, limit: 20, search, category, brand, status, sort };
    if (gender) params.gender = gender;
    api.get('/products', { params })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
  };
  useEffect(load, [page, search, category, brand, status, sort, gender]);
  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data || [])).catch(() => {});
    api.get('/brands').then((r) => setBrands(r.data.data || [])).catch(() => {});
  }, []);

  const archiveProduct = async (id) => {
    try { await api.patch(`/products/${id}`, { status: 'archived' }); setDeleteModal(null); load(); } catch (e) { setError(errMessage(e)); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">{gender === 'men' ? "Men's Products" : 'Products'}</h1><p className="page-sub" style={{ margin: 0 }}>{gender === 'men' ? "Manage men's apparel collection" : 'Manage product catalogue'}</p></div>
        {(user?.isSuperAdmin || user?.permissions?.includes('products.create')) && (
          <Link to="/products/new" className="btn primary">+ Add Product</Link>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row" style={{ marginBottom: 14 }}>
          <label className="field grow"><span className="field-label">Search</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, SKU…" />
          </label>
          <label className="field"><span className="field-label">Category</span>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Brand</span>
            <select value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Status</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
            </select>
          </label>
          <label className="field"><span className="field-label">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Name</option><option value="sku">SKU</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="updated">Updated</option>
            </select>
          </label>
        </div>

        <table className="grid">
          <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Sizes</th><th>Colors</th><th>Purchase ₹</th><th>Selling ₹</th><th>Profit ₹</th><th>Margin</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="product-cell">
                      <div className="product-thumb">👕</div>
                      <div><div className="product-name">{p.name}</div><div className="product-sku">SKU: {p.sku}</div></div>
                    </div>
                  </Link>
                </td>
                <td>{p.category_name || '—'}</td>
                <td>{p.brand_name || '—'}</td>
                <td><div className="tag-list">{(p.sizes || []).slice(0, 3).map((s, i) => <span key={i} className="tag" style={{ fontSize: 11 }}>{s.label || s}</span>)}{(p.sizes || []).length > 3 && <span className="tag" style={{ fontSize: 11 }}>+{p.sizes.length - 3}</span>}</div></td>
                <td><div className="tag-list">{(p.colours || p.colors || []).slice(0, 2).map((c, i) => <span key={i} className="tag" style={{ fontSize: 11 }}>{c.name || c}</span>)}</div></td>
                <td className="num">{INR(p.purchase_price)}</td>
                <td className="num">{INR(p.selling_price)}</td>
                <td className="num" style={{ color: Number(p.profit_amount) >= 0 ? '#10b981' : '#ef4444' }}>{INR(p.profit_amount)}</td>
                <td className="num">{Number(p.profit_margin || 0).toFixed(1)}%</td>
                <td><span className={`chip st-${p.status}`}>{p.status}</span></td>
                <td>
                  <Link to={`/products/${p.id}`} className="btn sm">View</Link>
                  {(user?.isSuperAdmin || user?.permissions?.includes('products.edit')) && (
                    <> <Link to={`/products/${p.id}/edit`} className="btn sm">Edit</Link></>
                  )}
                  {(user?.isSuperAdmin || user?.permissions?.includes('products.delete')) && (
                    <> <button className="btn sm danger" onClick={() => setDeleteModal(p)}>Archive</button></>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No products found</td></tr>}
          </tbody>
        </table>

        {total > 20 && <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Page {page} of {Math.ceil(total / 20)} ({total} total)</span>
          <button className="btn sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next →</button>
        </div>}
      </div>

      {deleteModal && (
        <Modal title="Archive Product" onClose={() => setDeleteModal(null)}>
          <div className="modal-body">
            <p>Are you sure you want to archive <strong>{deleteModal.name}</strong>?</p>
            <p style={{ fontSize: 12, color: '#6b7280' }}>This product will be marked as archived but will remain in the system for historical reference.</p>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="btn danger" onClick={() => archiveProduct(deleteModal.id)}>Archive</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
