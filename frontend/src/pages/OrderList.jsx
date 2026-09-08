import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import StatusChip from '../components/StatusChip.jsx';
import { Money } from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';

const STATUS_OPTIONS = [
  'draft','submitted','approved','rejected','assigned',
  'in_production','quality_check','production_completed',
  'ready_for_delivery','delivered','completed','cancelled',
];

export default function OrderList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', status: '', from: '', to: '' });
  const [error, setError] = useState('');
  const limit = 20;

  useEffect(() => {
    const params = { page, limit };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/om-orders', { params })
      .then((r) => { setRows(r.data.data); setTotal(r.data.total); setError(''); })
      .catch((e) => setError(errMessage(e)));
  }, [page, filters]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">OM Orders</h1>
          <p className="page-sub">{total} orders</p>
        </div>
        <button className="btn primary" onClick={() => navigate('/om-orders/new')}>
          <Icon name="plus" /> New Order
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row">
          <label className="field grow">
            <span className="field-label">Search</span>
            <input
              value={filters.q}
              onChange={(e) => { setPage(1); setFilters({ ...filters, q: e.target.value }); }}
              placeholder="Order number / customer…"
            />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              value={filters.status}
              onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => { setPage(1); setFilters({ ...filters, from: e.target.value }); }}
            />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => { setPage(1); setFilters({ ...filters, to: e.target.value }); }}
            />
          </label>
        </div>

        <table className="grid">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Required Date</th>
              <th>Priority</th>
              <th>Status</th>
              <th className="num">Total</th>
              <th>Created By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="clickable" onClick={() => navigate(`/om-orders/${o.id}`)}>
                <td className="mono">{o.order_number}</td>
                <td>{o.customer_name}</td>
                <td>{new Date(o.order_date).toLocaleDateString('en-IN')}</td>
                <td>{new Date(o.required_date).toLocaleDateString('en-IN')}</td>
                <td>{o.priority}</td>
                <td><StatusChip status={o.status} /></td>
                <td className="num"><Money value={o.grand_total} /></td>
                <td>{o.created_by_name}</td>
                <td>
                  <button
                    className="btn sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/om-orders/${o.id}`); }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">No orders match the filters.</td></tr>}
          </tbody>
        </table>

        <div className="row mt">
          <span className="muted">Page {page} of {pages}</span>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </div>
    </div>
  );
}
