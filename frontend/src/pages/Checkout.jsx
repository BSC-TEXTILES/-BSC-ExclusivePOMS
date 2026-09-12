import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useCart } from '../auth.jsx';
import { Money } from '../components/DataTable.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Invoice from '../components/Invoice.jsx';

// Checkout — crosscheck every pending order in the cart once more (items,
// quantities, prices, taxes and grand total) before placing it. On
// confirmation, each draft PO is submitted into the approval workflow and a
// complete summary invoice is generated for the order.
export default function Checkout() {
  const { items, removeItem, clear } = useCart();
  const navigate = useNavigate();
  const [details, setDetails] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    items.forEach((it) => {
      api.get(`/purchase-orders/${it.id}`)
        .then((r) => setDetails((d) => ({ ...d, [it.id]: r.data.data })))
        .catch((e) => setError(errMessage(e)));
    });
  }, [items.map((i) => i.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const allChecked = items.length > 0 && items.every((it) => checked[it.id]);
  const totalValue = items.reduce((a, it) => a + (Number(details[it.id]?.grand_total ?? it.grandTotal) || 0), 0);

  async function placeOrders() {
    setBusy(true); setError('');
    const placed = [];
    try {
      for (const it of items) {
        const po = details[it.id];
        if (!po) continue;
        if (po.status === 'draft') {
          await api.post(`/purchase-orders/${it.id}/submit`, { notes: 'Placed from cart checkout after crosscheck' });
        }
        placed.push(po);
      }
      setInvoices(placed);
      setDone(true);
      clear();
    } catch (e) {
      setError(errMessage(e));
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="page">
        <h1 className="page-title">Order placed ✔</h1>
        <p className="page-sub">Your purchase order(s) entered the approval workflow. The complete summary invoice is shown below.</p>
        {invoices.map((po) => <Invoice key={po.id} po={po} onClose={() => navigate('/purchase-orders')} />)}
        <div className="row mt no-print">
          <button className="btn primary" onClick={() => navigate('/purchase-orders')}>Go to Purchase Orders</button>
          <button className="btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }
  /* CART_LIST_AND_ACTIONS */
  return (
    <div className="page">
      <h1 className="page-title">Cart — Crosscheck &amp; Checkout</h1>
      <p className="page-sub">Verify each pending order one final time before placing it. Once placed, a complete summary invoice bill is generated.</p>
      {error && <div className="alert error">{error}</div>}

      {!items.length && (
        <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">Your cart is empty. Place a purchase order to add it here.</p>
          <button className="btn primary" onClick={() => navigate('/purchase-orders/new')}>Create Purchase Order</button>
        </div>
      )}

      {items.map((it) => (
        <OrderCard
          key={it.id}
          it={it}
          po={details[it.id]}
          checked={!!checked[it.id]}
          onCheck={(v) => setChecked({ ...checked, [it.id]: v })}
          onRemove={() => removeItem(it.id)}
        />
      ))}

      {!!items.length && (
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{items.length} order(s) in cart</strong>
            <strong>Cart value: <Money value={totalValue} /></strong>
          </div>
          <div className="row mt">
            <button className="btn accent" disabled={busy || !allChecked} onClick={placeOrders}>
              {busy ? 'Placing order…' : allChecked ? '✓ Place Order & Generate Invoice' : 'Crosscheck all orders to continue'}
            </button>
            <button className="btn" onClick={() => navigate('/purchase-orders')}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ it, po, checked, onCheck, onRemove }) {
  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="row" style={{ alignItems: 'center' }}>
        <h3 className="grow mono" style={{ margin: 0 }}>{it.poNumber}</h3>
        <StatusChip status={po?.status || it.status} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <input type="checkbox" checked={!!checked} onChange={(e) => onCheck(e.target.checked)} />
          I have crosschecked this order
        </label>
        <button className="btn sm" onClick={() => window.open(`/api/purchase-orders/${po?.id || it.id}/export/pdf`, '_blank')} title="Open Invoice PDF in new tab">View Full Details</button>
        <button className="btn sm danger" onClick={onRemove}>Remove</button>
      </div>
      {!po && <p className="muted">Loading order details…</p>}
      {po && (
        <>
          <table className="grid mt">
            <thead><tr><th>Product</th><th>Colour</th><th className="num">Qty</th><th className="num">Purch. price</th><th className="num">Margin %</th><th className="num">Discount</th><th className="num">Selling price</th><th className="num">Line total</th></tr></thead>
            <tbody>
              {(po.items || []).map((i) => (
                <tr key={i.id}>
                  <td>{i.product_name}<div className="mono muted">{i.sku}</div></td>
                  <td>{i.colour_name || '—'}</td>
                  <td className="num">{i.total_quantity}</td>
                  <td className="num"><Money value={i.purchase_price} /></td>
                  <td className="num">{i.margin_percent}%</td>
                  <td className="num">{i.discount_amount ? <Money value={i.discount_amount} /> : '—'}</td>
                  <td className="num"><Money value={i.final_value_per_unit} /></td>
                  <td className="num"><strong><Money value={i.line_total} /></strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row mt" style={{ justifyContent: 'flex-end', gap: 24 }}>
            <span>Supplier: <strong>{po.supplier_name}</strong></span>
            <span>Section: <strong>{po.section_name}</strong></span>
            <span>Grand total: <strong><Money value={po.grand_total} /></strong></span>
          </div>
        </>
      )}
    </div>
  );
}
