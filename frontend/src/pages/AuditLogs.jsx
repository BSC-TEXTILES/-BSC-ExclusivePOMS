import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ actionType: '', entityType: '', from: '', to: '' });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/audit-logs', { params }).then((r) => setRows(r.data.data)).catch((e) => setError(errMessage(e)));
  }, [filters]);

  return (
    <div className="page">
      <h1 className="page-title">Audit Trail</h1>
      <p className="page-sub">Immutable event stream — user, timestamp, action and before/after state (§17.1, SC-8)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row">
          <label className="field grow"><span className="field-label">Action type</span>
            <input value={filters.actionType} onChange={(e) => setFilters({ ...filters, actionType: e.target.value })} placeholder="create / edit / approve / receive…" />
          </label>
          <label className="field grow"><span className="field-label">Entity type</span>
            <input value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })} placeholder="purchase_order / section / user…" />
          </label>
          <label className="field"><span className="field-label">From</span>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </label>
          <label className="field"><span className="field-label">To</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </label>
        </div>

        <table className="grid">
          <thead>
            <tr><th>When</th><th>Actor</th><th>Role</th><th>Action</th><th>Entity</th><th>Division</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <>
                <tr key={a.id} className="clickable" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                  <td className="mono">{new Date(a.occurred_at).toLocaleString('en-IN')}</td>
                  <td>{a.user_name || 'System'}</td>
                  <td className="muted">{a.user_role}</td>
                  <td><strong>{a.action_type}</strong></td>
                  <td>{a.entity_type}</td>
                  <td>{a.division_code || '—'}</td>
                  <td>{a.before_value || a.after_value ? '▸' : ''}</td>
                </tr>
                {expanded === a.id && (
                  <tr key={`${a.id}-x`}><td colSpan={7} style={{ background: '#0f172a' }}>
                    <div className="json-box">
                      {a.before_value && <div>BEFORE: {JSON.stringify(typeof a.before_value === 'string' ? JSON.parse(a.before_value) : a.before_value, null, 2)}</div>}
                      {a.after_value && <div>AFTER: {JSON.stringify(typeof a.after_value === 'string' ? JSON.parse(a.after_value) : a.after_value, null, 2)}</div>}
                      {a.reason && <div>REASON: {a.reason}</div>}
                      {!a.before_value && !a.after_value && <div>no value diff</div>}
                    </div>
                  </td></tr>
                )}
              </>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">No audit events match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
