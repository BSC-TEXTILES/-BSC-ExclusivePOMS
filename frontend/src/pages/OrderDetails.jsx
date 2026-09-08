import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import StatusChip from '../components/StatusChip.jsx';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(() => {
    api.get(`/om-orders/${id}`)
      .then((r) => setOrder(r.data.data))
      .catch((e) => setError(errMessage(e)));
  }, [id]);

  useEffect(load, [load]);

  async function submit() {
    setBusy(true); setError('');
    try { await api.post(`/om-orders/${id}/submit`); setNotice('Order submitted.'); load(); }
    catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function approve() {
    setBusy(true); setError('');
    try { await api.post(`/om-orders/${id}/approve`); setNotice('Order approved.'); load(); }
    catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function reject() {
    if (!rejectReason.trim()) return;
    setBusy(true); setError('');
    try { await api.post(`/om-orders/${id}/reject`, { reason: rejectReason }); setRejectModal(false); setRejectReason(''); setNotice('Order rejected.'); load(); }
    catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function generatePdf() {
    setBusy(true); setError('');
    try { await api.post(`/om-orders/${id}/generate-pdf`); setNotice('PDF generated.'); load(); }
    catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  if (error && !order) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!order) return <div className="page"><p className="muted">Loading…</p></div>;

  const canSubmit = order.status === 'draft' && hasPermission('order.submit');
  const canAct = order.status === 'submitted' && hasPermission('approvals.act');
  const canPdf = hasPermission('pdf.generate');
  const subtotal = order.items?.reduce((s, it) => s + (it.line_total || 0), 0) || 0;

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'baseline' }}>
        <button className="btn ghost sm" onClick={() => navigate(-1)} style={{ marginRight: 8 }}><Icon name="chevronLeft" size={16} /></button>
        <h1 className="page-title mono">{order.order_number}</h1>
        <StatusChip status={order.status} />
      </div>
      <p className="page-sub">
        Customer: {order.customer_name || '—'} · Created {new Date(order.created_at).toLocaleDateString('en-IN')}
        {order.priority && <span> · Priority: <strong>{order.priority}</strong></span>}
      </p>

      {notice && <div className="alert ok">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="row" style={{ marginBottom: 14 }}>
        {canSubmit && <button className="btn accent" disabled={busy} onClick={submit}><Icon name="check" size={14} /> Submit</button>}
        {canAct && <button className="btn ok" disabled={busy} onClick={approve}><Icon name="check" size={14} /> Approve</button>}
        {canAct && <button className="btn danger" disabled={busy} onClick={() => { setRejectReason(''); setRejectModal(true); }}><Icon name="x" size={14} /> Reject</button>}
        {canPdf && <button className="btn" disabled={busy} onClick={generatePdf}><Icon name="file" size={14} /> Generate PDF</button>}
      </div>

      <div className="row">
        <div className="panel grow" style={{ minWidth: 320 }}>
          <h3>Order Info</h3>
          <table className="grid">
            <tbody>
              <tr><td className="muted">Order #</td><td className="mono">{order.order_number}</td></tr>
              <tr><td className="muted">Customer</td><td>{order.customer_name}</td></tr>
              <tr><td className="muted">Status</td><td><StatusChip status={order.status} /></td></tr>
              <tr><td className="muted">Priority</td><td>{order.priority || '—'}</td></tr>
              <tr><td className="muted">Order date</td><td>{order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN') : '—'}</td></tr>
              <tr><td className="muted">Delivery date</td><td>{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-IN') : '—'}</td></tr>
              <tr><td className="muted">Remarks</td><td>{order.remarks || '—'}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="panel grow" style={{ minWidth: 320 }}>
          <h3>Totals</h3>
          <table className="grid">
            <tbody>
              <tr><td className="muted">Subtotal</td><td className="num">₹ {fmt(subtotal)}</td></tr>
              <tr><td className="muted">Tax</td><td className="num">₹ {fmt(order.tax)}</td></tr>
              <tr><td className="muted">Discount</td><td className="num">− ₹ {fmt(order.discount)}</td></tr>
              <tr><td><strong>Grand Total</strong></td><td className="num"><strong>₹ {fmt(order.grand_total)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Order Items</h3>
        <table className="grid">
          <thead>
            <tr>
              <th>#</th><th>Product</th><th>Code</th><th>Sheet / Color</th><th>Size</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((it, i) => (
              <tr key={it.id || i}>
                <td>{i + 1}</td>
                <td>{it.product_name}<div className="mono muted">{it.sku}</div></td>
                <td className="mono">{it.code || '—'}</td>
                <td>{it.sheet || '—'} / {it.color || '—'}</td>
                <td>{it.size || '—'}</td>
                <td className="num">{it.quantity}</td>
                <td className="num">₹ {fmt(it.price)}</td>
                <td className="num"><strong>₹ {fmt(it.line_total)}</strong></td>
              </tr>
            ))}
            {!order.items?.length && <tr><td colSpan={8} className="muted">No items.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="row">
        <div className="panel grow" style={{ minWidth: 300 }}>
          <h3>Status History</h3>
          <ul className="timeline">
            {order.history?.map((h, i) => (
              <li key={h.id || i}>
                <div className="t-time">{new Date(h.created_at).toLocaleString('en-IN')}</div>
                <strong>{h.status}</strong> — {h.user_name || '—'}
                {h.remarks && <div className="muted">"{h.remarks}"</div>}
              </li>
            ))}
            {!order.history?.length && <li className="muted">No history yet.</li>}
          </ul>
        </div>

        <div className="panel grow" style={{ minWidth: 300 }}>
          <h3>PDF Versions</h3>
          {order.pdfs?.length ? (
            <div className="attach-list">
              {order.pdfs.map((pdf, i) => (
                <div key={pdf.id || i} className="attach-item">
                  <span className="attach-icon"><Icon name="file" size={20} /></span>
                  <span className="attach-meta">
                    <strong>{pdf.file_name || `Version ${pdf.version || i + 1}`}</strong>
                    <span className="muted">
                      v{pdf.version || i + 1} · {pdf.generated_by_name || '—'} · {new Date(pdf.created_at).toLocaleString('en-IN')}
                    </span>
                  </span>
                  <span className="right attach-actions">
                    <a className="btn sm" href={pdf.url} target="_blank" rel="noreferrer" download={pdf.file_name}>
                      <Icon name="download" size={13} />
                    </a>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No PDFs generated yet.</p>
          )}
        </div>
      </div>

      {rejectModal && (
        <Modal title="Reject Order" onClose={() => setRejectModal(false)}>
          <p className="muted" style={{ marginTop: 0 }}>Provide a reason for rejection.</p>
          <label className="field">
            <span className="field-label">Reason</span>
            <textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn danger" disabled={busy || !rejectReason.trim()} onClick={reject}>Confirm Reject</button>
            <button className="btn" onClick={() => setRejectModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
