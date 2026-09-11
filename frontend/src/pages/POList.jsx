import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE, errMessage } from '../api.js';
import StatusChip from '../components/StatusChip.jsx';
import { Money } from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import CSVImportModal from '../components/CSVImportModal.jsx';
import { useAuth } from '../auth.jsx';

export default function POList() {
  const navigate = useNavigate();
  const { selectedSectionId, hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', search: '', from: '', to: '', departmentId: '', sectionId: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const pageSize = 20;

  // Apply section filter from auth context if a section is selected
  useEffect(() => {
    if (selectedSectionId) {
      setFilters((f) => ({ ...f, sectionId: selectedSectionId }));
    }
  }, [selectedSectionId]);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data.data || [])).catch(() => {});
    api.get('/sections').then((r) => setSections(r.data.data || [])).catch(() => {});
  }, []);

  const loadData = useCallback(() => {
    const params = { page, pageSize };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/purchase-orders', { params })
      .then((r) => { setRows(r.data.data || []); setTotal(r.data.total || 0); setError(''); })
      .catch((e) => setError(errMessage(e)));
  }, [page, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const token = localStorage.getItem('poms_token');
      const res = await fetch(`${API_BASE}/purchase-orders/export/csv?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchase_orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Export failed');
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Purchase Orders</h1>
          <p className="page-sub" style={{ margin: '4px 0 0 0' }}>
            {total} orders in your authorized scope
            {selectedSectionId && <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 13 }}> · Filtered by section</span>}
          </p>
        </div>
        <div className="right row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {selectedSectionId && (
            <button className="btn ghost sm" onClick={() => { setFilters({ ...filters, sectionId: '' }); localStorage.removeItem('poms_selected_section'); }} title="Clear section filter">
              <Icon name="x" size={14} /> Clear Section Filter
            </button>
          )}
          <button className="btn sm" onClick={exportCsv} title="Export all matching POs to CSV">
            <Icon name="reports" size={14} /> Export to CSV
          </button>
          {(hasPermission('po.create') || hasPermission('masters.manage')) && (
            <button className="btn sm" onClick={() => setShowCsvModal(true)} title="Upload product catalogs and inventory from CSV">
              <Icon name="upload" size={14} /> Upload CSV
            </button>
          )}
          {hasPermission('po.create') && (
            <button className="btn primary sm" onClick={() => navigate('/purchase-orders/new')} title="Create new Purchase Order with guided wizard">
              <Icon name="plus" size={14} /> Create Purchase Order
            </button>
          )}
        </div>
      </div>

      {notice && <div className="alert ok">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <CSVImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onSuccess={(summary) => {
          setNotice(`CSV Import Completed: ${summary.productsInserted} products added, ${summary.productsUpdated} updated, ${summary.newBrandsCreated} brands created.`);
          loadData();
        }}
      />

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
                <td>{new Date(p.po_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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
