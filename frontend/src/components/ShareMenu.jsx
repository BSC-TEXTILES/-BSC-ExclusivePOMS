import { useState } from 'react';
import api, { errMessage } from '../api.js';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';

export default function ShareMenu({
  label = 'Share',
  po,
  pdfUrl,
  csvUrl,
  fileName,
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ ok: null, msg: '' });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const directPdfUrl = pdfUrl || (po?.id ? `/api/purchase-orders/${po.id}/export/pdf` : null);
  const directCsvUrl = csvUrl || (po?.id ? `/api/purchase-orders/${po.id}/export/csv` : null);

  const poNumber = po?.po_number || fileName || 'PO';
  const supplier = po?.supplier_name || 'N/A';
  const qty = po?.total_quantity ?? 0;
  const purchaseVal = Number(po?.grand_total || po?.subtotal || 0);

  // Calculate or retrieve expected sales value and profit if available from items
  let totalSelling = 0;
  if (Array.isArray(po?.items) && po.items.length > 0) {
    totalSelling = po.items.reduce((sum, it) => {
      const sp = Number(it.selling_price || it.unit_price || 0);
      const q = Number(it.quantity || 0);
      return sum + (sp * q);
    }, 0);
  }
  const profit = totalSelling > purchaseVal ? totalSelling - purchaseVal : 0;
  const margin = purchaseVal > 0 && profit > 0 ? ((profit / purchaseVal) * 100).toFixed(1) : null;

  async function downloadFile(kind) {
    if (!po?.id) return;
    const endpoint = `/purchase-orders/${po.id}/export/${kind === 'pdf' ? 'pdf' : 'csv'}`;
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const ext = kind === 'pdf' ? 'pdf' : 'csv';
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${poNumber}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(errMessage(err));
    }
    setOpen(false);
  }

  async function copyLink() {
    const url = directPdfUrl ? `${baseUrl}${directPdfUrl}` : currentUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const t = document.createElement('textarea');
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function shareWhatsApp() {
    const orderLink = currentUrl;
    let message = `*PURCHASE ORDER: ${poNumber}*\n`
      + `• Supplier: ${supplier}\n`
      + `• Total Quantity: ${qty.toLocaleString('en-IN')} pieces\n`
      + `• Purchase Value: ₹${purchaseVal.toLocaleString('en-IN')}\n`;

    if (totalSelling > 0) {
      message += `• Sales Value: ₹${totalSelling.toLocaleString('en-IN')}\n`;
      if (margin) {
        message += `• Expected Profit: ₹${profit.toLocaleString('en-IN')} (${margin}% margin)\n`;
      }
    }

    if (po?.section_name) {
      message += `• Section: ${po.section_name}\n`;
    }
    if (po?.status) {
      message += `• Status: ${po.status.replace(/_/g, ' ').toUpperCase()}\n`;
    }
    message += `• View Details: ${orderLink}`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }

  function openEmailDialog() {
    setEmailSubject(`Purchase Order ${poNumber} - BSC Exclusive POMS`);
    setRecipientEmail('');
    setEmailNote('');
    setEmailStatus({ ok: null, msg: '' });
    setEmailModalOpen(true);
  }

  async function handleSendEmail(e) {
    e?.preventDefault();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setEmailStatus({ ok: false, msg: 'Please enter a valid recipient email address' });
      return;
    }

    if (!po?.id) {
      // Fallback to mailto if not linked to a specific PO ID
      const subject = encodeURIComponent(emailSubject);
      const body = encodeURIComponent(
        `Purchase Order Details:\n${poNumber}\nSupplier: ${supplier}\nQty: ${qty}\nValue: ₹${purchaseVal}\n\n${emailNote}\n\nView order: ${currentUrl}`
      );
      window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
      setEmailModalOpen(false);
      return;
    }

    setSendingEmail(true);
    setEmailStatus({ ok: null, msg: '' });

    try {
      const res = await api.post(`/purchase-orders/${po.id}/email`, {
        recipientEmail: recipientEmail.trim(),
        subject: emailSubject,
        message: emailNote,
      });
      setEmailStatus({ ok: true, msg: res.data.message || `Purchase Order sent to ${recipientEmail}` });
      setTimeout(() => {
        setEmailModalOpen(false);
      }, 1800);
    } catch (err) {
      setEmailStatus({ ok: false, msg: errMessage(err) });
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          className="btn sm"
          onClick={() => setOpen(!open)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="share" size={14} /> {label}
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              minWidth: 200,
              zIndex: 100,
              padding: '6px 0',
            }}
          >
            {directPdfUrl && (
              <button
                type="button"
                onClick={() => downloadFile('pdf')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 14px',
                  fontSize: 13,
                  color: '#1c2333',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Icon name="download" size={14} /> Download PDF
              </button>
            )}
            {directCsvUrl && (
              <button
                type="button"
                onClick={() => downloadFile('csv')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 14px',
                  fontSize: 13,
                  color: '#1c2333',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Icon name="reports" size={14} /> Download CSV
              </button>
            )}
            <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
            <button
              type="button"
              onClick={() => { shareWhatsApp(); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 14px',
                fontSize: 13,
                color: '#16a34a',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span>💬</span> Share on WhatsApp
            </button>
            <button
              type="button"
              onClick={() => { openEmailDialog(); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 14px',
                fontSize: 13,
                color: '#0284c7',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span>✉️</span> Send via Email
            </button>
            <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
            <button
              type="button"
              onClick={() => { copyLink(); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 14px',
                fontSize: 13,
                color: '#4b5563',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Icon name="link" size={14} /> {copied ? 'Copied to Clipboard!' : 'Copy Link'}
            </button>
          </div>
        )}
      </div>

      {/* Email PO Modal */}
      {emailModalOpen && (
        <Modal title={`Email Purchase Order: ${poNumber}`} onClose={() => setEmailModalOpen(false)}>
          <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {emailStatus.msg && (
              <div className={`alert ${emailStatus.ok ? 'ok' : 'error'}`} style={{ margin: 0 }}>
                {emailStatus.msg}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, fontSize: 13, color: '#334155', border: '1px solid #e2e8f0' }}>
              <div><strong>Supplier:</strong> {supplier}</div>
              <div><strong>Quantity:</strong> {qty} pieces · <strong>Value:</strong> ₹{purchaseVal.toLocaleString('en-IN')}</div>
            </div>

            <label className="field">
              <span className="field-label">Recipient Email Address *</span>
              <input
                type="email"
                required
                placeholder="supplier@textiles.com or buyer@bsc.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                disabled={sendingEmail}
              />
            </label>

            <label className="field">
              <span className="field-label">Email Subject</span>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                disabled={sendingEmail}
              />
            </label>

            <label className="field">
              <span className="field-label">Personal Note / Message (Optional)</span>
              <textarea
                rows={3}
                placeholder="Add special instructions, delivery remarks, or notes for the recipient..."
                value={emailNote}
                onChange={(e) => setEmailNote(e.target.value)}
                disabled={sendingEmail}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                className="btn ghost"
                disabled={sendingEmail}
                onClick={() => setEmailModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={sendingEmail || !recipientEmail.trim()}
              >
                {sendingEmail ? 'Sending Email...' : 'Send Purchase Order'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
