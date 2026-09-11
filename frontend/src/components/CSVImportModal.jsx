import { useState, useRef } from 'react';
import api, { errMessage } from '../api.js';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { Money } from './DataTable.jsx';

const SAMPLE_CSV = `Brand,Product Name,SKU,Category,Size,Colour,Quantity,Purchase Price,Margin %,Selling Price,HSN
Raymond,Premium Formal Slim Fit Shirt,RAY-SH-001,Men's Shirts,40,White,25,850,25,1062.50,6205
Raymond,Premium Formal Slim Fit Shirt,RAY-SH-001,Men's Shirts,42,Sky Blue,20,850,25,1062.50,6205
Arrow,Classic Cotton Chino Trouser,ARW-TR-102,Men's Trousers,32,Beige,15,1100,30,1430.00,6203
Arrow,Classic Cotton Chino Trouser,ARW-TR-102,Men's Trousers,34,Navy Blue,15,1100,30,1430.00,6203
Manyavar,Embroidered Kurta Pajama,MAN-KP-501,Ethnic Wear,L,Maroon,10,1850,35,2497.50,6205
Peter England,Casual Oxford Shirt,PE-CS-204,Men's Shirts,M,Dark Green,30,650,28,832.00,6205`;

export default function CSVImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'text'
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function resetState() {
    setFile(null);
    setCsvText('');
    setPreviewData(null);
    setError('');
    setSuccessMsg('');
    setShowErrors(false);
  }

  function handleFileSelected(selectedFile) {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setError('Please select a valid .csv file');
      return;
    }
    setFile(selectedFile);
    setError('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setCsvText(text);
      fetchPreview(text);
    };
    reader.onerror = () => {
      setError('Failed to read the selected file.');
    };
    reader.readAsText(selectedFile);
  }

  async function fetchPreview(textToParse) {
    const text = textToParse || csvText;
    if (!text || !text.trim()) {
      setError('Please provide CSV content to analyze');
      return;
    }
    setPreviewLoading(true);
    setError('');
    try {
      const res = await api.post('/purchase-orders/import/csv-preview', { csvText: text });
      setPreviewData(res.data.data);
    } catch (e) {
      setError(errMessage(e));
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCommit() {
    if (!csvText) return;
    setCommitLoading(true);
    setError('');
    try {
      const res = await api.post('/purchase-orders/import/csv-commit', {
        csvText,
        updateExisting,
      });
      setSuccessMsg(res.data.message || 'CSV imported successfully!');
      if (onSuccess) onSuccess(res.data.data);
      setTimeout(() => {
        onClose();
        resetState();
      }, 2000);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setCommitLoading(false);
    }
  }

  function downloadSampleCSV() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poms_product_inventory_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title="Upload CSV — Product & Inventory Import" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Subtitle & Sample download */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>
              Import brand catalogs, products, size variations, and cost & selling rates into POMS.
            </p>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Duplicate SKUs are protected and existing records will be updated safely.
            </span>
          </div>
          <button type="button" className="btn sm ghost" onClick={downloadSampleCSV} title="Download standard CSV template">
            <Icon name="download" size={14} /> Download Sample Template
          </button>
        </div>

        {error && <div className="alert error" style={{ margin: 0 }}>{error}</div>}
        {successMsg && <div className="alert ok" style={{ margin: 0 }}>{successMsg}</div>}

        {/* Upload or Input Section */}
        {!previewData && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button
                type="button"
                className={`btn sm ${inputMode === 'file' ? 'primary' : 'ghost'}`}
                onClick={() => setInputMode('file')}
              >
                Upload File (.csv)
              </button>
              <button
                type="button"
                className={`btn sm ${inputMode === 'text' ? 'primary' : 'ghost'}`}
                onClick={() => setInputMode('text')}
              >
                Paste CSV Text
              </button>
            </div>

            {inputMode === 'file' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #93c5fd',
                  borderRadius: 10,
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  transition: 'border-color .2s, background-color .2s',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                  }}
                />
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 15, color: '#1e293b' }}>
                  {file ? file.name : 'Click to browse or drag and drop your CSV file here'}
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  Supports up to 5,000 rows with automatic header detection
                </p>
                {file && (
                  <span className="badge ok" style={{ marginTop: 10, display: 'inline-block' }}>
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  rows={8}
                  className="field"
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 10, borderRadius: 6 }}
                  placeholder="Paste comma-separated values with headers (e.g. Brand,Product Name,SKU,Category,Size,Quantity,Purchase Price,Selling Price)..."
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn primary sm"
                  style={{ marginTop: 8 }}
                  disabled={!csvText.trim() || previewLoading}
                  onClick={() => fetchPreview()}
                >
                  {previewLoading ? 'Analyzing...' : 'Parse & Validate CSV'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Preview and Validation Result */}
        {previewData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Stat Summary Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 10,
              background: '#f8fafc',
              padding: 14,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Total Rows</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{previewData.totalRows}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Valid Rows</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{previewData.validRows}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>New Brands</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#0284c7' }}>+{previewData.newBrandsCount}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>New Products</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#9333ea' }}>+{previewData.newProductsCount}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Existing SKUs</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{previewData.existingProductsCount}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Invalid Rows</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: previewData.invalidRows > 0 ? '#dc2626' : '#16a34a' }}>
                  {previewData.invalidRows}
                </span>
              </div>
            </div>

            {/* Config & Toggles */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                />
                <span>Update pricing and details for existing products if SKU already exists</span>
              </label>

              {previewData.errors?.length > 0 && (
                <button
                  type="button"
                  className="btn sm danger ghost"
                  onClick={() => setShowErrors(!showErrors)}
                >
                  <Icon name="warning" size={13} /> {showErrors ? 'Hide' : 'Show'} {previewData.errors.length} Row Issues
                </button>
              )}
            </div>

            {/* Error List */}
            {showErrors && previewData.errors?.length > 0 && (
              <div style={{ maxHeight: 120, overflowY: 'auto', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#991b1b' }}>
                {previewData.errors.map((err, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <strong>Row {err.row}:</strong> {err.error}
                  </div>
                ))}
              </div>
            )}

            {/* Preview Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  Previewing first {previewData.previewRows?.length} rows:
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  (Full dataset will be processed upon commit)
                </span>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <table className="grid" style={{ margin: 0, fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Brand</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Size</th>
                      <th>Colour</th>
                      <th className="num">Qty</th>
                      <th className="num">Cost</th>
                      <th className="num">Margin</th>
                      <th className="num">Selling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.previewRows?.map((row, idx) => (
                      <tr key={idx}>
                        <td className="muted">{row.rowNumber}</td>
                        <td>
                          {row.brand}
                          {row.brandStatus === 'New' && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                              NEW
                            </span>
                          )}
                        </td>
                        <td>
                          {row.productName || '—'}
                          {row.productStatus === 'New' && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#f3e8ff', color: '#7e22ce', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                              NEW
                            </span>
                          )}
                        </td>
                        <td className="mono">{row.sku || '—'}</td>
                        <td className="muted">{row.category || '—'}</td>
                        <td>{row.size || '—'}</td>
                        <td>{row.color || '—'}</td>
                        <td className="num">{row.quantity || 0}</td>
                        <td className="num"><Money value={row.purchasePrice} /></td>
                        <td className="num">{row.margin ? `${row.margin}%` : '—'}</td>
                        <td className="num"><Money value={row.sellingPrice} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          <div>
            {previewData && (
              <button
                type="button"
                className="btn ghost sm"
                disabled={commitLoading}
                onClick={resetState}
              >
                ← Upload Different CSV
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn ghost"
              disabled={commitLoading}
              onClick={onClose}
            >
              Cancel
            </button>
            {previewData && (
              <button
                type="button"
                className="btn primary"
                disabled={commitLoading || previewData.validRows === 0}
                onClick={handleCommit}
              >
                {commitLoading ? 'Importing Data...' : `Commit & Import (${previewData.validRows} rows)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
