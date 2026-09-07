import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { Money } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Icon from '../components/Icon.jsx';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// PO Calendar — every purchase order sits on its po_date. Click a day to drill
// into that day's orders (count, value, supplier, status) division-scoped.
export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [days, setDays] = useState({});
  const [selected, setSelected] = useState(null);           // 'YYYY-MM-DD'
  const [dayDetail, setDayDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.get('/reports/calendar', { params: { year, month } })
      .then((r) => setDays(Object.fromEntries(r.data.days.map((d) => [d.day, d]))))
      .catch((e) => setError(errMessage(e)));
  }, [year, month]);

  useEffect(() => {
    if (!selected) { setDayDetail(null); return; }
    setDayDetail(null);
    api.get(`/reports/calendar/${selected}`)
      .then((r) => setDayDetail(r.data))
      .catch((e) => setError(errMessage(e)));
  }, [selected]);

  const grid = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startPad = first.getDay();
    const total = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const iso = (d) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const monthTotal = Object.values(days).reduce((s, d) => s + d.count, 0);
  const monthValue = Object.values(days).reduce((s, d) => s + Number(d.value || 0), 0);

  function shift(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y); setSelected(null);
  }

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'baseline' }}>
        <div className="grow">
          <h1 className="page-title">PO Calendar</h1>
          <p className="page-sub">Purchase orders day-wise — click any date to see exactly what was ordered that day (§16)</p>
        </div>
        <div className="cal-nav">
          <button className="btn sm" onClick={() => shift(-1)}><Icon name="chevronLeft" size={14} /></button>
          <strong>{MONTHS[month - 1]} {year}</strong>
          <button className="btn sm" onClick={() => shift(1)}><Icon name="chevronRight" size={14} /></button>
          <button className="btn sm" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelected(null); }}>Today</button>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className={`panel grow cal-panel ${selected ? 'narrow' : ''}`}>
          <div className="cal-summary">
            <span><strong>{monthTotal}</strong> POs in {MONTHS[month - 1]}</span>
            <span className="muted">total <strong><Money value={monthValue} /></strong></span>
          </div>
          <div className="cal-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="cal-grid">
            {grid.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="cal-cell empty" />;
              const info = days[iso(d)];
              const isToday = d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              return (
                <button key={d}
                  className={`cal-cell ${info ? 'has' : ''} ${isToday ? 'today' : ''} ${selected === iso(d) ? 'selected' : ''}`}
                  onClick={() => setSelected(iso(d))}>
                  <span className="cal-day">{d}</span>
                  {info && (
                    <span className="cal-info">
                      <span className="cal-count">{info.count} PO{info.count > 1 ? 's' : ''}</span>
                      <span className="cal-value"><Money value={info.value} /></span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="panel cal-detail" style={{ minWidth: 380, maxWidth: 520 }}>
            {dayDetail ? (
              <>
                <div className="row" style={{ alignItems: 'baseline' }}>
                  <h3 className="grow">{new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                  <button className="icon-btn" onClick={() => setSelected(null)} title="Close"><Icon name="x" size={16} /></button>
                </div>
                <div className="kpis two">
                  <div className="kpi"><div className="k-label">POs this day</div><div className="k-value">{dayDetail.totals?.count ?? 0}</div></div>
                  <div className="kpi"><div className="k-label">Value this day</div><div className="k-value"><Money value={dayDetail.totals?.value ?? 0} /></div></div>
                </div>
                <table className="grid">
                  <thead><tr><th>PO</th><th>Supplier</th><th>Division</th><th>Status</th><th className="num">Value</th></tr></thead>
                  <tbody>
                    {dayDetail.data.map((po) => (
                      <tr key={po.id} className="clickable">
                        <td><Link to={`/purchase-orders/${po.id}`}>{po.po_number}</Link></td>
                        <td>{po.supplier}</td>
                        <td>{po.division}</td>
                        <td><StatusChip status={po.status} /></td>
                        <td className="num"><Money value={po.grand_total} /></td>
                      </tr>
                    ))}
                    {!dayDetail.data.length && <tr><td colSpan={5} className="muted">No purchase orders on this day.</td></tr>}
                  </tbody>
                </table>
              </>
            ) : <p className="muted">Loading {selected}…</p>}
          </div>
        )}
      </div>
    </div>
  );
}
