import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { Money } from '../components/DataTable.jsx';
import Icon from '../components/Icon.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports/dashboard').then((r) => setData(r.data)).catch((e) => setError(errMessage(e)));
  }, []);

  if (error) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">Loading dashboard…</p></div>;

  const { kpis, byDivision, byStatus, bySection, bySupplier, recentAudit, divisionAdmins } = data;

  return (
    <div className="page">
      <h1 className="page-title">Procurement Dashboard</h1>
      <p className="page-sub">Division-scoped overview of the purchase-order lifecycle (§16)</p>

      <div className="kpis">
        <div className="kpi"><div className="k-label">Total POs</div><div className="k-value">{kpis.total_pos}</div><div className="k-note">all statuses in scope</div></div>
        <div className="kpi"><div className="k-label">Total Purchase Value</div><div className="k-value"><Money value={kpis.total_value} /></div></div>
        <div className="kpi"><div className="k-label">Pending Approvals</div><div className="k-value">{kpis.pending_approvals}</div><div className="k-note">submitted / under review</div></div>
        <div className="kpi"><div className="k-label">Issued</div><div className="k-value">{kpis.issued}</div></div>
        <div className="kpi"><div className="k-label">Partially Received</div><div className="k-value">{kpis.partially_received}</div></div>
        <div className="kpi"><div className="k-label">Completed</div><div className="k-value">{kpis.completed}</div><div className="k-note">received / closed</div></div>
      </div>

      {!!divisionAdmins?.length && (
        <div className="panel">
          <h3>Divisions — each fully controlled by its domain admins</h3>
          <div className="division-cards">
            {divisionAdmins.map((d) => (
              <div key={d.division_id} className="division-card">
                <Icon name="building" size={18} className="div-icon" />
                <div className="grow">
                  <strong>{d.division_name}</strong> <span className="mono muted">{d.division_code}</span>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {d.admins?.length
                      ? <>Domain admin: {d.admins.map((a) => (
                          <span key={a.id} className="admin-pill">
                            {a.photo ? <img src={a.photo} alt="" /> : <span className="admin-initials">{(a.name || '?').slice(0, 1)}</span>}
                            {a.name}
                          </span>
                        ))}</>
                      : <em>no domain admin assigned — super admin controls this division</em>}
                  </div>
                </div>
                <div className="division-kpis">
                  {(() => {
                    const row = byDivision.find((b) => b.code === d.division_code);
                    return <>
                      <span><strong>{row?.pos ?? 0}</strong> POs</span>
                      <span><strong><Money value={row?.value ?? 0} /></strong></span>
                    </>;
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row">
        <div className="panel grow" style={{ minWidth: 340 }}>
          <h3>Division Breakdown</h3>
          <table className="grid">
            <thead><tr><th>Division</th><th className="num">POs</th><th className="num">Value</th></tr></thead>
            <tbody>
              {byDivision.map((d) => (
                <tr key={d.code}><td>{d.name}</td><td className="num">{d.pos}</td><td className="num"><Money value={d.value} /></td></tr>
              ))}
              {!byDivision.length && <tr><td colSpan={3} className="muted">No purchase orders yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel grow" style={{ minWidth: 300 }}>
          <h3>Status Mix</h3>
          <table className="grid">
            <thead><tr><th>Status</th><th className="num">Count</th><th className="num">Value</th></tr></thead>
            <tbody>
              {byStatus.map((s) => (
                <tr key={s.status}><td>{s.status.replace(/_/g, ' ')}</td><td className="num">{s.count}</td><td className="num"><Money value={s.value} /></td></tr>
              ))}
              {!byStatus.length && <tr><td colSpan={3} className="muted">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="row">
        <div className="panel grow" style={{ minWidth: 340 }}>
          <h3>Section Spend</h3>
          <table className="grid">
            <thead><tr><th>Department</th><th>Section</th><th className="num">POs</th><th className="num">Value</th></tr></thead>
            <tbody>
              {bySection.map((s) => (
                <tr key={s.section}><td>{s.department}</td><td>{s.section}</td><td className="num">{s.pos}</td><td className="num"><Money value={s.value} /></td></tr>
              ))}
              {!bySection.length && <tr><td colSpan={4} className="muted">—</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel grow" style={{ minWidth: 300 }}>
          <h3>Top Suppliers</h3>
          <table className="grid">
            <thead><tr><th>Supplier</th><th className="num">POs</th><th className="num">Value</th></tr></thead>
            <tbody>
              {bySupplier.map((s) => (
                <tr key={s.company_name}><td>{s.company_name}</td><td className="num">{s.pos}</td><td className="num"><Money value={s.value} /></td></tr>
              ))}
              {!bySupplier.length && <tr><td colSpan={3} className="muted">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Recent Activity (audit stream)</h3>
        <ul className="timeline">
          {recentAudit.map((a, i) => (
            <li key={i}>
              <div className="t-time">{new Date(a.occurred_at).toLocaleString('en-IN')}</div>
              <strong>{a.action_type}</strong> on {a.entity_type.replace(/_/g, ' ')} — {a.actor}
              {a.entity_type === 'purchase_order' && <Link className="right" to={`/purchase-orders/${a.entity_id}`}>view</Link>}
            </li>
          ))}
          {!recentAudit.length && <li className="muted">No audit events yet.</li>}
        </ul>
      </div>
    </div>
  );
}
