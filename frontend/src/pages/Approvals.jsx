import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import Modal from '../components/Modal.jsx';
import { Money } from '../components/DataTable.jsx';

export default function Approvals() {
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(null); // {poId, poNumber, action}
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/approvals/queue').then((r) => setQueue(r.data.data)).catch((e) => setError(errMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function act() {
    setBusy(true);
    try {
      await api.post(`/purchase-orders/${acting.poId}/approval-action`, { action: acting.action, comments });
      setActing(null); setComments('');
      load();
    } catch (e) {
      setError(errMessage(e));
    } finally { setBusy(false); }
  }

  function openAction(poId, poNumber, action) { setActing({ poId, poNumber, action }); setComments(''); setError(''); }

  return (
    <div className="page">
      <h1 className="page-title">Approval Queue</h1>
      <p className="page-sub">Open approval instances at your authorized level, oldest first (AP-01)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <table className="grid">
          <thead>
            <tr>
              <th>PO</th><th>Division</th><th>Section</th><th>Supplier</th><th>By</th>
              <th className="num">Value</th><th>Level</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((q) => (
              <tr key={q.instance_id}>
                <td><Link className="mono" to={`/purchase-orders/${q.po_id}`}>{q.po_number}</Link></td>
                <td>{q.division_name}</td>
                <td>{q.section_name}</td>
                <td>{q.supplier_name}</td>
                <td>{q.created_by_name}</td>
                <td className="num"><Money value={q.grand_total} /></td>
                <td>L{q.current_level}{q.approver_role_code ? ` · ${q.approver_role_code}` : ' · exception'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm ok" onClick={() => openAction(q.po_id, q.po_number, 'approved')}>Approve</button>{' '}
                  <button className="btn sm danger" onClick={() => openAction(q.po_id, q.po_number, 'rejected')}>Reject</button>{' '}
                  <button className="btn sm" onClick={() => openAction(q.po_id, q.po_number, 'send_back')}>Send Back</button>{' '}
                  <button className="btn sm" onClick={() => openAction(q.po_id, q.po_number, 'hold')}>Hold</button>
                </td>
              </tr>
            ))}
            {!queue.length && <tr><td colSpan={8} className="muted">Queue is clear — nothing awaiting your decision.</td></tr>}
          </tbody>
        </table>
      </div>

      {acting && (
        <Modal title={`${acting.action.replace('_', ' ')} — PO ${acting.poNumber}`} onClose={() => setActing(null)}>
          {['rejected', 'send_back'].includes(acting.action) && (
            <p className="muted" style={{ marginTop: 0 }}>A reason/comment is mandatory (RB-012).</p>
          )}
          <label className="field">
            <span className="field-label">Comments {['rejected', 'send_back'].includes(acting.action) ? '(required)' : '(optional)'}</span>
            <textarea rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn primary" disabled={busy || (['rejected', 'send_back'].includes(acting.action) && !comments.trim())} onClick={act}>
              Confirm {acting.action.replace('_', ' ')}
            </button>
            <button className="btn" onClick={() => setActing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
