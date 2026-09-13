import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import api, { API_BASE, errMessage } from '../api.js';
import StatusChip from '../components/StatusChip.jsx';
import { Money } from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';
import CSVImportModal from '../components/CSVImportModal.jsx';
import { useAuth } from '../auth.jsx';

const PO_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'issued', 'partially_received', 'received', 'closed'];

// Donezo-style KPI cards: status groups inside the authorized scope.
// `apply` is the representative single status set when the card is clicked.
const KPI_CARDS = [
  { key: 'received', title: 'Received', statuses: ['received', 'closed'], apply: 'received', note: 'Completed & closed orders' },
  { key: 'progress', title: 'In Progress', statuses: ['submitted', 'under_review', 'approved', 'issued', 'partially_received'], apply: 'issued', note: 'Approval & delivery pipeline' },
  { key: 'draft', title: 'Drafts', statuses: ['draft'], apply: 'draft', note: 'Saved drafts awaiting submission' },
];

const EMPTY_FILTERS = { status: '', search: '', from: '', to: '', departmentId: '', sectionId: '' };

// dd-mm-yyyy display text for the From/To date hints.
function dmy(value) {
  if (!value) return 'dd-mm-yyyy';
  const [y, m, d] = value.split('-');
  return `${d}-${m}-${y}`;
}

function countByStatuses(counts, statuses) {
  return statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
}

function kpisFromCounts(counts, total) {
  return {
    total,
    received: countByStatuses(counts, KPI_CARDS[0].statuses),
    progress: countByStatuses(counts, KPI_CARDS[1].statuses),
    draft: countByStatuses(counts, KPI_CARDS[2].statuses),
  };
}

