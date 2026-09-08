import { useState, useEffect, useCallback } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Modal from '../components/Modal.jsx';

const STATUS_OPTIONS = ['pending', 'started', 'in_progress', 'paused', 'completed', 'delayed'];

export default function Production() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('supervisor');

  const [dashboard, setDashboard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyActivity, setDailyActivity] = useState(null);

  const limit = 20;

  const loadDashboard = useCallback(() => {
    api.get('/production/dashboard')
      .then((r) => setDashboard(r.data))
      .catch((e) => setError(errMessage(e)));
  }, []);

  const loadTasks = useCallback(() => {
    setLoading(true);
    const params = { page, limit };
    if (statusFilter) params.status = statusFilter;
    api.get('/production/tasks', { params })
      .then((r) => { setTasks(r.data.data); setTotal(r.data.total); setError(''); })
      .catch((e) => setError(errMessage(e)))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const loadDailyActivity = useCallback(() => {
    if (!isAdmin) return;
    api.get('/production/daily-activity')
      .then((r) => setDailyActivity(r.data))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(loadDashboard, [loadDashboard]);
  useEffect(loadTasks, [loadTasks]);
  useEffect(loadDailyActivity, [loadDailyActivity]);

  const pages = Math.max(1, Math.ceil(total / limit));

  function startTask(id) {
    if (!window.confirm('Start this task?')) return;
    api.post(`/production/tasks/${id}/start`)
      .then(() => { loadTasks(); loadDashboard(); })
      .catch((e) => setError(errMessage(e)));
  }

  // Update-status modal state
  const [updating, setUpdating] = useState(null); // task object
  const [updateForm, setUpdateForm] = useState({ status: '', notes: '' });
  const [saving, setSaving] = useState(false);

  function openUpdate(task) {
    setUpdating(task);
    setUpdateForm({ status: 'in_progress', notes: '' });
  }

  async function submitUpdate() {
    if (!updating || !updateForm.status) return;
    setSaving(true);
    try {
      await api.post(`/production/tasks/${updating.id}/update`, {
        status: updateForm.status,
        notes: updateForm.notes || undefined,
      });
      setUpdating(null);
      loadTasks();
      loadDashboard();
    } catch (e) { setError(errMessage(e)); } finally { setSaving(false); }
  }

  return (
    <div className="page">
      <h1 className="page-title">Production</h1>
      <p className="page-sub">Manage production tasks, track progress and daily activity</p>
      {error && <div className="alert error">{error}</div>}

      {/* Dashboard KPIs */}
      {dashboard && (
        <div className="kpis">
          <div className="kpi"><div className="k-value">{dashboard.total_tasks ?? '—'}</div><div className="k-label">Total Tasks</div></div>
          <div className="kpi"><div className="k-value">{dashboard.pending ?? '—'}</div><div className="k-label">Pending</div></div>
          <div className="kpi"><div className="k-value">{dashboard.in_progress ?? '—'}</div><div className="k-label">In Progress</div></div>
          <div className="kpi"><div className="k-value">{dashboard.completed ?? '—'}</div><div className="k-label">Completed</div></div>
          <div className="kpi"><div className="k-value">{dashboard.overdue ?? '—'}</div><div className="k-label">Overdue</div></div>
          <div className="kpi"><div className="k-value">{dashboard.total_users ?? '—'}</div><div className="k-label">Total Users</div><div className="k-note">{dashboard.production_users ?? 0} production</div></div>
          <div className="kpi"><div className="k-value">{dashboard.active_today ?? '—'}</div><div className="k-label">Active Today</div></div>
        </div>
      )}

      {/* Task List */}
      <div className="panel">
        <div className="row" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <span className="muted" style={{ marginLeft: 'auto' }}>{total} tasks</span>
        </div>

        <table className="grid">
          <thead>
            <tr>
              <th>Order#</th>
              <th>Product</th>
              <th>Image</th>
              <th>Sheet/Color</th>
              <th>Size</th>
              <th className="num">Qty</th>
              <th>Assigned To</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className={t.status === 'delayed' ? 'row-dim' : ''}>
                <td className="mono">{t.order_number || t.order_id}</td>
                <td>{t.product_name}</td>
                <td>
                  {t.image_url
                    ? <img src={t.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                    : <span className="muted">—</span>}
                </td>
                <td>{t.sheet_color || t.sheet || '—'}{t.color ? ` / ${t.color}` : ''}</td>
                <td>{t.size || '—'}</td>
                <td className="num">{t.quantity}</td>
                <td>{t.assigned_to_name || '—'}</td>
                <td>{t.priority || '—'}</td>
                <td><StatusChip status={t.status} /></td>
                <td>{t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : '—'}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {t.status === 'pending' && (
                      <button className="btn sm primary" onClick={() => startTask(t.id)}>
                        <Icon name="play" size={13} /> Start
                      </button>
                    )}
                    {t.status !== 'completed' && (
                      <button className="btn sm" onClick={() => openUpdate(t)}>
                        <Icon name="edit" size={13} /> Update Status
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!tasks.length && !loading && <tr><td colSpan={11} className="muted">No tasks match the filter.</td></tr>}
            {loading && <tr><td colSpan={11} className="muted">Loading…</td></tr>}
          </tbody>
        </table>

        <div className="row mt">
          <span className="muted">Page {page} of {pages}</span>
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </div>

      {/* Daily Activity (admin / supervisor only) */}
      {isAdmin && dailyActivity && (
        <div className="panel mt">
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Daily Activity</h2>
          {dailyActivity.activities?.length > 0 ? (
            <table className="grid">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Task</th>
                  <th>From Status</th>
                  <th>To Status</th>
                  <th>Notes</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {dailyActivity.activities.map((a, i) => (
                  <tr key={i}>
                    <td>{a.user_name}</td>
                    <td className="mono">{a.task_id}</td>
                    <td><StatusChip status={a.from_status} /></td>
                    <td><StatusChip status={a.to_status} /></td>
                    <td className="muted">{a.notes || '—'}</td>
                    <td>{a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No activity recorded today.</p>
          )}
        </div>
      )}

      {/* Update Status Modal */}
      {updating && (
        <Modal title={`Update Task — ${updating.product_name || updating.id}`} onClose={() => setUpdating(null)}>
          <label className="field">
            <span className="field-label">New Status</span>
            <select
              value={updateForm.status}
              onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
            >
              {STATUS_OPTIONS.filter((s) => s !== 'pending').map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Notes (optional)</span>
            <textarea
              rows={3}
              value={updateForm.notes}
              onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
              placeholder="Add any notes about this status change…"
            />
          </label>
          <div className="row">
            <button className="btn primary" disabled={saving || !updateForm.status} onClick={submitUpdate}>
              {saving ? 'Saving…' : 'Update'}
            </button>
            <button className="btn" onClick={() => setUpdating(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
