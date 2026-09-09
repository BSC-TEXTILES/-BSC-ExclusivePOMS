import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import api, { API_BASE, errMessage, uploadFile, formatBytes, fileKind } from '../api.js';
import { useAuth } from '../auth.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Money } from '../components/DataTable.jsx';

// Universal attachment drawer for a PO — PDF, Excel, Word, images, video, any
// format up to 200 MB. Anyone in the division can attach; uploader/approver/SA
// can remove. Images preview inline; video gets a player; everything downloads.
function AttachmentsPanel({ poId, onChanged }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.get(`/purchase-orders/${poId}/attachments`)
      .then((r) => setList(r.data.data || []))
      .catch((e) => setError(errMessage(e)));
  }, [poId]);
  useEffect(load, [load]);

  async function upload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true); setError('');
    try { await uploadFile(`/purchase-orders/${poId}/attachments`, files); load(); onChanged?.(); }
    catch (err) { setError(errMessage(err)); }
    setBusy(false);
    e.target.value = '';
  }

  async function remove(a) {
    if (!window.confirm(`Remove "${a.file_name}"?`)) return;
    await api.delete(`/attachments/${a.id}`).catch((err) => setError(errMessage(err)));
    load(); onChanged?.();
  }

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 className="grow" style={{ margin: 0 }}>Attachments (PDF · Excel · Word · images · video · any format)</h3>
        <button className="btn sm primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={14} /> {busy ? 'Uploading…' : 'Attach files'}
        </button>
        <input ref={fileRef} type="file" multiple hidden onChange={upload} />
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="attach-list">
        {(list || []).map((a) => {
          const kind = fileKind(a.mime_type, a.file_name);
          return (
            <div key={a.id} className="attach-item">
              {a.mime_type?.startsWith('image/')
                ? <img className="attach-thumb" src={a.url} alt={a.file_name} loading="lazy" onClick={() => setPreview(a)} />
                : <span className="attach-icon"><Icon name={kind.icon} size={20} /></span>}
              <span className="attach-meta">
                <a href={a.url} target="_blank" rel="noreferrer" download={a.file_name}><strong>{a.file_name}</strong></a>
                <span className="muted">{kind.label} · {formatBytes(a.size_bytes)} · {a.uploaded_by_name || '—'} · {new Date(a.uploaded_at).toLocaleString('en-IN')}</span>
              </span>
              <span className="right attach-actions">
                {a.mime_type?.startsWith('video/') && <button className="btn sm" onClick={() => setPreview(a)}><Icon name="video" size={13} /> Play</button>}
                <a className="btn sm" href={a.url} target="_blank" rel="noreferrer"><Icon name="download" size={13} /></a>
                <button className="btn sm danger" onClick={() => remove(a)}><Icon name="trash" size={13} /></button>
              </span>
            </div>
          );
        })}
        {list && !list.length && <div className="muted" style={{ padding: 8 }}>No files attached yet — specs, quotes, invoices, photos, videos: anything goes (200 MB per file).</div>}
        {!list && <div className="muted" style={{ padding: 8 }}>Loading…</div>}
      </div>

      {preview && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div className="modal wide preview-modal">
            <div className="modal-head">
              <h3>{preview.file_name}</h3>
              <button className="icon-btn" onClick={() => setPreview(null)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body preview-body">
              {preview.mime_type?.startsWith('image/') && <img src={preview.url} alt={preview.file_name} />}
              {preview.mime_type?.startsWith('video/') && <video src={preview.url} controls autoPlay />}
              {preview.mime_type === 'application/pdf' && <iframe src={preview.url} title={preview.file_name} />}
              {!(preview.mime_type?.startsWith('image/') || preview.mime_type?.startsWith('video/') || preview.mime_type === 'application/pdf') && (
                <p className="muted">No inline preview for this format — <a href={preview.url} target="_blank" rel="noreferrer">open/download it here</a>.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PODetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.submitted ? 'PO submitted for approval.' : '');
  const [actModal, setActModal] = useState(null); // action string
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/purchase-orders/${id}`).then((r) => setPo(r.data.data || null)).catch((e) => setError(errMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  async function doAction(action, withComments = false) {
    setBusy(true); setError('');
    try {
      await api.post(`/purchase-orders/${id}/approval-action`, { action, comments: withComments ? comments : comments || undefined });
      setActModal(null); setComments('');
      if (action === 'approved') setNotice('Approval recorded.');
      load();
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function lifecycle(endpoint, successMsg) {
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/purchase-orders/${id}/${endpoint}`);
      setNotice(successMsg);
      if (endpoint === 'amend' && data.data?.amendmentId) { navigate(`/purchase-orders/new?edit=${data.data.amendmentId}`); return; }
      load();
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function downloadExport(format) {
    setBusy(true);
    try {
      const token = localStorage.getItem('poms_token');
      const res = await fetch(`${API_BASE}/purchase-orders/${id}/export/${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${po.po_number || 'PO'}_v${po.version || 1}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error && !po) return <div className="page"><div className="alert error">{error}</div></div>;
  if (!po) return <div className="page"><p className="muted">Loading…</p></div>;

  const qtyDisplay = (q) => Object.values(q || {}).map((x) => `${x.sizeLabel}:${x.quantity}`).join(' · ');
  const canAct = ['submitted', 'under_review'].includes(po.status) && hasPermission('approvals.act');
  const openInstance = po.approvals?.find((a) => !a.resolved_at);

  return (
    <div className="page">
      <div className="row" style={{ alignItems: 'baseline' }}>
        <h1 className="page-title mono">{po.po_number}</h1>
        <span className="muted">v{po.version}</span>
        <StatusChip status={po.status} />
        <div className="right row" style={{ gap: 8 }}>
          <button className="btn" disabled={busy} onClick={() => downloadExport('pdf')} title="Download branded Purchase Order PDF">
            <Icon name="download" size={14} /> Download PDF
          </button>
          <button className="btn" disabled={busy} onClick={() => downloadExport('csv')} title="Download complete Purchase Order CSV">
            <Icon name="reports" size={14} /> Download CSV
          </button>
          <button className="btn" onClick={() => window.print()} title="Print Purchase Order">
            <Icon name="file" size={14} /> Print
          </button>
        </div>
      </div>
      <p className="page-sub">Created by {po.created_by_name} on {new Date(po.created_at).toLocaleDateString('en-IN')} — {po.division_name} · {po.section_name}</p>

      {notice && <div className="alert ok">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="row" style={{ marginBottom: 14 }}>
        {po.status === 'draft' && hasPermission('po.submit') && <button className="btn accent" disabled={busy} onClick={() => lifecycle('submit', 'PO submitted for approval.')}>Submit for approval</button>}
        {po.status === 'draft' && hasPermission('po.edit') && <Link className="btn" to={`/purchase-orders/new?edit=${po.id}`}>Edit draft</Link>}
        {canAct && <button className="btn ok" disabled={busy} onClick={() => { setComments(''); setActModal('approved'); }}>Approve</button>}
        {canAct && <button className="btn danger" disabled={busy} onClick={() => { setComments(''); setActModal('rejected'); }}>Reject</button>}
        {canAct && <button className="btn" disabled={busy} onClick={() => { setComments(''); setActModal('send_back'); }}>Send Back</button>}
        {canAct && <button className="btn" disabled={busy} onClick={() => { setComments(''); setActModal('hold'); }}>Hold</button>}
        {canAct && openInstance?.rule_id && <button className="btn" disabled={busy} onClick={() => doAction('escalated')}>Escalate</button>}
        {po.status === 'approved' && hasPermission('po.issue') && <button className="btn primary" disabled={busy} onClick={() => lifecycle('issue', 'PO issued to supplier.')}>Issue PO</button>}
        {['approved', 'issued', 'partially_received'].includes(po.status) && hasPermission('po.amend') && <button className="btn" disabled={busy} onClick={() => lifecycle('amend', 'Amendment draft created.')}>Amend (new version)</button>}
        {['issued', 'partially_received', 'received'].includes(po.status) && hasPermission('po.close') && <button className="btn" disabled={busy} onClick={() => lifecycle('close', 'PO closed.')}>Close PO</button>}
      </div>

      <div className="row">
        <div className="panel grow" style={{ minWidth: 320 }}>
          <h3>Order</h3>
          <table className="grid">
            <tbody>
              <tr><td className="muted">Supplier</td><td>{po.supplier_name} <span className="mono muted">({po.supplier_code})</span></td></tr>
              <tr><td className="muted">GSTIN</td><td className="mono">{po.supplier_gstin || '—'}</td></tr>
              <tr><td className="muted">Division / Department</td><td>{po.division_name} / {po.department_name}</td></tr>
              <tr><td className="muted">Section</td><td>{po.section_name}</td></tr>
              <tr><td className="muted">PO date</td><td>{po.po_date ? new Date(po.po_date).toLocaleDateString("en-IN") : "—"}</td></tr>
              <tr><td className="muted">Expected delivery</td><td>{po.expected_delivery_date || '—'}</td></tr>
              <tr><td className="muted">Tax scheme</td><td>{po.tax_scheme}</td></tr>
              <tr><td className="muted">Remarks</td><td>{po.remarks || '—'}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="panel grow" style={{ minWidth: 320 }}>
          <h3>Commercials (server-computed, RB-017)</h3>
          <table className="grid">
            <tbody>
              <tr><td className="muted">Subtotal</td><td className="num"><Money value={po.subtotal} /></td></tr>
              <tr><td className="muted">Order discount</td><td className="num">− <Money value={po.order_discount_amount} /></td></tr>
              {po.taxes?.map((t) => (
                <tr key={t.id}><td className="muted">{t.tax_name} @ {t.rate}%</td><td className="num"><Money value={t.tax_amount} /></td></tr>
              ))}
              {po.charges?.map((c) => (
                <tr key={c.id}><td className="muted">Charge — {c.charge_type}{c.description ? ` (${c.description})` : ''}</td><td className="num"><Money value={c.amount} /></td></tr>
              ))}
              <tr><td><strong>Grand total</strong></td><td className="num"><strong><Money value={po.grand_total} /></strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Lines & size matrix</h3>
        <table className="grid">
          <thead><tr><th>#</th><th>Product</th><th>Brand</th><th>Colour</th><th>Quantities</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Margin</th><th className="num">Net</th><th className="num">Disc.</th><th className="num">Final</th><th className="num">Line total</th><th className="num">Accepted</th></tr></thead>
          <tbody>
            {po.items?.map((it) => (
              <tr key={it.id}>
                <td>{it.line_no}</td>
                <td>{it.product_name}<div className="mono muted">{it.sku}</div></td>
                <td>{it.brand_name}</td>
                <td>{it.colour_name || '—'}</td>
                <td className="mono" style={{ maxWidth: 260 }}>{qtyDisplay(it.quantities)}</td>
                <td className="num">{it.total_quantity}</td>
                <td className="num"><Money value={it.purchase_price} /></td>
                <td className="num">{it.margin_percent}%</td>
                <td className="num"><Money value={it.net_value_per_unit} /></td>
                <td className="num">{it.discount_amount ? <Money value={it.discount_amount} /> : '—'}</td>
                <td className="num"><Money value={it.final_value_per_unit} /></td>
                <td className="num"><strong><Money value={it.line_total} /></strong></td>
                <td className="num">{it.accepted_qty} / {it.total_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row">
        <div className="panel grow" style={{ minWidth: 320 }}>
          <h3>Approval history</h3>
          {openInstance && (
            <p className="muted">Open instance at level {openInstance.current_level} {openInstance.rule_name ? `— rule: ${openInstance.rule_name}` : '— exception queue (SA-06)'}</p>
          )}
          <ul className="timeline">
            {po.approvalActions?.map((a) => (
              <li key={a.id}>
                <div className="t-time">{new Date(a.acted_at).toLocaleString('en-IN')}</div>
                <strong>{a.action.replace(/_/g, ' ')}</strong> — {a.approver_name} (L{a.level_no})
                {a.comments && <div className="muted">“{a.comments}”</div>}
              </li>
            ))}
            {!po.approvalActions?.length && <li className="muted">Not yet submitted.</li>}
          </ul>
        </div>

        <div className="panel grow" style={{ minWidth: 300 }}>
          <h3>Receipts & timeline</h3>
          {po.receipts?.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
              <span className="mono">{r.receipt_number}</span>
              <StatusChip status={r.status} />
              <span className="muted">{r.received_by_name}</span>
            </div>
          ))}
          {!po.receipts?.length && <p className="muted">No receipts yet.</p>}
          <h3 className="mt">Timeline (§17.3)</h3>
          <ul className="timeline">
            {po.timeline?.map((t, i) => (
              <li key={i}>
                <div className="t-time">{new Date(t.occurred_at).toLocaleString('en-IN')}</div>
                <strong>{t.title}</strong> — {t.actor}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <AttachmentsPanel poId={po.id} />

      {actModal && (
        <Modal title={`${actModal.replace(/_/g, ' ')} — ${po.po_number}`} onClose={() => setActModal(null)}>
          {['rejected', 'send_back'].includes(actModal) && <p className="muted" style={{ marginTop: 0 }}>Reason is mandatory (RB-012).</p>}
          <label className="field">
            <span className="field-label">Comments</span>
            <textarea rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn primary" disabled={busy || (['rejected', 'send_back'].includes(actModal) && !comments.trim())} onClick={() => doAction(actModal, true)}>
              Confirm
            </button>
            <button className="btn" onClick={() => setActModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