export default function POList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedSectionId, hasPermission } = useAuth();
  const { getToken } = useClerkAuth();
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const initialStatus = searchParams.get('status') || '';
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, status: initialStatus });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [kpis, setKpis] = useState(null);
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

  // KPI totals across the whole authorized scope (status-group counts for the
  // Donezo-style cards). One light request normally suffices; per-status
  // counts are the fallback for scopes larger than a single page.
  const loadScopeKpis = useCallback(async () => {
    try {
      const { data: res } = await api.get('/purchase-orders', { params: { page: 1, pageSize: 100 } });
      const all = res.data || [];
      const totalAll = res.total || 0;
      let counts;
      if (all.length >= totalAll) {
        // The entire scope fits in one page — count exactly from the rows.
        counts = {};
        all.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
      } else {
        // Large scope — fall back to one lightweight count request per status.
        const results = await Promise.all(
          PO_STATUSES.map((s) => api.get('/purchase-orders', { params: { page: 1, pageSize: 1, status: s } })),
        );
        counts = Object.fromEntries(PO_STATUSES.map((s, i) => [s, results[i].data.total || 0]));
      }
      setKpis(kpisFromCounts(counts, totalAll));
    } catch {
      /* KPI cards stay decorative — never block the register on failure. */
    }
  }, []);

  useEffect(() => {
    loadScopeKpis();
  }, [loadScopeKpis]);

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const token = await getToken();
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

  function setFilter(patch) {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  }

  function applyStatus(status) {
    setFilter({ status });
  }

  function resetFilters() {
    setPage(1);
    setFilters({ ...EMPTY_FILTERS });
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const deptName = (id) => departments.find((d) => d.id === id)?.name;
  const secName = (id) => sections.find((s) => s.id === id)?.name;

  const activeChips = [];
  if (filters.search) activeChips.push({ key: 'search', label: `Search: “${filters.search}”`, clear: () => setFilter({ search: '' }) });
  if (filters.departmentId) activeChips.push({ key: 'dept', label: deptName(filters.departmentId) || 'Department', clear: () => setFilter({ departmentId: '', sectionId: '' }) });
  if (filters.sectionId) activeChips.push({ key: 'sec', label: secName(filters.sectionId) || 'Section', clear: () => setFilter({ sectionId: '' }) });
  if (filters.status) activeChips.push({ key: 'status', label: `Status: ${filters.status.replace(/_/g, ' ')}`, clear: () => setFilter({ status: '' }) });
  if (filters.from) activeChips.push({ key: 'from', label: `From ${dmy(filters.from)}`, clear: () => setFilter({ from: '' }) });
  if (filters.to) activeChips.push({ key: 'to', label: `To ${dmy(filters.to)}`, clear: () => setFilter({ to: '' }) });
  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="page">
      {/* ---------- Header — Donezo reference ---------- */}
      <div className="polist-head">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-sub">
            Plan, track and manage purchase orders with ease.
            <span className="polist-scope-pill"><Icon name="check" size={11} /> {total} orders in your authorized scope</span>
            {selectedSectionId && <span className="polist-scope-pill">Filtered by section</span>}
          </p>
        </div>
        <div className="polist-head-actions">
          {selectedSectionId && (
            <button className="btn ghost sm" onClick={() => { setFilter({ sectionId: '' }); localStorage.removeItem('poms_selected_section'); }} title="Clear section filter">
              <Icon name="x" size={14} /> Clear Section Filter
            </button>
          )}
          <button className="btn sm" onClick={exportCsv} title="Export all matching POs to CSV">
            <Icon name="download" size={14} /> Export to CSV
          </button>
          {(hasPermission('po.create') || hasPermission('masters.manage')) && (
            <button className="btn sm" onClick={() => setShowCsvModal(true)} title="Upload product catalogs and inventory from CSV">
              <Icon name="upload" size={14} /> Upload CSV
            </button>
          )}
          {hasPermission('po.create') && (
            <button className="btn accent sm" onClick={() => navigate('/purchase-orders/new')} title="Create new Purchase Order with guided wizard">
              <Icon name="plus" size={14} /> Create Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* ---------- KPI cards — status groups in scope (Donezo reference) ---------- */}
      <div className="donezo-kpis">
        <button type="button" className={`donezo-stat-card polist-card kpi-green${!filters.status ? ' active' : ''}`} onClick={() => applyStatus('')} title="Show all orders">
          <div className="st-head"><span>Total Orders</span> <div className="st-arrow">↗</div></div>
          <div className="st-val">{kpis ? kpis.total : '…'}</div>
          <div className="st-note"><span className="st-up">↗</span> All statuses · authorized scope</div>
        </button>
        {KPI_CARDS.map((card) => (
          <button type="button" key={card.key}
            className={`donezo-stat-card polist-card${filters.status === card.apply ? ' active' : ''}`}
            onClick={() => applyStatus(filters.status === card.apply ? '' : card.apply)}
            title={`Show ${card.title.toLowerCase()} orders`}>
            <div className="st-head"><span>{card.title}</span> <div className="st-arrow">↗</div></div>
            <div className="st-val">{kpis ? kpis[card.key] : '…'}</div>
            <div className="st-note"><span className="st-up">↑</span> {card.note}</div>
          </button>
        ))}
      </div>

      {notice && <div className="alert ok">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <CSVImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onSuccess={(summary) => {
          setNotice(`CSV Import Completed: ${summary.productsInserted} products added, ${summary.productsUpdated} updated, ${summary.newBrandsCreated} brands created.`);
          loadData();
          loadScopeKpis();
        }}
      />

      {/* ---------- Filters — proper labels & inputs ---------- */}
      <div className="panel polist-filter-card">
        <div className="polist-filter-grid">
          <label className="field">
            <span className="field-label">Search (PO no / supplier / section)</span>
            <div className="polist-search">
              <Icon name="search" size={15} />
              <input value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} placeholder="PO-DVG-2026-…" />
            </div>
          </label>
          <label className="field">
            <span className="field-label">Department (segregation)</span>
            <select value={filters.departmentId} onChange={(e) => setFilter({ departmentId: e.target.value, sectionId: '' })}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Section</span>
            <select value={filters.sectionId} onChange={(e) => setFilter({ sectionId: e.target.value })}>
              <option value="">All sections</option>
              {(filters.departmentId ? sections.filter((x) => x.department_id === filters.departmentId) : sections).map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
              <option value="">All statuses</option>
              {PO_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} />
            <span className="field-hint">{dmy(filters.from)}</span>
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} />
            <span className="field-hint">{dmy(filters.to)}</span>
          </label>
          <div className="polist-filter-actions">
            <button className="btn ghost sm" onClick={resetFilters} title="Clear all filters"><Icon name="rotateCw" size={13} /> Reset</button>
          </div>
        </div>
      </div>

      {/* ---------- Register table ---------- */}
      <div className="panel polist-table-card">
        <div className="polist-table-head">
          <div>
            <div className="polist-table-title">Purchase Order Register</div>
            <div className="polist-table-sub">
              {total} {total === 1 ? 'order' : 'orders'} {hasActiveFilters ? 'match the active filters' : 'in your authorized scope'}
            </div>
          </div>
          {hasActiveFilters && (
            <div className="polist-chips">
              {activeChips.map((chip) => (
                <span className="polist-chip" key={chip.key}>
                  {chip.label}
                  <button onClick={chip.clear} title="Remove this filter"><Icon name="x" size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="grid polist-table">
            <thead>
              <tr>
                <th>PO Number</th><th>Date</th><th>Version</th><th>Status</th>
                <th>Supplier</th><th>Department</th><th>Section</th><th className="num">Qty</th><th className="num">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => navigate(`/purchase-orders/${p.id}`)}>
                  <td className="mono"><span className="po-no">{p.po_number}</span></td>
                  <td>{new Date(p.po_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td><span className="chip">v{p.version}</span></td>
                  <td><StatusChip status={p.status} /></td>
                  <td><span className="cell-strong" title={p.supplier_name}>{p.supplier_name}</span></td>
                  <td title={p.department_name}>{p.department_name}</td>
                  <td title={p.section_name}>{p.section_name}</td>
                  <td className="num">{p.total_quantity}</td>
                  <td className="num"><Money value={p.grand_total} /></td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={9}>
                    <div className="polist-empty">
                      <Icon name="search" size={30} />
                      <span>{hasActiveFilters ? 'No purchase orders match the active filters.' : 'No purchase orders in your authorized scope yet.'}</span>
                      {hasActiveFilters && (
                        <button className="btn ghost sm" onClick={resetFilters}><Icon name="rotateCw" size={13} /> Reset filters</button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="polist-pager">
          <span className="polist-pager-info">Page {page} of {pages} · showing {rows.length} of {total}</span>
          <div className="polist-pager-btns">
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
