import { useEffect, useState, useCallback } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Modal from '../components/Modal.jsx';
import { Field } from '../components/DataTable.jsx';

const TABS = ['Departments', 'Sections', 'Brands', 'Products', 'Colours', 'Suppliers'];

export default function Masters() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('masters.manage');
  const [tab, setTab] = useState('Sections');
  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({ departments: [], sizeMethods: [], divisions: [], sections: [], brands: [] });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    const req = {
      Departments: () => api.get('/departments'),
      Sections: () => api.get('/sections'),
      Brands: () => api.get('/brands'),
      Products: () => api.get('/products'),
      Colours: () => api.get('/colours'),
      Suppliers: () => api.get('/suppliers'),
    }[tab];
    req().then((r) => setRows(r.data.data || [])).catch((e) => setError(errMessage(e)));
  }, [tab]);

  useEffect(load, [load]);
  useEffect(() => {
    Promise.all([api.get('/departments'), api.get('/size-methods'), api.get('/divisions'), api.get('/sections'), api.get('/brands')])
      .then(([d, m, v, s, b]) => setRefs({ departments: d.data.data || [], sizeMethods: m.data.data || [], divisions: v.data.data || [], sections: s.data.data || [], brands: b.data.data || [] }))
      .catch(() => {});
  }, []);

  function openNew() {
    const blank = {
      Departments: { code: '', name: '', isGlobal: false, divisionId: '' },
      Sections: { code: '', name: '', departmentId: '', sizingMethodId: '', displayOrder: 0 },
      Brands: { brandNumber: '', brandSerial: '', brandName: '', manufacturer: '' },
      Products: { sku: '', name: '', brandId: '', sectionId: '' },
      Colours: { name: '' },
      Suppliers: { code: '', companyName: '', contactPerson: '', gstin: '', paymentTerms: 'net_30', divisionIds: [] },
    }[tab];
    setEditing({}); setForm(blank);
  }
  function openEdit(row) {
    setEditing(row);
    const mapped = {
      Departments: { ...row, isGlobal: !!row.is_global },
      Sections: { ...row, departmentId: row.department_id, sizingMethodId: row.sizing_method_id, displayOrder: row.display_order },
      Brands: { brandNumber: row.brand_number, brandSerial: row.brand_serial, brandName: row.brand_name, manufacturer: row.manufacturer },
      Products: { sku: row.sku, name: row.name, brandId: row.brand_id, sectionId: row.section_id },
      Colours: { name: row.name, colourFamily: row.colour_family },
      Suppliers: { ...row, divisionIds: row.division_ids },
    }[tab];
    setForm(mapped);
  }

  async function save() {
    setBusy(true); setError('');
    try {
      if (tab === 'Departments') {
        if (editing.id) await api.patch(`/departments/${editing.id}`, { name: form.name, status: form.status });
        else await api.post('/departments', form);
      } else if (tab === 'Sections') {
        if (editing.id) await api.patch(`/sections/${editing.id}`, { name: form.name, sizingMethodId: form.sizingMethodId, displayOrder: Number(form.displayOrder) || 0 });
        else await api.post('/sections', { ...form, displayOrder: Number(form.displayOrder) || 0 });
      } else if (tab === 'Brands') {
        if (editing.id) await api.patch(`/brands/${editing.id}`, { brandName: form.brandName, brandCode: form.brandCode, manufacturer: form.manufacturer });
        else await api.post('/brands', form);
      } else if (tab === 'Products') {
        if (editing.id) await api.patch(`/products/${editing.id}`, { name: form.name });
        else await api.post('/products', form);
      } else if (tab === 'Colours') {
        if (editing.id) await api.patch(`/colours/${editing.id}`, form);
        else await api.post('/colours', form);
      } else if (tab === 'Suppliers') {
        if (editing.id) await api.patch(`/suppliers/${editing.id}`, form);
        else await api.post('/suppliers', form);
      }
      setEditing(null); load();
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  }

  async function lifecycle(row, status) {
    setError('');
    try {
      await api.patch(tab === 'Departments' ? `/departments/${row.id}` : `/sections/${row.id}`, { status });
      load();
    } catch (e) { setError(errMessage(e)); }
  }

  const toggleDivision = (id) => {
    const cur = form.divisionIds || [];
    setForm({ ...form, divisionIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  return (
    <div className="page">
      <h1 className="page-title">Master Data</h1>
      <p className="page-sub">Configuration-driven masters — no code changes needed to evolve the catalogue (§7, §8)</p>
      {error && <div className="alert error">{error}</div>}

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          {canManage && <button className="btn primary" onClick={openNew}>+ New {tab.replace(/s$/, '')}</button>}
        </div>

        {tab === 'Departments' && (
          <>
            <p className="muted" style={{ margin: '0 0 10px' }}>
              Departments are the collection groups shown in the left navigation (e.g. Men's Collection, Women's Ethnic, Cricket, Furniture).
              Create as many as you need — each one can hold unlimited sections.
            </p>
            <table className="grid">
              <thead><tr><th>Code</th><th>Department</th><th>Scope</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.code}</td>
                    <td><strong>{d.name}</strong></td>
                    <td>{d.is_global ? 'Global (all divisions)' : refs.divisions.find((v) => v.id === d.division_id)?.name || '—'}</td>
                    <td><StatusChip status={d.status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {canManage && d.status === 'active' && <>
                        <button className="btn sm" onClick={() => openEdit(d)}>Edit</button>{' '}
                        <button className="btn sm" onClick={() => lifecycle(d, 'inactive')}>Deactivate</button>{' '}
                        <button className="btn sm" onClick={() => lifecycle(d, 'archived')}>Archive</button>
                      </>}
                      {canManage && d.status !== 'active' && <button className="btn sm ok" onClick={() => lifecycle(d, 'active')}>Activate</button>}
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No departments yet</td></tr>}
              </tbody>
            </table>
          </>
        )}

        {tab === 'Sections' && (
          <table className="grid">
            <thead><tr><th>Code</th><th>Section</th><th>Department</th><th>Sizing method</th><th className="num">PO history</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.code}</td>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.department_name}</td>
                  <td>{s.sizing_method_name}</td>
                  <td className="num">{s.transaction_count}</td>
                  <td><StatusChip status={s.status} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {canManage && s.status === 'active' && <>
                      <button className="btn sm" onClick={() => openEdit(s)}>Edit</button>{' '}
                      <button className="btn sm" onClick={() => lifecycle(s, 'inactive')}>Deactivate</button>{' '}
                      <button className="btn sm" onClick={() => lifecycle(s, 'archived')}>Archive</button>
                    </>}
                    {canManage && s.status !== 'active' && <button className="btn sm ok" onClick={() => lifecycle(s, 'active')}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'Brands' && (
          <table className="grid">
            <thead><tr><th>Brand No.</th><th>Brand Serial</th><th>Name</th><th>Manufacturer</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.brand_number}</td>
                  <td className="mono">{b.brand_serial}</td>
                  <td><strong>{b.brand_name}</strong></td>
                  <td>{b.manufacturer || '—'}</td>
                  <td><StatusChip status={b.status} /></td>
                  <td>{canManage && <button className="btn sm" onClick={() => openEdit(b)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'Products' && (
          <table className="grid">
            <thead><tr><th>Serial</th><th>SKU</th><th>Product</th><th>Brand</th><th>Section</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.product_serial}</td>
                  <td className="mono">{p.sku}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.brand_name}</td>
                  <td>{p.section_name}</td>
                  <td><StatusChip status={p.status} /></td>
                  <td>{canManage && <button className="btn sm" onClick={() => openEdit(p)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'Colours' && (
          <table className="grid">
            <thead><tr><th>Code</th><th>Name</th><th>Family</th><th>Swatch</th><th>Custom (RB-016)</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.code}</td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.colour_family || '—'}</td>
                  <td>{c.swatch_hex ? <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 4, background: c.swatch_hex, border: '1px solid #ccc' }} /> : '—'}</td>
                  <td>{c.is_custom ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'Suppliers' && (
          <table className="grid">
            <thead><tr><th>Code</th><th>Company</th><th>Contact</th><th>GSTIN</th><th>Terms</th><th>Divisions</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.code}</td>
                  <td><strong>{s.company_name}</strong></td>
                  <td>{s.contact_person || '—'}</td>
                  <td className="mono">{s.gstin || '—'}</td>
                  <td>{s.payment_terms}</td>
                  <td>{(s.division_ids || []).map((id) => refs.divisions.find((d) => d.id === id)?.code || '?').join(', ')}</td>
                  <td><StatusChip status={s.status} /></td>
                  <td>{canManage && <button className="btn sm" onClick={() => openEdit(s)}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit — ${tab}` : `New — ${tab}`} onClose={() => setEditing(null)}>
          {tab === 'Departments' && (
            <>
              {!editing.id && <div className="fields-2">
                <Field label="Code" hint="Short unique code, e.g. CRICKET, FURN">
                  <input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Display name" hint="Shown in the left navigation">
                  <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
              </div>}
              {editing.id && <Field label="Department name"><input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>}
              {!editing.id && (
                <Field label="Scope">
                  <div className="row" style={{ gap: 14 }}>
                    <label style={{ fontWeight: 400 }}>
                      <input type="checkbox" checked={form.isGlobal} onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })} />{' '}
                      Global (all divisions)
                    </label>
                    {!form.isGlobal && (
                      <select value={form.divisionId || ''} onChange={(e) => setForm({ ...form, divisionId: e.target.value })} style={{ minWidth: 180 }}>
                        <option value="">— select division —</option>
                        {refs.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    )}
                  </div>
                </Field>
              )}
            </>
          )}
          {tab === 'Sections' && (
            <>
              {!editing.id && <div className="fields-2">
                <Field label="Code"><input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
                <Field label="Display order"><input type="number" value={form.displayOrder ?? 0} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} /></Field>
              </div>}
              <Field label="Section name"><input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              {!editing.id && <div className="fields-2">
                <Field label="Department">
                  <select value={form.departmentId || ''} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                    <option value="">— select —</option>
                    {refs.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Sizing method (drives PO matrix)">
                  <select value={form.sizingMethodId || ''} onChange={(e) => setForm({ ...form, sizingMethodId: e.target.value })}>
                    <option value="">— select —</option>
                    {refs.sizeMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
              </div>}
            </>
          )}
          {tab === 'Brands' && (
            <>
              {!editing.id && <div className="fields-2">
                <Field label="Brand number" hint="RB-005: distinct from serial"><input value={form.brandNumber || ''} onChange={(e) => setForm({ ...form, brandNumber: e.target.value })} /></Field>
                <Field label="Brand serial number"><input value={form.brandSerial || ''} onChange={(e) => setForm({ ...form, brandSerial: e.target.value })} /></Field>
              </div>}
              <Field label="Brand name"><input value={form.brandName || ''} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></Field>
              <Field label="Manufacturer"><input value={form.manufacturer || ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></Field>
            </>
          )}
          {tab === 'Products' && (
            <>
              <Field label="Name"><input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              {!editing.id && <div className="fields-2">
                <Field label="SKU"><input value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
                <Field label="Brand">
                  <select value={form.brandId || ''} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                    <option value="">— select —</option>
                    {refs.brands.map((b) => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
                  </select>
                </Field>
                <Field label="Section">
                  <select value={form.sectionId || ''} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
                    <option value="">— select —</option>
                    {refs.sections.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              </div>}
            </>
          )}
          {tab === 'Colours' && (
            <Field label="Colour name" hint="Case-insensitive duplicate check (§9.2); flagged custom (RB-016)">
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          )}
          {tab === 'Suppliers' && (
            <>
              {!editing.id && <Field label="Code"><input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>}
              <Field label="Company name"><input value={form.companyName || ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
              <div className="fields-2">
                <Field label="Contact person"><input value={form.contactPerson || ''} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Field>
                <Field label="GSTIN"><input value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Field>
              </div>
              <Field label="Payment terms">
                <select value={form.paymentTerms || 'net_30'} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}>
                  {['advance', 'net_30', 'net_60', 'against_delivery', 'custom'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Divisions">
                <div className="row">
                  {refs.divisions.map((d) => (
                    <label key={d.id} style={{ fontWeight: 400 }}>
                      <input type="checkbox" checked={(form.divisionIds || []).includes(d.id)} onChange={() => toggleDivision(d.id)} /> {d.name}
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
