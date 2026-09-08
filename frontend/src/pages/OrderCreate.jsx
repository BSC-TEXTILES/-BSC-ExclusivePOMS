import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import Icon from '../components/Icon.jsx';

const STEPS = [
  { key: 'customer', label: 'Customer', icon: 'user' },
  { key: 'orderInfo', label: 'Order Info', icon: 'info' },
  { key: 'products', label: 'Products', icon: 'package' },
  { key: 'review', label: 'Review', icon: 'check-circle' },
  { key: 'submit', label: 'Submit', icon: 'send' },
];

const EMPTY_ITEM = {
  productId: '',
  sheetId: '',
  sizeLabel: '',
  quantity: 1,
  unitPrice: 0,
  taxPercent: 18,
  discountValue: 0,
  productionNotes: '',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function OrderCreate() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sheetsMap, setSheetsMap] = useState({});

  const [form, setForm] = useState({
    customerId: '',
    requiredDate: '',
    priority: 'normal',
    notes: '',
    items: [{ ...EMPTY_ITEM }],
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/customers'),
      api.get('/api/products'),
    ])
      .then(([cRes, pRes]) => {
        setCustomers(cRes.data);
        setProducts(pRes.data);
      })
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const loadSheets = async (productId, itemIndex) => {
    if (!productId || sheetsMap[productId]) return;
    try {
      const res = await api.get(`/api/product-sheets?productId=${productId}`);
      setSheetsMap((prev) => ({ ...prev, [productId]: res.data }));
    } catch (err) {
      setError(errMessage(err));
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'productId') {
        items[index].sheetId = '';
      }
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items };
    });
  };

  const calcItemTotal = (item) => {
    const base = item.quantity * item.unitPrice;
    const tax = base * (item.taxPercent / 100);
    return base + tax - item.discountValue;
  };

  const calcGrandTotal = () => {
    return form.items.reduce((sum, item) => sum + calcItemTotal(item), 0);
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!form.customerId;
      case 1:
        return !!form.requiredDate;
      case 2:
        return form.items.every(
          (it) => it.productId && it.quantity > 0 && it.unitPrice >= 0
        );
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async (asDraft = false) => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        customerId: form.customerId,
        requiredDate: form.requiredDate,
        priority: form.priority,
        notes: form.notes,
        status: asDraft ? 'draft' : undefined,
        items: form.items.map((it) => ({
          productId: it.productId,
          sheetId: it.sheetId || undefined,
          sizeLabel: it.sizeLabel,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxPercent: it.taxPercent,
          discountValue: it.discountValue,
          productionNotes: it.productionNotes,
        })),
      };
      await api.post('/api/om-orders', payload);
      navigate('/om-orders');
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (canProceed() && step < STEPS.length - 1) {
      setStep(step + 1);
      setError('');
    }
  };

  const prev = () => {
    if (step > 0) {
      setStep(step - 1);
      setError('');
    }
  };

  const goTo = (idx) => {
    if (idx <= step) {
      setStep(idx);
      setError('');
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Create Order</h1>
      </div>

      <div className="stepper">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => goTo(i)}
          >
            <span className="step-icon">
              <Icon name={i < step ? 'check' : s.icon} />
            </span>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel">
        {step === 0 && (
          <div className="step-customer">
            <h2>Select Customer</h2>
            <div className="field">
              <label className="field-label">Customer *</label>
              <select
                className="form-select"
                value={form.customerId}
                onChange={(e) => updateField('customerId', e.target.value)}
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="step-order-info">
            <h2>Order Information</h2>
            <div className="fields-2">
              <div className="field">
                <label className="field-label">Required Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.requiredDate}
                  onChange={(e) => updateField('requiredDate', e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">Priority</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="field-label">Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Optional order notes..."
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-products">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Order Items</h2>
              <button className="btn btn-sm btn-success" onClick={addItem} type="button">
                <Icon name="plus" /> Add Item
              </button>
            </div>

            {form.items.map((item, idx) => {
              const itemTotal = calcItemTotal(item);
              return (
                <div key={idx} className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-header row" style={{ justifyContent: 'space-between' }}>
                    <strong>Item {idx + 1}</strong>
                    {form.items.length > 1 && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeItem(idx)}
                        type="button"
                      >
                        <Icon name="trash" /> Remove
                      </button>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="fields-3">
                      <div className="field">
                        <label className="field-label">Product *</label>
                        <select
                          className="form-select"
                          value={item.productId}
                          onChange={(e) => {
                            updateItem(idx, 'productId', e.target.value);
                            loadSheets(e.target.value, idx);
                          }}
                        >
                          <option value="">-- Select Product --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Sheet / Color</label>
                        <select
                          className="form-select"
                          value={item.sheetId}
                          onChange={(e) => updateItem(idx, 'sheetId', e.target.value)}
                          disabled={!item.productId}
                        >
                          <option value="">-- Select Sheet --</option>
                          {(sheetsMap[item.productId] || []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name || s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Size</label>
                        <input
                          type="text"
                          className="form-input"
                          value={item.sizeLabel}
                          onChange={(e) => updateItem(idx, 'sizeLabel', e.target.value)}
                          placeholder="e.g. 12x18"
                        />
                      </div>
                    </div>
                    <div className="fields-3">
                      <div className="field">
                        <label className="field-label">Quantity *</label>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                          }
                        />
                      </div>
                      <div className="field">
                        <label className="field-label">Unit Price *</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="field">
                        <label className="field-label">Tax %</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          max={100}
                          step={0.5}
                          value={item.taxPercent}
                          onChange={(e) =>
                            updateItem(idx, 'taxPercent', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                    <div className="fields-3">
                      <div className="field">
                        <label className="field-label">Discount</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={0.01}
                          value={item.discountValue}
                          onChange={(e) =>
                            updateItem(idx, 'discountValue', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="field">
                        <label className="field-label">Production Notes</label>
                        <input
                          type="text"
                          className="form-input"
                          value={item.productionNotes}
                          onChange={(e) => updateItem(idx, 'productionNotes', e.target.value)}
                          placeholder="Optional..."
                        />
                      </div>
                      <div className="field">
                        <label className="field-label">Line Total</label>
                        <div className="form-input" style={{ fontWeight: 600, background: '#f0f0f0' }}>
                          {itemTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <strong>Grand Total: {calcGrandTotal().toFixed(2)}</strong>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-review">
            <h2>Review Order</h2>
            <div className="fields-2" style={{ marginBottom: '1.5rem' }}>
              <div className="field">
                <label className="field-label">Customer</label>
                <div>{customers.find((c) => c.id === form.customerId)?.name || '—'}</div>
              </div>
              <div className="field">
                <label className="field-label">Required Date</label>
                <div>{form.requiredDate}</div>
              </div>
              <div className="field">
                <label className="field-label">Priority</label>
                <div>{form.priority}</div>
              </div>
              <div className="field">
                <label className="field-label">Notes</label>
                <div>{form.notes || '—'}</div>
              </div>
            </div>

            <h3>Items</h3>
            <div className="grid" style={{ marginBottom: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Sheet</th>
                    <th>Size</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Tax %</th>
                    <th>Discount</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => {
                    const productName = products.find((p) => p.id === item.productId)?.name || '—';
                    const sheetList = sheetsMap[item.productId] || [];
                    const sheetName = sheetList.find((s) => s.id === item.sheetId)?.name || '—';
                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{productName}</td>
                        <td>{sheetName}</td>
                        <td>{item.sizeLabel || '—'}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unitPrice.toFixed(2)}</td>
                        <td>{item.taxPercent}%</td>
                        <td>{item.discountValue.toFixed(2)}</td>
                        <td><strong>{calcItemTotal(item).toFixed(2)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <h3>Grand Total: {calcGrandTotal().toFixed(2)}</h3>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="step-submit">
            <h2>Submit Order</h2>
            <p>Choose how to submit this order:</p>
            <div className="row" style={{ gap: '1rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                type="button"
              >
                <Icon name="save" /> Save as Draft
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                type="button"
              >
                <Icon name="send" /> Submit Order
              </button>
            </div>
            {submitting && <div className="loading" style={{ marginTop: '1rem' }}>Submitting...</div>}
          </div>
        )}
      </div>

      <div className="form-actions">
        {step > 0 && (
          <button className="btn btn-secondary" onClick={prev} type="button" disabled={submitting}>
            <Icon name="chevron-left" /> Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button className="btn btn-primary" onClick={next} type="button" disabled={!canProceed()}>
            Next <Icon name="chevron-right" />
          </button>
        )}
      </div>
    </div>
  );
}
