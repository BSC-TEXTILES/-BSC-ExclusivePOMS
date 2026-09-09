import { Money } from './DataTable.jsx';
import StatusChip from './StatusChip.jsx';

// Complete summary invoice — shown right after an order is placed at checkout.
// Contains every commercial detail: header, supplier, line items with the
// size-matrix quantities, purchase price, margin, discount, net/final selling
// price, taxes, charges, grand total and signature blocks. Printable.
export default function Invoice({ po, onClose }) {
  if (!po) return null;
  const qtyDisplay = (q) => Object.values(q || {}).map((x) => `${x.sizeLabel}:${x.quantity}`).join(' · ');
  const totalQty = (po.items || []).reduce((a, i) => a + (Number(i.total_quantity) || 0), 0);
  return (
    <div className="invoice-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="invoice-doc" id="poms-invoice-doc">
        <div className="invoice-head">
          <div>
            <h2 style={{ margin: 0 }}>BSC EXCLUSIVE</h2>
            <div className="muted">Purchase Order Management System — Summary Invoice</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontWeight: 700, fontSize: 18 }}>{po.po_number}</div>
            <div className="muted">Version {po.version} · <StatusChip status={po.status} /></div>
            <div className="muted">Date: {po.po_date ? new Date(po.po_date).toLocaleDateString('en-IN') : '—'}</div>
          </div>
        </div>

        <div className="invoice-parties">
          <div>
            <h4 style={{ margin: '0 0 4px' }}>Ordered By</h4>
            <div>{po.division_name} · {po.department_name}</div>
            <div>{po.section_name}</div>
            <div className="muted">Raised by {po.created_by_name}</div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 4px' }}>Supplier</h4>
            <div>{po.supplier_name} <span className="mono">({po.supplier_code})</span></div>
            <div className="mono muted">GSTIN: {po.supplier_gstin || '—'}</div>
            <div className="muted">Tax scheme: {po.tax_scheme}</div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 4px' }}>Delivery</h4>
            <div>Expected: {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
            <div className="muted">Remarks: {po.remarks || '—'}</div>
          </div>
        </div>

        <table className="grid invoice-lines">
          <thead>
            <tr><th>#</th><th>Product</th><th>Brand</th><th>Colour</th><th>Size quantities</th>
              <th className="num">Qty</th><th className="num">Purch. price</th><th className="num">Margin %</th>
              <th className="num">Net/unit</th><th className="num">Discount</th><th className="num">Selling price</th>
              <th className="num">Line total</th></tr>
          </thead>
          <tbody>
            {(po.items || []).map((it) => (
              <tr key={it.id}>
                <td>{it.line_no}</td>
                <td>{it.product_name}<div className="mono muted">{it.sku}</div></td>
                <td>{it.brand_name}</td>
                <td>{it.colour_name || '—'}</td>
                <td className="mono" style={{ maxWidth: 200 }}>{qtyDisplay(it.quantities)}</td>
                <td className="num">{it.total_quantity}</td>
                <td className="num"><Money value={it.purchase_price} /></td>
                <td className="num">{it.margin_percent}%</td>
                <td className="num"><Money value={it.net_value_per_unit} /></td>
                <td className="num">{it.discount_amount ? <Money value={it.discount_amount} /> : '—'}</td>
                <td className="num"><strong><Money value={it.final_value_per_unit} /></strong></td>
                <td className="num"><Money value={it.line_total} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div><span>Total quantity</span><strong>{totalQty}</strong></div>
          <div><span>Subtotal</span><Money value={po.subtotal} /></div>
          <div><span>Order discount</span><span>− <Money value={po.order_discount_amount} /></span></div>
          {(po.taxes || []).map((t) => (
            <div key={t.id}><span>{t.tax_name} @ {t.rate}%</span><Money value={t.tax_amount} /></div>
          ))}
          {(po.charges || []).map((c) => (
            <div key={c.id}><span>Charge — {c.charge_type}</span><Money value={c.amount} /></div>
          ))}
          <div className="invoice-grand"><span>Grand total</span><strong><Money value={po.grand_total} /></strong></div>
        </div>

        <div className="invoice-sign">
          <div>Authorised Signatory (Buyer)</div>
          <div>Authorised Signatory (Supplier)</div>
        </div>
        <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          This is a computer-generated summary invoice from BSC Exclusive POMS. Totals are server-computed (RB-017).
        </p>
      </div>
      <div className="invoice-actions no-print">
        <button className="btn primary" onClick={() => window.print()}>🖨 Print / Save as PDF</button>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}