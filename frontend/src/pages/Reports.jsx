import { useState } from 'react';
import api, { errMessage } from '../api.js';

const REPORTS = [
  { key: 'po-register', label: 'PO Register' },
  { key: 'purchase-summary', label: 'Purchase Summary' },
  { key: 'dealer', label: 'Dealer Report' },
  { key: 'size', label: 'Size Report' },
  { key: 'margin', label: 'Margin Report' },
  { key: 'receiving', label: 'Receiving Report' },
];

// Zero-dependency SVG bar chart — visualises the first numeric column of the
// report so every report view includes a chart alongside the table.
function ReportBarChart({ columns, data }) {
  const numCols = columns.filter((c) => data.some((r) => typeof r[c] === 'number'));
  if (!numCols.length || data.length < 1) return null;
  const valueCol = numCols[0];
  const labelCol = columns.find((c) => !numCols.includes(c)) || columns[0];
  const rows = data.slice(0, 12).map((r) => ({ label: String(r[labelCol] ?? '—'), value: Number(r[valueCol]) || 0 }));
  const max = Math.max(...rows.map((r) => r.value), 1);
  const W = 720, H = 300, PAD_L = 150, PAD_B = 60, PAD_T = 16;
  const chartW = W - PAD_L - 16, chartH = H - PAD_B - PAD_T;
  const bw = rows.length ? chartW / rows.length : 0;
  const fmt = (n) => Math.abs(n) >= 100000 ? (n / 100000).toFixed(1) + 'L' : Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(Math.round(n));
  return (
    <div className="report-chart-panel" id="report-chart">
      <h3 className="chart-title">Chart — {valueCol.replace(/_/g, ' ')} by {labelCol.replace(/_/g, ' ')}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" className="report-chart" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - 16} y1={PAD_T + chartH * (1 - t)} y2={PAD_T + chartH * (1 - t)} stroke="#e5e9f2" strokeWidth="1" />
            <text x={PAD_L - 6} y={PAD_T + chartH * (1 - t) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{fmt(max * t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const h = (r.value / max) * chartH;
          const x = PAD_L + i * bw + bw * 0.15, bwEff = bw * 0.7;
          return (
            <g key={i}>
              <title>{`${r.label}: ${r.value.toLocaleString('en-IN')}`}</title>
              <rect x={x} y={PAD_T + chartH - h} width={Math.max(bwEff, 6)} height={Math.max(h, 1)} rx="3" fill="#1d4ed8" opacity={0.85} />
              <text x={x + Math.max(bwEff, 6) / 2} y={PAD_T + chartH - h - 5} textAnchor="middle" fontSize="9" fill="#374151">{fmt(r.value)}</text>
              <text x={x + Math.max(bwEff, 6) / 2} y={PAD_T + chartH + 14} textAnchor="middle" fontSize="9" fill="#4b5563">
                {r.label.length > 14 ? r.label.slice(0, 13) + '…' : r.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Reports() {
  const [report, setReport] = useState('po-register');
  const [range, setRange] = useState({ from: '', to: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setError('');
    try {
      const params = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const { data } = await api.get(`/reports/${report}`, { params });
      setResult(data);
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function exportCsv() {
    try {
      const params = { format: 'csv' };
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const res = await api.get(`/reports/${report}`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${report}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(errMessage(e)); }
  }

  return (
    <div className="page">
      <h1 className="page-title">Reports</h1>
      <p className="page-sub">Operational and management reporting with CSV export (§16.3, §16.4)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field"><span className="field-label">Report</span>
            <select value={report} onChange={(e) => { setReport(e.target.value); setResult(null); }}>
              {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">From</span>
            <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label className="field"><span className="field-label">To</span>
            <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
          <button className="btn primary" disabled={busy} onClick={run}>{busy ? 'Running…' : 'Run report'}</button>
          {result && <button className="btn accent" onClick={exportCsv}>⬇ Export CSV</button>}
          {result && result.data.length > 0 && <button className="btn" onClick={() => window.print()}>🖨 Print</button>}
        </div>

        {result && (
          <div className="mt" id="report-print-area">
            {result.data.length === 0 && <p className="muted">No rows for the selected range.</p>}
            {result.data.length > 0 && (
              <>
                <ReportBarChart columns={result.columns} data={result.data} />
                <table className="grid">
                  <thead><tr>{result.columns.map((c) => <th key={c} className={typeof result.data[0][c] === 'number' ? 'num' : ''}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                  <tbody>
                    {result.data.slice(0, 200).map((row, i) => (
                      <tr key={i}>{result.columns.map((c) => {
                        const isNum = typeof row[c] === 'number';
                        const isDate = !isNum && /date/i.test(c) && row[c] && !isNaN(new Date(row[c]).getTime());
                        return (
                          <td key={c} className={isNum ? 'num' : ''}>
                            {isNum ? row[c].toLocaleString('en-IN')
                              : isDate ? new Date(row[c]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : (row[c] ?? '—')}
                          </td>
                        );
                      })}</tr>
                    ))}
                    <tr className="report-summary-row">
                      {result.columns.map((c, idx) => {
                        const isNum = result.data.every((r) => r[c] === null || typeof r[c] === 'number');
                        if (idx === 0) return <td key={c} className="num"><strong>OVERALL TOTAL</strong></td>;
                        if (isNum) {
                          const sum = result.data.reduce((a, r) => a + (Number(r[c]) || 0), 0);
                          return <td key={c} className="num"><strong>{Number.isInteger(sum) ? sum.toLocaleString('en-IN') : sum.toFixed(2)}</strong></td>;
                        }
                        return <td key={c} />;
                      })}
                    </tr>
                  </tbody>
                </table>
              </>
            )}
            {result.data.length > 200 && <p className="muted mt">Showing first 200 of {result.data.length} rows — export CSV for the full set.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
