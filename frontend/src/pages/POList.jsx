import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import StatusChip from '../components/StatusChip.jsx';
import { Money } from '../components/DataTable.jsx';

export default function POList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', search: '', from: '', to: '', departmentId: '', sectionId: '' });
  const [error, setError] = useState('');
  const pageSize = 20;

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data.data)).catch(() => {});
    api.get('/sections').then((r) => setSections(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = { page, pageSize };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/purchase-orders', { params })
      .then((r) => { setRows(r.data.data); setTotal(r.data.total); setError(''); })
      .catch((e) => setError(errMessage(e)));
  }, [page, filters]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <h1 className="page-title">Purchase Orders</h1>
      <p className="page-sub">{total} orders in your authorized scope (RB-018)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row">
          <label className="field grow">
            <span className="field-label">Search (PO no / supplier / section)</span>
            <input value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} placeholder="PO-DVG-2026-…" />
          </label>
          <label className="field">
            <span className="field-label">Department (segregation)</span>
            <select value={filters.departmentId} onChange={(e) => { setPage(1); setFilters({ ...filters, departmentId: e.target.value, sectionId: '' }); }}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Section</span>
            <select value={filters.sectionId} onChange={(e) => { setPage(1); setFilters({ ...filters, sectionId: e.target.value }); }}>
              <option value="">All sections</option>
              {(filters.departmentId ? sections.filter((x) => x.department_id === filters.departmentId) : sections).map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
              <option value="">All statuses</option>
              {['draft','submitted','under_review','approved','issued','partially_received','received','closed'].map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input type="date" value={filters.from} onChange={(e) => { setPage(1); setFilters({ ...filters, from: e.target.value }); }} />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input type="date" value={filters.to} onChange={(e) => { setPage(1); setFilters({ ...filters, to: e.target.value }); }} />
          </label>
        </div>

        <table className="grid">
          <thead>
            <tr>
              <th>PO Number</th><th>Date</th><th>Version</th><th>Status</th>
              <th>Supplier</th><th>Department</th><th>Section</th><th className="num">Qty</th><th className="num">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => navigate(`/purchase-orders/${p.id}`)}>
                <td className="mono">{p.po_number}</td>
                <td>{new Date(p.po_date).toLocaleDateString("en-IN")}</td>
                <td>v{p.version}</td>
                <td><StatusChip status={p.status} /></td>
                <td>{p.supplier_name}</td>
                <td>{p.department_name}</td>
                <td>{p.section_name}</td>
                <td className="num">{p.total_quantity}</td>
                <td className="num"><Money value={p.grand_total} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">No purchase orders match the filters.</td></tr>}
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
