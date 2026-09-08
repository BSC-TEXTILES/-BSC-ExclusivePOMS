import { useEffect, useState } from 'react';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';

export default function ProductTypes() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ sectionId: '', categoryId: '', subcategoryId: '', code: '', name: '' });
  const [saving, setSaving] = useState(false);
  const canManage = hasPermission('categories.manage') || hasPermission('masters.manage');

  const load = () => {
    api.get('/product-types').then((r) => setRows(r.data.data || [])).catch((e) => setError(errMessage(e)));
    api.get('/sections').then((r) => setSections(r.data.data || [])).catch(() => {});
    api.get('/categories').then((r) => setCategories(r.data.data || [])).catch(() => {});
  };
  useEffect(load, []);

  const filteredCategories = categories.filter((c) => c.section_id === form.sectionId && !c.parent_category_id);
  const filteredSubcategories = categories.filter((c) => c.section_id === form.sectionId && c.parent_category_id === form.categoryId);

  function openAdd() {
    setEditing(null);
    setForm({ sectionId: '', categoryId: '', subcategoryId: '', code: '', name: '' });
    setModal('create');
  }

  function openEdit(pt) {
    setEditing(pt);
    setForm({
      sectionId: pt.section_id || '', categoryId: pt.category_id || '',
      subcategoryId: pt.subcategory_id || '', code: pt.code, name: pt.name,
    });
    setModal('edit');
  }

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (editing) {
        await api.patch(`/product-types/${editing.id}`, { name: form.name });
      } else {
        await api.post('/product-types', {
          sectionId: form.sectionId, categoryId: form.categoryId || null,
          subcategoryId: form.subcategoryId || null, code: form.code, name: form.name,
        });
      }
      setModal(null); load();
    } catch (e) { setError(errMessage(e)); }
    setSaving(false);
  };

  async function handleDelete(pt) {
    if (!window.confirm(`Delete product type "${pt.name}"?`)) return;
    try { await api.delete(`/product-types/${pt.id}`); load(); } catch (e) { setError(errMessage(e)); }
  }

  const getSectionName = (id) => sections.find((s) => s.id === id)?.name || '—';
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || '—';

  return (
    <div className="content">
      <div className="page-header">
        <div><h1 className="page-title">Product Types</h1><p className="page-sub" style={{ margin: 0 }}>Manage product types within categories</p></div>
        {canManage && <button className="btn primary" onClick={openAdd}>+ Add Product Type</button>}
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <table className="grid">
          <thead><tr><th>Code</th><th>Name</th><th>Section</th><th>Category</th><th>Subcategory</th><th>Products</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((pt) => (
              <tr key={pt.id}>
                <td className="mono">{pt.code}</td>
                <td style={{ fontWeight: 600 }}>{pt.name}</td>
                <td>{getSectionName(pt.section_id)}</td>
                <td>{pt.category_id ? getCategoryName(pt.category_id) : '—'}</td>
                <td>{pt.subcategory_id ? getCategoryName(pt.subcategory_id) : '—'}</td>
                <td className="num">{pt.product_count || 0}</td>
                <td><span className={`chip st-${pt.status}`}>{pt.status}</span></td>
                <td>
                  {canManage && (
                    <div className="actions-cell">
                      <button className="btn sm" onClick={() => openEdit(pt)}>Edit</button>
                      <button className="btn sm danger" onClick={() => handleDelete(pt)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No product types found</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Product Type' : 'Add Product Type'} onClose={() => setModal(null)}>
          <div className="modal-body">
            {!editing && (
              <>
                <label className="field"><span className="field-label">Section *</span>
                  <select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value, categoryId: '', subcategoryId: '' })}>
                    <option value="">— select —</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                {form.sectionId && (
                  <label className="field"><span className="field-label">Category</span>
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, subcategoryId: '' })}>
                      <option value="">— none —</option>
                      {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                {form.categoryId && (
                  <label className="field"><span className="field-label">Subcategory</span>
                    <select value={form.subcategoryId} onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}>
                      <option value="">— none —</option>
                      {filteredSubcategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                <div className="fields-2">
                  <label className="field"><span className="field-label">Code *</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
                  <label className="field"><span className="field-label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                </div>
              </>
            )}
            {editing && (
              <label className="field"><span className="field-label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={saving || !form.name || (!editing && (!form.sectionId || !form.code))}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
