import { useState } from 'react';
import api, { errMessage } from '../api.js';

export default function ExportData() {
  const [dataType, setDataType] = useState('products');
  const [format, setFormat] = useState('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const exportTypes = [
    { value: 'po-register', label: 'PO Register' },
    { value: 'purchase-summary', label: 'Purchase Summary' },
    { value: 'dealer', label: 'Dealer Report' },
    { value: 'size', label: 'Size Report' },
    { value: 'margin', label: 'Margin Report' },
    { value: 'receiving', label: 'Receiving Report' },
  ];

  const handleExport = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      if (format === 'csv') {
        const r = await api.get(`/reports/${dataType}`, { params: { format: 'csv' }, responseType: 'blob' });
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url; a.download = `${dataType}-export.csv`; a.click();
        URL.revokeObjectURL(url);
        setSuccess(`${dataType} exported as CSV successfully`);
      } else {
        const r = await api.get(`/reports/${dataType}`, { params: { format: 'pdf' }, responseType: 'blob' });
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url; a.download = `${dataType}-report.pdf`; a.click();
        URL.revokeObjectURL(url);
        setSuccess(`${dataType} exported as PDF successfully`);
      }
    } catch (e) { setError(errMessage(e)); }
    setLoading(false);
  };

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Export Data</h1><p className="page-sub" style={{ margin: 0 }}>Download reports as PDF or CSV</p></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert ok">{success}</div>}

      <div className="panel" style={{ maxWidth: 500 }}>
        <h3>Export Report</h3>
        <label className="field"><span className="field-label">Data Type</span>
          <select value={dataType} onChange={(e) => setDataType(e.target.value)}>
            {exportTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="csv">CSV (Excel-compatible)</option>
            <option value="pdf">PDF (Printable)</option>
          </select>
        </label>
        <button className="btn primary lg" onClick={handleExport} disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Exporting…' : `Download ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}
