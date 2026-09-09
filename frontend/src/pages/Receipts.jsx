import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import StatusChip from '../components/StatusChip.jsx';
import Modal from '../components/Modal.jsx';

export default function Receipts() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [openPOs, setOpenPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState('');
  const [pending, setPending] = useState([]); // [{po_item_id, sku, product_name, colour_name, ordered_qty, accepted_qty, pending_qty, received, damaged, rejected}]
  const [header, setHeader] = useState({ deliveryDate: '', invoiceNumber: '', invoiceDate: '', remarks: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/receipts').then((r) => setRows(r.data.data || [])).catch((e) => setError(errMessage(e)));
  }, []);
  useEffect(load, [load]);

  function openCreate() {
    setError('');
    Promise.all([api.get('/purchase-orders', { params: { status: 'issued', pageSize: 100 } }),
                 api.get('/purchase-orders', { params: { status: 'partially_received', pageSize: 100 } })])
      .then(([a, b]) => { setOpenPOs([...(a.data.data || []), ...(b.data.data || [])]); setCreating(true); })
      .catch((e) => setError(errMessage(e)));
  }

  function choosePO(poId) {
    setSelectedPO(poId);
    if (!poId) { setPending([]); return; }
    api.get(`/receipts/pending/${poId}`).then(({ data }) => {
      setPending((data.data || []).map((x) => ({ ...x, received: '', damaged: '', rejected: '' })));
    }).catch((e) => setError(errMessage(e)));
  }

  function updateLine(i, patch) { setPending(pending.map((l, j) => (j === i ? { ...l, ...patch } : l))); }

  async function submit() {
    setBusy(true); setError('');
    try {
      const lines = pending
        .map((l) => ({
          poItemId: l.po_item_id,
          receivedQty: Number(l.received) || 0,
          damagedQty: Number(l.damaged) || 0,
          rejectedQty: Number(l.rejected) || 0,
        }))
        .filter((l) => l.receivedQty > 0);
      if (!lines.length) { setError('Enter received quantities for at least one line.'); setBusy(false); return; }
      await api.post('/receipts', { poId: selectedPO, ...header, lines, post: true });
      setCreating(false); setSelectedPO(''); setPending([]);
      load();
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <h1 className="page-title">Receiving & Goods Receipt</h1>
      <p className="page-sub">Five-quantity model against issued POs — partial receipt is first-class (§15, RB-013)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={openCreate}>+ New Receipt</button>
        </div>
        <table className="grid">
          <thead><tr><th>Receipt</th><th>PO</th><th>Supplier</th><th>Delivery date</th><th>Invoice</th><th>Status</th><th className="num">Accepted qty</th><th>By</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.receipt_number}</td>
                <td><Link className="mono" to={`/purchase-orders/${r.po_id}`}>{r.po_number}</Link></td>
                <td>{r.supplier_name}</td>
                <td>{r.delivery_date || '—'}</td>
                <td>{r.invoice_number || '—'}</td>
                <td><StatusChip status={r.status} /></td>
                <td className="num">{r.accepted_total}</td>
                <td>{r.received_by_name}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">No receipts recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="New Goods Receipt" onClose={() => setCreating(false)} wide>
          <div className="fields-2">
            <label className="field"><span className="field-label">Issued / partially-received PO</span>
              <select value={selectedPO} onChange={(e) => choosePO(e.target.value)}>
                <option value="">— select —</option>
                {openPOs.map((p) => <option key={p.id} value={p.id}>{p.po_number} · {p.supplier_name} · <StatusChip status={p.status} /> · ₹{Number(p.grand_total).toLocaleString('en-IN')}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Delivery date</span>
              <input type="date" value={header.deliveryDate} onChange={(e) => setHeader({ ...header, deliveryDate: e.target.value })} />
            </label>
            <label className="field"><span className="field-label">Invoice number</span>
              <input value={header.invoiceNumber} onChange={(e) => setHeader({ ...header, invoiceNumber: e.target.value })} />
            </label>
            <label className="field"><span className="field-label">Invoice date</span>
              <input type="date" value={header.invoiceDate} onChange={(e) => setHeader({ ...header, invoiceDate: e.target.value })} />
            </label>
          </div>

          {pending.length > 0 && (
            <table className="grid">
              <thead><tr><th>Line</th><th>Product</th><th className="num">Ordered</th><th className="num">Accepted so far</th><th className="num">Pending</th><th className="num">Received</th><th className="num">Damaged</th><th className="num">Rejected</th></tr></thead>
              <tbody>
                {pending.map((l, i) => (
                  <tr key={l.po_item_id}>
                    <td>{l.line_no}</td>
                    <td>{l.product_name}<div className="mono muted">{l.sku}{l.colour_name ? ` · ${l.colour_name}` : ''}</div></td>
                    <td className="num">{l.ordered_qty}</td>
                    <td className="num">{l.accepted_qty}</td>
                    <td className="num"><strong>{l.pending_qty}</strong></td>
                    <td className="num"><input type="number" min="0" value={l.received} onChange={(e) => updateLine(i, { received: e.target.value })} /></td>
                    <td className="num"><input type="number" min="0" value={l.damaged} onChange={(e) => updateLine(i, { damaged: e.target.value })} /></td>
                    <td className="num"><input type="number" min="0" value={l.rejected} onChange={(e) => updateLine(i, { rejected: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {selectedPO && !pending.length && <p className="muted">All quantities already received for this PO.</p>}

          <label className="field mt"><span className="field-label">Remarks</span>
            <input value={header.remarks} onChange={(e) => setHeader({ ...header, remarks: e.target.value })} />
          </label>
          <button className="btn primary" disabled={busy || !selectedPO} onClick={submit}>
            {busy ? 'Posting…' : 'Post receipt (updates inventory & PO status)'}
          </button>
        </Modal>
      )}
    </div>
  );
}
