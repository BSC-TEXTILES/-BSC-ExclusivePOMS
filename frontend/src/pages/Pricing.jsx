import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Pricing() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    api.get('/pricing', { params: { page, limit: 20, search } })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); })
      .catch((e) => setError(errMessage(e)));
    api.get('/pricing/stats').then((r) => setStats(r.data.data)).catch(() => {});
  };
  useEffect(load, [page, search]);

  const savePrice = async (id) => {
    try {
      await api.patch(`/pricing/${id}`, { purchasePrice: Number(editForm.purchase_price), sellingPrice: Number(editForm.selling_price) });
      setEditing(null); load();
    } catch (e) { setError(errMessage(e)); }
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Pricing</h1><p className="page-sub" style={{ margin: 0 }}>Manage product purchase and selling prices (INR)</p></div>
      </div>
      {error && <div className="alert error">{error}</div>}

      {stats && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 18 }}>
          <div className="kpi-card"><div className="kpi-info"><div className="kpi-label">Total Products</div><div className="kpi-value">{stats.total_products}</div></div></div>
          <div className="kpi-card"><div className="kpi-info"><div className="kpi-label">Total Inventory Value</div><div className="kpi-value">{INR(stats.total_selling_value)}</div></div></div>
          <div className="kpi-card"><div className="kpi-info"><div className="kpi-label">Avg Margin</div><div className="kpi-value">{Number(stats.avg_margin).toFixed(1)}%</div></div></div>
          <div className="kpi-card"><div className="kpi-info"><div className="kpi-label">Avg Profit/Unit</div><div className="kpi-value">{INR(stats.avg_profit)}</div></div></div>
        </div>
      )}

      <div className="panel">
        <label className="field" style={{ maxWidth: 300 }}><span className="field-label">Search</span>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search products…" />
        </label>
        <table className="grid">
          <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Brand</th><th>Purchase ₹</th><th>Selling ₹</th><th>Profit ₹</th><th>Margin %</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.sku}</td>
                <td><Link to={`/products/${r.id}`} style={{ fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>{r.name}</Link></td>
                <td>{r.category_name || '—'}</td>
                <td>{r.brand_name || '—'}</td>
                {editing === r.id ? (
                  <>
                    <td><input type="number" value={editForm.purchase_price} onChange={(e) => setEditForm({ ...editForm, purchase_price: e.target.value })} style={{ width: 100, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 6 }} /></td>
                    <td><input type="number" value={editForm.selling_price} onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })} style={{ width: 100, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 6 }} /></td>
                  </>
                ) : (
                  <>
                    <td className="num">{INR(r.purchase_price)}</td>
                    <td className="num">{INR(r.selling_price)}</td>
                  </>
                )}
                <td className="num" style={{ color: Number(r.profit_amount) >= 0 ? '#10b981' : '#ef4444' }}>{INR(r.profit_amount)}</td>
                <td className="num">{Number(r.profit_margin || 0).toFixed(1)}%</td>
                <td>
                  {editing === r.id ? (
                    <><button className="btn sm ok" onClick={() => savePrice(r.id)}>Save</button> <button className="btn sm" onClick={() => setEditing(null)}>Cancel</button></>
                  ) : (
                    <button className="btn sm" onClick={() => { setEditing(r.id); setEditForm({ purchase_price: r.purchase_price, selling_price: r.selling_price }); }}>Edit Price</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No products found</td></tr>}
          </tbody>
        </table>
        {total > 20 && <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Page {page} of {Math.ceil(total / 20)}</span>
          <button className="btn sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next →</button>
        </div>}
      </div>
    </div>
  );
}
