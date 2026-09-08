import { useState } from 'react';

export default function ShareMenu({ label = 'Share', pdfUrl, csvUrl, fileName }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  async function copyLink() {
    const url = pdfUrl ? `${baseUrl}${pdfUrl}` : csvUrl ? `${baseUrl}${csvUrl}` : window.location.href;
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
    const url = pdfUrl ? `${baseUrl}${pdfUrl}` : csvUrl ? `${baseUrl}${csvUrl}` : window.location.href;
    const text = encodeURIComponent(`Check this purchase order: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function shareEmail() {
    const url = pdfUrl ? `${baseUrl}${pdfUrl}` : csvUrl ? `${baseUrl}${csvUrl}` : window.location.href;
    const subject = encodeURIComponent(fileName || 'Purchase Order');
    const body = encodeURIComponent(`Please find the purchase order details:\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn" onClick={() => setOpen(!open)}>{label}</button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,.1)', minWidth: 180, zIndex: 100,
          padding: '4px 0',
        }}>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" download={fileName ? `${fileName}.pdf` : 'download.pdf'}
              style={{ display: 'block', padding: '8px 14px', fontSize: 13, color: '#1c2333', textDecoration: 'none' }}
              onClick={() => setOpen(false)}>
              Download PDF
            </a>
          )}
          {csvUrl && (
            <a href={csvUrl} download={fileName ? `${fileName}.csv` : 'download.csv'}
              style={{ display: 'block', padding: '8px 14px', fontSize: 13, color: '#1c2333', textDecoration: 'none' }}
              onClick={() => setOpen(false)}>
              Download CSV
            </a>
          )}
          <button onClick={() => { shareWhatsApp(); setOpen(false); }}
            style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 13, color: '#1c2333', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
            Share on WhatsApp
          </button>
          <button onClick={() => { shareEmail(); setOpen(false); }}
            style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 13, color: '#1c2333', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
            Send via Email
          </button>
          <button onClick={() => { copyLink(); setOpen(false); }}
            style={{ display: 'block', width: '100%', padding: '8px 14px', fontSize: 13, color: '#1c2333', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}
    </div>
  );
}
