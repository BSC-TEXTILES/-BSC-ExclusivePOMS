import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth, useCart } from '../auth.jsx';
import { Field, Money } from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';

const STEPS = ['Division & Section', 'Supplier', 'Products & Quantities', 'Commercials', 'Review'];
const EMPTY_LINE = { productId: '', colourId: '', purchasePrice: '', marginPercent: '0', discountType: 'percent', discountValue: '0', commercialReason: '', quantities: {} };

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// Client-side preview of the §13.1 formula — the server remains authoritative (RB-017).
function previewLine(line) {
  const pp = Number(line.purchasePrice) || 0;
  const m = Number(line.marginPercent) || 0;
  const marginAmount = round2(pp * m / 100);
  const net = round2(pp + marginAmount);
  const dv = Number(line.discountValue) || 0;
  const discount = line.discountType === 'flat' ? round2(dv) : round2(net * dv / 100);
  const final = round2(net - discount);
  const totalQty = Object.values(line.quantities || {}).reduce((a, q) => a + (Number(q) || 0), 0);
  return { marginAmount, net, discount, final, totalQty, lineTotal: round2(final * totalQty) };
}

export default function POCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, user, selectedSectionId } = useAuth();
  const { addItem: addToCart } = useCart();
  const editId = searchParams.get('edit');

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [colours, setColours] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [gstPercent, setGstPercent] = useState(18);

  const [header, setHeader] = useState({ divisionId: '', departmentId: '', sectionId: '', supplierId: '', taxScheme: 'GST_INTRA', expectedDeliveryDate: '', remarks: '' });
  const [lines, setLines] = useState([]);
  const [orderDiscount, setOrderDiscount] = useState({ type: 'percent', value: '0', reason: '' });
  const [charges, setCharges] = useState([]);

  // Pre-select section if one is selected in auth context
  useEffect(() => {
    if (selectedSectionId && !header.sectionId) {
      setHeader((h) => ({ ...h, sectionId: selectedSectionId }));
    }
  }, [selectedSectionId, header.sectionId]);

  // Inline "Other" quick-create state (§10.3 progressive catalogue)
  const [inline, setInline] = useState(null); // {kind, fields...}
  const [inlineForm, setInlineForm] = useState({});

  useEffect(() => {
    Promise.all([api.get('/divisions'), api.get('/departments'), api.get('/suppliers'), api.get('/colours'), api.get('/settings')])
      .then(([d, dep, sup, col, set]) => {
        setDivisions(d.data.data);
        setDepartments(dep.data.data);
        setSuppliers(sup.data.data.filter((s) => s.status === 'active'));
        setColours(col.data.data);
        const gst = set.data.data.find((x) => x.key === 'gst_percent');
        if (gst) setGstPercent(Number(gst.value));
        const nonSuper = !user.isSuperAdmin;
        if (nonSuper && d.data.data.length === 1) {
          setHeader((h) => ({ ...h, divisionId: d.data.data[0].id }));
        }
      })
      .catch((e) => setError(errMessage(e)));
  }, []);

  // Load sections for chosen division's departments (active only, RB-002),
  // restricted to the collections this user is authorized for.
  useEffect(() => {
    if (!header.divisionId) return;
    api.get('/sections', { params: { status: 'active' } }).then((r) => {
      const allowed = user.isSuperAdmin || !(user.sectionIds || []).length
        ? (r.data.data || [])
        : (r.data.data || []).filter((s) => user.sectionIds.includes(s.id));
      setSections(allowed);
    }).catch(() => {});
  }, [header.divisionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the section's size columns (§9.3 matrix shape is data-driven, TC-04)
  useEffect(() => {
    if (!header.sectionId) { setSizes([]); return; }
    api.get(`/sections/${header.sectionId}/sizes`).then((r) => setSizes(r.data.data || [])).catch(() => {});
  }, [header.sectionId]);

  // Products for the section
  useEffect(() => {
    if (!header.sectionId) { setProducts([]); return; }
    api.get('/products', { params: { sectionId: header.sectionId, status: 'active', pageSize: 500 } }).then((r) => setProducts(r.data.data || [])).catch(() => {});
  }, [header.sectionId]);

  // Editing a draft (PE-04/PM workflow)
  useEffect(() => {
    if (!editId) return;
    api.get(`/purchase-orders/${editId}`).then(({ data: { data: po } }) => {
      if (po.status !== 'draft') { setError('Only draft POs can be edited (RB-011).'); return; }
      setHeader({
        divisionId: po.division_id, departmentId: po.department_id, sectionId: po.section_id, supplierId: po.supplier_id,
        taxScheme: po.tax_scheme || 'GST_INTRA', expectedDeliveryDate: po.expected_delivery_date || '', remarks: po.remarks || '',
      });
      setLines(po.items.map((i) => ({
        productId: i.product_id, colourId: i.colour_id || '', purchasePrice: String(i.purchase_price),
        marginPercent: String(i.margin_percent), discountType: i.discount_type || 'percent',
        discountValue: String(i.discount_value || 0), commercialReason: '',
        quantities: Object.fromEntries((i.quantities || []).map((q) => [q.sizeLabel, q.quantity])),
        _sizeIdByLabel: Object.fromEntries(sizes.map((s) => [s.label, s.id])),
      })));
      const od = po.discounts?.[0];
      if (od) setOrderDiscount({ type: od.discount_type, value: String(od.discount_value), reason: od.reason || '' });
      setCharges((po.charges || []).map((c) => ({ type: c.charge_type, description: c.description || '', amount: String(c.amount) })));
    }).catch((e) => setError(errMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const totals = useMemo(() => {
    const lineTotals = lines.map(previewLine);
    const subtotal = round2(lineTotals.reduce((a, t) => a + t.lineTotal, 0));
    const odv = Number(orderDiscount.value) || 0;
    const orderDisc = odv > 0 ? (orderDiscount.type === 'flat' ? round2(odv) : round2(subtotal * odv / 100)) : 0;
    const taxable = round2(subtotal - orderDisc);
    const tax = round2(taxable * gstPercent / 100);
    const chargesTotal = round2(charges.reduce((a, c) => a + (Number(c.amount) || 0), 0));
    return { lineTotals, subtotal, orderDisc, tax, chargesTotal, grandTotal: round2(taxable + tax + chargesTotal) };
  }, [lines, orderDiscount, charges, gstPercent]);

  function validateStep(idx) {
    setError('');
    if (idx === 0 && (!header.divisionId || !header.departmentId || !header.sectionId)) { setError('Select division, department and an active section.'); return false; }
    if (idx === 1 && !header.supplierId) { setError('Select a supplier.'); return false; }
    if (idx === 2) {
      if (!lines.length) { setError('Add at least one product line.'); return false; }
      for (const [i, l] of lines.entries()) {
        if (!l.productId) { setError(`Line ${i + 1}: choose a product.`); return false; }
        if (previewLine(l).totalQty <= 0) { setError(`Line ${i + 1}: enter size-wise quantities (RB-006/RB-007).`); return false; }
      }
    }
    return true;
  }
  function go(next) {
    if (next > step && !validateStep(step)) return;
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  function addLine() { setLines([...lines, { ...EMPTY_LINE, quantities: {} }]); }
  function updateLine(i, patch) { setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l))); }
  function removeLine(i) { setLines(lines.filter((_, j) => j !== i)); }

  async function quickCreate() {
    setBusy(true); setError('');
    try {
      if (inline === 'supplier') {
        const { data } = await api.post('/suppliers', { ...inlineForm, divisionIds: [header.divisionId], paymentTerms: 'net_30' });
        setSuppliers((s) => [...s, data.data]); setHeader((h) => ({ ...h, supplierId: data.data.id }));
      } else if (inline === 'colour') {
        const { data } = await api.post('/colours', { name: inlineForm.name, isCustom: true });
        setColours((c) => [...c, data.data]);
      } else if (inline === 'product') {
        const prod = products[0];
        const { data } = await api.post('/products', {
          sku: inlineForm.sku, name: inlineForm.name, brandId: inlineForm.brandId,
          sectionId: header.sectionId, categoryId: prod?.category_id || null,
        });
        setProducts((p) => [...p, data.data]);
      }
      setInline(null); setInlineForm({});
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  function payload() {
    return {
      ...header,
      expectedDeliveryDate: header.expectedDeliveryDate || null,
      lines: lines.map((l) => ({
        productId: l.productId, colourId: l.colourId || null,
        purchasePrice: Number(l.purchasePrice), marginPercent: Number(l.marginPercent),
        discountType: Number(l.discountValue) > 0 ? l.discountType : null,
        discountValue: Number(l.discountValue) || 0,
        commercialReason: l.commercialReason || undefined,
        quantities: sizes
          .map((s) => ({ sizeId: s.id, quantity: Number(l.quantities[s.label]) || 0 }))
          .filter((q) => q.quantity > 0),
      })),
      orderDiscount: Number(orderDiscount.value) > 0 ? { type: orderDiscount.type, value: Number(orderDiscount.value), reason: orderDiscount.reason || undefined } : null,
      charges: charges.filter((c) => Number(c.amount) > 0).map((c) => ({ type: c.type, description: c.description, amount: Number(c.amount) })),
    };
  }

  async function save(andSubmit) {
    for (let i = 0; i < 3; i++) { if (!validateStep(i)) { setStep(i); return; } }
    setBusy(true); setError('');
    try {
      let poId = editId;
      let created = null;
      if (editId) await api.put(`/purchase-orders/${editId}`, payload());
      else {
        created = (await api.post('/purchase-orders', payload())).data.data;
        poId = created.id;
        addToCart(created); // order lands in the top-nav cart for crosscheck & checkout
      }
      if (andSubmit) await api.post(`/purchase-orders/${poId}/submit`);
      navigate(`/purchase-orders/${poId}`, { state: { submitted: andSubmit } });
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  const deptSections = sections.filter((s) => s.department_id === header.departmentId);

  return (
    <div className="page">
      <h1 className="page-title">{editId ? 'Edit Draft PO' : 'Create Master PO'}</h1>
      <p className="page-sub">Guided creation (§12.2) — totals shown are a preview; the server recalculates everything before persistence (RB-017).</p>

      <div className="stepper">
        {STEPS.map((label, i) => (
          <div key={label} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`} onClick={() => go(i)} style={{ cursor: 'pointer' }}>
            {i < step ? '✓ ' : ''}{i + 1}. {label}
          </div>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      {step === 0 && (
        <div className="panel">
          <div className="fields-3">
            <Field label="Division (§5)">
              <select value={header.divisionId} onChange={(e) => setHeader({ ...header, divisionId: e.target.value, departmentId: '', sectionId: '' })}>
                <option value="">— select —</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Department">
              <select value={header.departmentId} onChange={(e) => setHeader({ ...header, departmentId: e.target.value, sectionId: '' })} disabled={!header.divisionId}>
                <option value="">— select —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Section (active only, RB-002)" hint={`Sizing method drives the matrix columns`}>
              <select value={header.sectionId} onChange={(e) => setHeader({ ...header, sectionId: e.target.value })} disabled={!header.departmentId}>
                <option value="">— select —</option>
                {deptSections.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.sizing_method_name}</option>)}
              </select>
            </Field>
          </div>
          <button className="btn primary" onClick={() => go(1)}>Next →</button>
        </div>
      )}

      {step === 1 && (
        <div className="panel">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Supplier / Dealer (§11)">
              <select value={header.supplierId} onChange={(e) => setHeader({ ...header, supplierId: e.target.value })} style={{ minWidth: 320 }}>
                <option value="">— select —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name} ({s.code})</option>)}
              </select>
            </Field>
            <button className="btn" onClick={() => { setInline('supplier'); setInlineForm({ code: '', companyName: '', contactPerson: '', gstin: '' }); }}>+ Other / New Supplier</button>
          </div>
          <button className="btn primary" onClick={() => go(2)}>Next →</button>
        </div>
      )}

      {step === 2 && (
        <div className="panel">
          <div className="row" style={{ marginBottom: 12 }}>
            <strong>Product lines ({lines.length})</strong>
            <button className="btn primary sm right" onClick={addLine} disabled={!header.sectionId}>+ Add line</button>
          </div>

          {lines.map((line, i) => {
            const pv = previewLine(line);
            const product = products.find((p) => p.id === line.productId);
            return (
              <div key={i} className="panel" style={{ background: '#fafbfd' }}>
                <div className="fields-3">
                  <Field label={`Line ${i + 1} — Product (section-filtered)`}>
                    <select value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                      <option value="">— select —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.brand_name}</option>)}
                    </select>
                    {product && (
                      <span className="field-hint">
                        Brand {product.brand_name} · Manufacturer: {product.manufacturer || '—'} · Providers: {(product.providers || []).join(', ') || '—'}
                      </span>
                    )}
                  </Field>
                  <Field label="Colour">
                    <select value={line.colourId} onChange={(e) => updateLine(i, { colourId: e.target.value })}>
                      <option value="">— none —</option>
                      {colours.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <div className="row" style={{ alignItems: 'flex-end' }}>
                    <button className="btn sm" onClick={() => { setInline('colour'); setInlineForm({ name: '' }); }}>+ Other colour</button>
                    <button className="btn sm" onClick={() => { setInline('product'); setInlineForm({ sku: '', name: '', brandId: '' }); }}>+ Other product</button>
                    <button className="btn sm danger right" onClick={() => removeLine(i)}>Remove</button>
                  </div>
                </div>

                <div className="fields-3">
                  <Field label="Purchase price / unit (₹)" hint="RB-008: cannot be negative">
                    <input type="number" min="0" value={line.purchasePrice} onChange={(e) => updateLine(i, { purchasePrice: e.target.value })} />
                  </Field>
                  <Field label="Margin %" hint="RB-010 policy applies">
                    <input type="number" min="0" value={line.marginPercent} onChange={(e) => updateLine(i, { marginPercent: e.target.value })} />
                  </Field>
                  <div className="row">
                    <Field label="Discount">
                      <select value={line.discountType} onChange={(e) => updateLine(i, { discountType: e.target.value })}>
                        <option value="percent">%</option><option value="flat">Flat ₹</option>
                      </select>
                    </Field>
                    <Field label="Value"><input type="number" min="0" value={line.discountValue} onChange={(e) => updateLine(i, { discountValue: e.target.value })} /></Field>
                  </div>
                </div>

                <table className="grid matrix-table">
                  <thead>
                    <tr>
                      <th>Colour × Size</th>
                      {sizes.map((s) => <th key={s.id} className="num">{s.label}</th>)}
                      <th className="num">Total</th>
                      <th className="num">Net/unit</th><th className="num">Final/unit</th><th className="num">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="muted">{colours.find((c) => c.id === line.colourId)?.name || product?.name || 'quantities'}</td>
                      {sizes.map((s) => (
                        <td key={s.id} className="num">
                          <input type="number" min="0" value={line.quantities[s.label] ?? ''} onChange={(e) => updateLine(i, { quantities: { ...line.quantities, [s.label]: e.target.value } })} />
                        </td>
                      ))}
                      <td className="num"><strong>{pv.totalQty}</strong></td>
                      <td className="num">₹{pv.net.toFixed(2)}</td>
                      <td className="num">₹{pv.final.toFixed(2)}</td>
                      <td className="num"><strong><Money value={pv.lineTotal} /></strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {!lines.length && <p className="muted">No lines yet — add a line, pick a product and fill the size matrix.</p>}
          <div className="row mt">
            <button className="btn" onClick={() => go(1)}>← Back</button>
            <button className="btn primary right" onClick={() => go(3)}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="panel">
          <h3>Order-level commercials (§13.2)</h3>
          <div className="fields-3">
            <Field label="Order discount type">
              <select value={orderDiscount.type} onChange={(e) => setOrderDiscount({ ...orderDiscount, type: e.target.value })}>
                <option value="percent">Percent %</option><option value="flat">Flat ₹</option>
              </select>
            </Field>
            <Field label="Value" hint={`RB-009: over-policy needs exception approval`}>
              <input type="number" min="0" value={orderDiscount.value} onChange={(e) => setOrderDiscount({ ...orderDiscount, value: e.target.value })} />
            </Field>
            <Field label="Reason (mandatory if over policy)">
              <input value={orderDiscount.reason} onChange={(e) => setOrderDiscount({ ...orderDiscount, reason: e.target.value })} />
            </Field>
          </div>

          <h3 className="mt">Additional charges</h3>
          {charges.map((c, i) => (
            <div className="row" key={i}>
              <Field label="Type">
                <select value={c.type} onChange={(e) => setCharges(charges.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}>
                  {['freight','packing','transport','installation','assembly','other'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Description"><input value={c.description} onChange={(e) => setCharges(charges.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /></Field>
              <Field label="Amount (₹)"><input type="number" min="0" value={c.amount} onChange={(e) => setCharges(charges.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} /></Field>
              <button className="btn sm danger" style={{ alignSelf: 'flex-end' }} onClick={() => setCharges(charges.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn sm" onClick={() => setCharges([...charges, { type: 'freight', description: '', amount: '' }])}>+ Add charge</button>

          <div className="fields-3 mt">
            <Field label="Tax scheme">
              <select value={header.taxScheme} onChange={(e) => setHeader({ ...header, taxScheme: e.target.value })}>
                <option value="GST_INTRA">GST Intra-state (CGST+SGST)</option>
                <option value="GST_INTER">GST Inter-state (IGST)</option>
              </select>
            </Field>
            <Field label="Expected delivery date"><input type="date" value={header.expectedDeliveryDate} onChange={(e) => setHeader({ ...header, expectedDeliveryDate: e.target.value })} /></Field>
            <Field label="Remarks"><input value={header.remarks} onChange={(e) => setHeader({ ...header, remarks: e.target.value })} /></Field>
          </div>

          <div className="row mt">
            <button className="btn" onClick={() => go(2)}>← Back</button>
            <button className="btn primary right" onClick={() => go(4)}>Review →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="panel">
          <h3>Review — server will recompute these values (RB-017)</h3>
          <table className="grid">
            <thead><tr><th>Product</th><th>Colour</th><th className="num">Qty</th><th className="num">Net/unit</th><th className="num">Final/unit</th><th className="num">Line total</th></tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const p = products.find((x) => x.id === l.productId);
                const pv = totals.lineTotals[i];
                return (
                  <tr key={i}>
                    <td>{p?.name || '—'}</td>
                    <td>{colours.find((c) => c.id === l.colourId)?.name || '—'}</td>
                    <td className="num">{pv.totalQty}</td>
                    <td className="num">₹{pv.net.toFixed(2)}</td>
                    <td className="num">₹{pv.final.toFixed(2)}</td>
                    <td className="num"><Money value={pv.lineTotal} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="totals-bar mt">
            <div><div className="t-label">Subtotal</div><div className="t-value"><Money value={totals.subtotal} /></div></div>
            <div><div className="t-label">Order discount</div><div className="t-value">− <Money value={totals.orderDisc} /></div></div>
            <div><div className="t-label">Tax ({gstPercent}%)</div><div className="t-value"><Money value={totals.tax} /></div></div>
            <div><div className="t-label">Charges</div><div className="t-value"><Money value={totals.chargesTotal} /></div></div>
            <div className="right"><div className="t-label">Grand total</div><div className="t-value"><Money value={totals.grandTotal} /></div></div>
          </div>
          <div className="row mt">
            <button className="btn" onClick={() => go(3)}>← Back</button>
            {hasPermission('po.submit')
              ? <button className="btn accent right" disabled={busy} onClick={() => save(true)}>{busy ? 'Working…' : 'Save & Submit for approval'}</button>
              : null}
            <button className="btn primary" style={!hasPermission('po.submit') ? { marginLeft: 'auto' } : {}} disabled={busy} onClick={() => save(false)}>
              {editId ? 'Save draft changes' : 'Save draft'}
            </button>
          </div>
        </div>
      )}

      {inline && (
        <Modal title={`Other — create ${inline === 'supplier' ? 'supplier' : inline === 'colour' ? 'colour (flagged custom, RB-016)' : 'product'}`} onClose={() => setInline(null)}>
          {inline === 'supplier' && (
            <div className="fields-2">
              <Field label="Code"><input value={inlineForm.code || ''} onChange={(e) => setInlineForm({ ...inlineForm, code: e.target.value })} /></Field>
              <Field label="Company name"><input value={inlineForm.companyName || ''} onChange={(e) => setInlineForm({ ...inlineForm, companyName: e.target.value })} /></Field>
              <Field label="Contact person"><input value={inlineForm.contactPerson || ''} onChange={(e) => setInlineForm({ ...inlineForm, contactPerson: e.target.value })} /></Field>
              <Field label="GSTIN"><input value={inlineForm.gstin || ''} onChange={(e) => setInlineForm({ ...inlineForm, gstin: e.target.value })} /></Field>
            </div>
          )}
          {inline === 'colour' && (
            <Field label="Colour name" hint="Duplicate names are rejected (§9.2). Entry is flagged custom (RB-016).">
              <input value={inlineForm.name || ''} onChange={(e) => setInlineForm({ name: e.target.value })} />
            </Field>
          )}
          {inline === 'product' && (
            <div className="fields-2">
              <Field label="SKU"><input value={inlineForm.sku || ''} onChange={(e) => setInlineForm({ ...inlineForm, sku: e.target.value })} /></Field>
              <Field label="Product name"><input value={inlineForm.name || ''} onChange={(e) => setInlineForm({ ...inlineForm, name: e.target.value })} /></Field>
              <Field label="Brand">
                <select value={inlineForm.brandId || ''} onChange={(e) => setInlineForm({ ...inlineForm, brandId: e.target.value })}>
                  <option value="">— select —</option>
                  {[...new Map(products.map((p) => [p.brand_id, p.brand_name])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </Field>
            </div>
          )}
          <button className="btn primary" disabled={busy} onClick={quickCreate}>Create & select</button>
        </Modal>
      )}
    </div>
  );
}
