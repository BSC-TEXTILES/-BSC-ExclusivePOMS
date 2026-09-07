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
        </div>

        {result && (
          <div className="mt">
            {result.data.length === 0 && <p className="muted">No rows for the selected range.</p>}
            {result.data.length > 0 && (
              <table className="grid">
                <thead><tr>{result.columns.map((c) => <th key={c} className={typeof result.data[0][c] === 'number' ? 'num' : ''}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                <tbody>
                  {result.data.slice(0, 200).map((row, i) => (
                    <tr key={i}>{result.columns.map((c) => (
                      <td key={c} className={typeof row[c] === 'number' ? 'num' : ''}>
                        {typeof row[c] === 'number' ? row[c].toLocaleString('en-IN') : (row[c] ?? '—')}
                      </td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            )}
            {result.data.length > 200 && <p className="muted mt">Showing first 200 of {result.data.length} rows — export CSV for the full set.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
