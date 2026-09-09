import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';

export const DEPARTMENT_CONFIG = {
  men: {
    key: 'men',
    code: 'MEN',
    title: "Men's Collection",
    subtitle: "Formal & Casual Apparel, Ethnic Wear, Innerwear & Footwear",
    icon: '👔',
    themeColor: '#2563eb',
    accentBg: '#eff6ff',
    sections: [
      { code: 'MEN-SHIRTS', name: "Men's Shirts", icon: '👕' },
      { code: 'MEN-TROUSERS', name: "Men's Trousers & Jeans", icon: '👖' },
      { code: 'MEN-TSHIRTS', name: "Men's T-Shirts", icon: '👕' },
      { code: 'MEN-ETHNIC', name: "Men's Ethnic Wear (Kurta/Sherwani)", icon: '👳' },
      { code: 'MEN-INNERWEAR', name: "Men's Innerwear", icon: '🩲' },
      { code: 'FOOTWEAR-M', name: "Footwear — Men", icon: '👞' },
    ],
  },
  women: {
    key: 'women',
    code: 'WOMEN',
    title: "Women's Collection",
    subtitle: "Sarees, Kurtis & Salwar, Western, Ethnic Fabrics, Innerwear, Jewellery & Accessories",
    icon: '👗',
    themeColor: '#e11d48',
    accentBg: '#fff1f2',
    sections: [
      { code: 'WOM-SAREES', name: "Women's Sarees", icon: '🥻' },
      { code: 'WOM-KURTIS', name: "Women's Kurtis & Salwar Sets", icon: '👗' },
      { code: 'WOM-WESTERN', name: "Women's Western Wear", icon: '👚' },
      { code: 'WOM-BLOUSE', name: "Women's Ethnic / Blouse Fabric", icon: '🧵' },
      { code: 'WOM-INNERWEAR', name: "Women's Innerwear", icon: '👙' },
      { code: 'JWL-FASHION', name: "Jewellery — Fashion / Artificial", icon: '💍' },
      { code: 'JWL-BANGLES', name: "Jewellery — Bangles & Sets", icon: '📿' },
      { code: 'FOOTWEAR-W', name: "Footwear — Women", icon: '👠' },
      { code: 'ACCESSORIES', name: "Accessories (Belts, Bags, Watches)", icon: '👜' },
    ],
  },
  kids: {
    key: 'kids',
    code: 'KIDS',
    title: "Kids Collection",
    subtitle: "Boys Wear, Girls Wear, Infant Apparel, Toys & Interactive Games",
    icon: '🧸',
    themeColor: '#059669',
    accentBg: '#ecfdf5',
    sections: [
      { code: 'KIDS-BOYS', name: "Kids Boys Wear", icon: '👦' },
      { code: 'KIDS-GIRLS', name: "Kids Girls Wear", icon: '👧' },
      { code: 'KIDS-INFANT', name: "Kids Infant Wear", icon: '👶' },
      { code: 'KIDS-TOYS', name: "Toys & Games", icon: '🎮' },
    ],
  },
  home: {
    key: 'home',
    code: 'HOME',
    title: "Home & Living Collection",
    subtitle: "Textiles, Home Furnishings, Decor, Interior Furniture & Essentials",
    icon: '🛋️',
    themeColor: '#d97706',
    accentBg: '#fffbeb',
    sections: [
      { code: 'HOME-FURN', name: "Home Furnishing (Textiles & Decor)", icon: '🛏️' },
      { code: 'FURNITURE', name: "Furniture & Home Interiors", icon: '🪑' },
    ],
  },
};

export const MARKET_SIZE_PRESETS = {
  footwear: {
    key: 'footwear',
    name: 'Footwear / Shoes (UK 3–12)',
    icon: '👟',
    sizes: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
  },
  apparel: {
    key: 'apparel',
    name: 'Standard Apparel (XS–5XL)',
    icon: '👕',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
  },
  waist: {
    key: 'waist',
    name: 'Numeric Waist (28–46)',
    icon: '👖',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42', '44', '46'],
  },
  kids: {
    key: 'kids',
    name: 'Kids Age Groups (0-16Y)',
    icon: '👶',
    sizes: ['0-2 Yrs', '2-4 Yrs', '4-6 Yrs', '6-8 Yrs', '8-10 Yrs', '10-12 Yrs', '12-14 Yrs', '14-16 Yrs'],
  },
  free_sets: {
    key: 'free_sets',
    name: 'Free Size & Home Sets',
    icon: '🎁',
    sizes: ['Free Size', 'Single', 'Set of 2', 'Set of 4', 'Set of 6'],
  },
};

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export default function CollectionView() {
  const { deptKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const config = DEPARTMENT_CONFIG[deptKey] || DEPARTMENT_CONFIG.men;
  const activeSectionCode = searchParams.get('sectionCode') || '';

  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue' | 'po_form'
  const [department, setDepartment] = useState(null);
  const [deptSections, setDeptSections] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [colours, setColours] = useState([]);
  const [divisions, setDivisions] = useState([]);

  // Dynamic market size matrix state
  const [activeSizes, setActiveSizes] = useState(MARKET_SIZE_PRESETS.apparel.sizes);
  const [activePresetKey, setActivePresetKey] = useState('apparel');
  const [showAddCustomSize, setShowAddCustomSize] = useState(false);
  const [customSizeText, setCustomSizeText] = useState('');

  // Catalogue listing state
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 16;
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // PO Studio State
  const [poSectionId, setPoSectionId] = useState('');
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poDivisionId, setPoDivisionId] = useState('');
  const [poWarehouse, setPoWarehouse] = useState('WH-DVG-01');
  const [poDeliveryDate, setPoDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [poRemarks, setPoRemarks] = useState('');
  const [poLines, setPoLines] = useState([]);
  const [poSubmitting, setPoSubmitting] = useState(false);
  const [createdPO, setCreatedPO] = useState(null);

  // Add Product Modal State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newProd, setNewProd] = useState({
    name: '',
    sku: '',
    sectionId: '',
    brandId: '',
    categoryId: '',
    hsnSac: '620520',
    taxCategory: 'GST_12',
    purchasePrice: '',
    mrp: '',
    description: '',
  });

  // Load masters for this department
  useEffect(() => {
    Promise.all([
      api.get('/departments'),
      api.get('/sections', { params: { status: 'active' } }),
      api.get('/brands'),
      api.get('/suppliers', { params: { status: 'active' } }),
      api.get('/locations'),
      api.get('/colours'),
      api.get('/divisions'),
      api.get('/categories'),
    ]).then(([depRes, secRes, brandRes, supRes, locRes, colRes, divRes, catRes]) => {
      const allDeps = depRes.data.data || [];
      const foundDept = allDeps.find((d) => d.code === config.code) || allDeps[0];
      setDepartment(foundDept);

      const allSecs = secRes.data.data || [];
      const matchingSecs = foundDept ? allSecs.filter((s) => s.department_id === foundDept.id) : allSecs;
      setDeptSections(matchingSecs);

      setBrands(brandRes.data.data || []);
      setSuppliers(supRes.data.data || []);
      setWarehouses(locRes.data.data || []);
      setColours(colRes.data.data || []);
      const divs = divRes.data.data || [];
      setDivisions(divs);
      if (divs.length > 0) setPoDivisionId(divs[0].id);
      setCategories(catRes.data.data || []);
    }).catch((e) => setError(errMessage(e)));
  }, [config.code]);

  // Determine active section object
  const activeSection = useMemo(() => {
    if (!activeSectionCode) return null;
    return deptSections.find((s) => s.code === activeSectionCode) || null;
  }, [deptSections, activeSectionCode]);

  // Sync PO section id with active section
  useEffect(() => {
    if (activeSection) {
      setPoSectionId(activeSection.id);
    } else if (deptSections.length > 0 && !poSectionId) {
      setPoSectionId(deptSections[0].id);
    }
  }, [activeSection, deptSections, poSectionId]);

  // Auto-detect Market Sizing Profile based on chosen Section
  useEffect(() => {
    if (!poSectionId) return;
    const sec = deptSections.find((s) => s.id === poSectionId);
    const secCode = (sec?.code || '').toUpperCase();

    if (secCode.includes('FOOTWEAR') || secCode.includes('SHOE')) {
      setActiveSizes(MARKET_SIZE_PRESETS.footwear.sizes);
      setActivePresetKey('footwear');
    } else if (secCode.includes('TROUSER') || secCode.includes('JEANS')) {
      setActiveSizes(MARKET_SIZE_PRESETS.waist.sizes);
      setActivePresetKey('waist');
    } else if (secCode.startsWith('KIDS') || secCode.includes('INFANT')) {
      setActiveSizes(MARKET_SIZE_PRESETS.kids.sizes);
      setActivePresetKey('kids');
    } else if (secCode.includes('SAREE') || secCode.includes('HOME') || secCode.includes('FURN') || secCode.includes('BLOUSE')) {
      setActiveSizes(MARKET_SIZE_PRESETS.free_sets.sizes);
      setActivePresetKey('free_sets');
    } else {
      setActiveSizes(MARKET_SIZE_PRESETS.apparel.sizes);
      setActivePresetKey('apparel');
    }

    // Also fetch DB configured sizes for this section and merge to ensure complete market coverage
    api.get(`/sections/${poSectionId}/sizes`).then((r) => {
      const dbLabels = (r.data.data || []).map((z) => z.label);
      if (dbLabels.length > 0) {
        setActiveSizes((prev) => Array.from(new Set([...dbLabels, ...prev])));
      }
    }).catch(() => {});
  }, [poSectionId, deptSections]);

  // Load products strictly for this department (and optional section)
  const loadProducts = useCallback(() => {
    if (!department) return;
    setLoading(true);
    const params = {
      departmentId: department.id,
      page,
      pageSize,
    };
    if (activeSection) params.sectionId = activeSection.id;
    if (selectedBrand) params.brandId = selectedBrand;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    api.get('/products', { params })
      .then((r) => {
        setProducts(r.data.data || []);
        setTotalProducts(r.data.total || 0);
        setError('');
      })
      .catch((e) => setError(errMessage(e)))
      .finally(() => setLoading(false));
  }, [department, activeSection, selectedBrand, searchQuery, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Section switcher
  function handleSectionFilter(code) {
    setPage(1);
    if (!code) {
      searchParams.delete('sectionCode');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ sectionCode: code });
    }
  }

  // Quick Add Product to PO Studio
  function addProductToPO(prod) {
    setActiveTab('po_form');
    setSuccessMsg(`Added "${prod.name}" to Purchase Order drafting table.`);
    setTimeout(() => setSuccessMsg(''), 4000);

    const existingIndex = poLines.findIndex((l) => l.productId === prod.id);
    if (existingIndex >= 0) return;

    // Prefill first 4 active sizes with 10 units
    const initialQty = {};
    activeSizes.slice(0, 4).forEach((sz) => {
      initialQty[sz] = 10;
    });

    setPoLines((prev) => [
      ...prev,
      {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        brand: prod.brand_name || '',
        sectionName: prod.section_name || '',
        colourId: colours[0]?.id || '',
        purchasePrice: prod.hsn_sac ? 450 : 350,
        marginPercent: 30,
        discountType: 'percent',
        discountValue: 0,
        quantities: initialQty,
      },
    ]);
  }

  // Quick fill all active lines
  function fillAllLines(qty) {
    setPoLines((prev) => prev.map((l) => {
      const q = {};
      activeSizes.forEach((sz) => { q[sz] = qty; });
      return { ...l, quantities: q };
    }));
  }

  // Add custom size
  function handleAddCustomSize(e) {
    e.preventDefault();
    const clean = customSizeText.trim().toUpperCase();
    if (!clean) return;
    if (!activeSizes.includes(clean)) {
      setActiveSizes((prev) => [...prev, clean]);
    }
    setCustomSizeText('');
    setShowAddCustomSize(false);
  }

  // Update line in PO
  function updateLine(index, patch) {
    setPoLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  }

  function removeLine(index) {
    setPoLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Calculate PO Totals
  const poCalculations = useMemo(() => {
    let grandUnits = 0;
    let subtotal = 0;

    poLines.forEach((line) => {
      const units = Object.values(line.quantities || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
      const pp = Number(line.purchasePrice) || 0;
      const margin = Number(line.marginPercent) || 0;
      const net = round2(pp * (1 + margin / 100));
      const dv = Number(line.discountValue) || 0;
      const disc = line.discountType === 'flat' ? dv : round2(net * dv / 100);
      const finalPrice = Math.max(0, net - disc);
      const lineTotal = round2(finalPrice * units);

      grandUnits += units;
      subtotal += lineTotal;
    });

    const gstAmount = round2(subtotal * 0.18);
    const grandTotal = round2(subtotal + gstAmount);

    return { grandUnits, subtotal, gstAmount, grandTotal };
  }, [poLines]);

  // Submit PO
  async function submitPO(asSubmitted = true) {
    if (!poSupplierId) {
      setError('Please choose an authorized Supplier for this Purchase Order.');
      return;
    }
    if (poLines.length === 0) {
      setError('Please add at least one line item to the Purchase Order.');
      return;
    }

    setPoSubmitting(true);
    setError('');

    try {
      const payload = {
        divisionId: poDivisionId || divisions[0]?.id,
        departmentId: department.id,
        sectionId: poSectionId || deptSections[0]?.id,
        supplierId: poSupplierId,
        taxScheme: 'GST_INTRA',
        expectedDeliveryDate: poDeliveryDate,
        remarks: `${config.title} Procurement — ${poRemarks}`.trim(),
        lines: poLines.map((l) => ({
          productId: l.productId,
          colourId: l.colourId || colours[0]?.id,
          purchasePrice: Number(l.purchasePrice) || 300,
          marginPercent: Number(l.marginPercent) || 0,
          discountType: l.discountType || 'percent',
          discountValue: Number(l.discountValue) || 0,
          quantities: l.quantities,
        })),
        orderDiscount: { type: 'percent', value: 0, reason: '' },
        charges: [],
      };

      const res = await api.post('/purchase-orders', payload);
      const created = res.data.data;

      if (asSubmitted && created?.id) {
        await api.post(`/purchase-orders/${created.id}/submit`, {
          notes: `Auto-submitted from ${config.title} Studio`,
        });
      }

      setCreatedPO(created);
      setPoLines([]);
      setSuccessMsg(`Purchase Order ${created?.po_number || ''} created successfully!`);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setPoSubmitting(false);
    }
  }

  // Handle Admin Add Product
  async function handleAddProductSubmit(e) {
    e.preventDefault();
    if (!newProd.name || !newProd.sku || !newProd.sectionId || !newProd.brandId) {
      setError('Please provide Product Name, SKU, Section, and Brand.');
      return;
    }
    try {
      await api.post('/products', {
        sku: newProd.sku,
        name: newProd.name,
        sectionId: newProd.sectionId,
        brandId: newProd.brandId,
        categoryId: newProd.categoryId || categories[0]?.id,
        hsnSac: newProd.hsnSac || '620520',
        taxCategory: newProd.taxCategory || 'GST_12',
        description: newProd.description,
      });

      setShowAddProduct(false);
      setSuccessMsg(`New product "${newProd.name}" added to ${config.title}!`);
      loadProducts();
      setNewProd({
        name: '',
        sku: '',
        sectionId: '',
        brandId: '',
        categoryId: '',
        hsnSac: '620520',
        taxCategory: 'GST_12',
        purchasePrice: '',
        mrp: '',
        description: '',
      });
    } catch (err) {
      setError(errMessage(err));
    }
  }

  return (
    <div className="page collection-view-page">
      {/* Top Department Hero Banner */}
      <div className="collection-hero-card" style={{ borderLeftColor: config.themeColor }}>
        <div className="collection-hero-main">
          <div className="collection-hero-icon" style={{ background: config.accentBg, color: config.themeColor }}>
            {config.icon}
          </div>
          <div>
            <div className="collection-hero-meta">
              <span className="collection-badge" style={{ background: config.accentBg, color: config.themeColor }}>
                Department: {config.code}
              </span>
              <span className="collection-badge gray">{deptSections.length} Sub-Sections</span>
              <span className="collection-badge green">{totalProducts} SKUs Catalogued</span>
            </div>
            <h1 className="collection-hero-title">{config.title}</h1>
            <p className="collection-hero-subtitle">{config.subtitle}</p>
          </div>
        </div>

        <div className="collection-hero-actions">
          {(user?.isSuperAdmin || user?.permissions?.includes('products.create')) && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setNewProd((p) => ({ ...p, sectionId: activeSection?.id || deptSections[0]?.id || '' }));
                setShowAddProduct(true);
              }}
            >
              <Icon name="plus" size={15} /> Add New SKU
            </button>
          )}

          <button
            type="button"
            className={`btn ${activeTab === 'po_form' ? 'secondary' : 'primary'}`}
            onClick={() => setActiveTab(activeTab === 'po_form' ? 'catalogue' : 'po_form')}
            style={activeTab !== 'po_form' ? { background: config.themeColor, borderColor: config.themeColor, color: '#fff' } : {}}
          >
            <Icon name="po" size={16} />
            {activeTab === 'po_form' ? 'Back to Catalogue' : `Create ${config.title} PO`}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}

      {/* Sub-Section Filter Bar */}
      <div className="collection-section-bar">
        <span className="collection-filter-label">Filter Section:</span>
        <div className="collection-pills-wrap">
          <button
            type="button"
            className={`collection-pill ${!activeSectionCode ? 'active' : ''}`}
            onClick={() => handleSectionFilter('')}
          >
            All Sections ({totalProducts})
          </button>
          {deptSections.map((sec) => {
            const isSelected = activeSectionCode === sec.code;
            const secCfg = config.sections.find((s) => s.code === sec.code);
            return (
              <button
                key={sec.id}
                type="button"
                className={`collection-pill ${isSelected ? 'active' : ''}`}
                style={isSelected ? { background: config.themeColor, borderColor: config.themeColor, color: '#fff' } : {}}
                onClick={() => handleSectionFilter(sec.code)}
              >
                <span>{secCfg?.icon || '📁'}</span>
                <span>{sec.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Catalogue & Products View */}
      {activeTab === 'catalogue' && (
        <div className="panel collection-catalogue-panel">
          <div className="collection-search-row">
            <div className="field grow">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder={`Search ${activeSection ? activeSection.name : config.title} by name, brand, SKU…`}
              />
            </div>
            <div className="field">
              <select
                value={selectedBrand}
                onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
              >
                <option value="">All Brands ({brands.length})</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.brand_name}</option>
                ))}
              </select>
            </div>
            <div className="collection-view-counter">
              Showing <strong>{products.length}</strong> of <strong>{totalProducts}</strong> products
            </div>
          </div>

          {loading ? (
            <div className="collection-loading-state">
              <div className="login-spinner" />
              <span>Loading {config.title} merchandise…</span>
            </div>
          ) : products.length === 0 ? (
            <div className="collection-empty-state">
              <div className="collection-empty-icon">{config.icon}</div>
              <h3>No products found in this filter</h3>
              <p>Try clearing search criteria or add new items to this section.</p>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setNewProd((p) => ({ ...p, sectionId: activeSection?.id || deptSections[0]?.id || '' }));
                  setShowAddProduct(true);
                }}
              >
                + Add First Product in {activeSection ? activeSection.name : config.title}
              </button>
            </div>
          ) : (
            <div className="collection-product-grid">
              {products.map((p) => {
                const inPO = poLines.some((l) => l.productId === p.id);
                return (
                  <div key={p.id} className="collection-prod-card">
                    <div className="collection-prod-header">
                      <span className="collection-prod-sku">{p.sku}</span>
                      <span className="collection-prod-section">{p.section_name}</span>
                    </div>
                    <div className="collection-prod-name" title={p.name}>{p.name}</div>
                    <div className="collection-prod-brand">
                      <strong>Brand:</strong> {p.brand_name || 'Generic'} {p.manufacturer ? `· ${p.manufacturer}` : ''}
                    </div>
                    <div className="collection-prod-footer">
                      <div className="collection-prod-price">
                        <span className="collection-price-label">HSN:</span> {p.hsn_sac || '620520'}
                      </div>
                      <button
                        type="button"
                        className={`btn sm ${inPO ? 'success' : 'primary'}`}
                        onClick={() => addProductToPO(p)}
                        title="Add this item to the in-page Purchase Order drafting workspace"
                      >
                        {inPO ? '✓ in PO' : '+ Add to PO'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Integrated Section Purchase Order Studio */}
      {activeTab === 'po_form' && (
        <div className="panel collection-po-studio">
          <div className="collection-po-header">
            <div>
              <span className="collection-badge" style={{ background: config.accentBg, color: config.themeColor }}>
                Purchase Order Studio
              </span>
              <h2>{config.title} Procurement Order</h2>
              <p className="muted">
                Pre-configured for Department <strong>{config.title}</strong> · Configure vendor, items, and size quantities
              </p>
            </div>
            <div className="collection-po-stat-pill">
              <span>{poLines.length} Item(s)</span> · <strong>{poCalculations.grandUnits} Total Units</strong> · <strong>{INR(poCalculations.grandTotal)}</strong>
            </div>
          </div>

          <div className="collection-po-meta-grid">
            <label className="field">
              <span className="field-label">Target Section</span>
              <select value={poSectionId} onChange={(e) => setPoSectionId(e.target.value)}>
                {deptSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Authorized Supplier / Vendor *</span>
              <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                <option value="">Select Supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.company_name} ({s.code || s.supplier_code})</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Receiving Warehouse Hub</span>
              <select value={poWarehouse} onChange={(e) => setPoWarehouse(e.target.value)}>
                {warehouses.length > 0 ? (
                  warehouses.map((w) => (
                    <option key={w.id} value={w.code}>{w.name} ({w.code})</option>
                  ))
                ) : (
                  <>
                    <option value="WH-DVG-01">Davanagere Central Hub (WH-DVG-01)</option>
                    <option value="WH-BLR-01">Bengaluru Regional Depot (WH-BLR-01)</option>
                  </>
                )}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Expected Delivery Date</span>
              <input
                type="date"
                value={poDeliveryDate}
                onChange={(e) => setPoDeliveryDate(e.target.value)}
              />
            </label>
          </div>

          {/* Lines Table */}
          <div className="collection-po-lines-wrap">
            <div className="collection-po-lines-header">
              <h3>Itemized Products & Size Breakdown</h3>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setActiveTab('catalogue')}
              >
                + Browse & Add More Products from Catalogue
              </button>
            </div>

            {/* Market Sizes Preset Switcher & Quick Fill Tools */}
            <div className="collection-size-preset-bar">
              <span className="collection-preset-label">Market Sizes:</span>
              {Object.entries(MARKET_SIZE_PRESETS).map(([k, preset]) => (
                <button
                  key={k}
                  type="button"
                  className={`btn sm ghost collection-preset-btn ${activePresetKey === k ? 'active' : ''}`}
                  onClick={() => {
                    setActivePresetKey(k);
                    setActiveSizes(preset.sizes);
                  }}
                  title={`Switch matrix to ${preset.name}`}
                >
                  <span>{preset.icon}</span> {preset.name}
                </button>
              ))}

              <div className="collection-quick-fill-group">
                <button
                  type="button"
                  className="btn sm"
                  title="Fill 10 units in every size"
                  onClick={() => fillAllLines(10)}
                >
                  ⚡ Fill 10 All
                </button>
                <button
                  type="button"
                  className="btn sm"
                  title="Fill 25 units in every size"
                  onClick={() => fillAllLines(25)}
                >
                  ⚡ Fill 25 All
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  title="Reset size quantities to zero"
                  onClick={() => fillAllLines(0)}
                >
                  Clear Matrix
                </button>
                <button
                  type="button"
                  className="btn sm primary"
                  onClick={() => setShowAddCustomSize(true)}
                  title="Add any custom market size (e.g. UK 13, EU 42, 5XL, King Size)"
                >
                  + Add Size
                </button>
              </div>
            </div>

            {poLines.length === 0 ? (
              <div className="collection-empty-lines">
                <p>No products selected yet. Click below to add products from the <strong>{config.title}</strong> catalogue.</p>
                <button type="button" className="btn primary" onClick={() => setActiveTab('catalogue')}>
                  Browse {config.title} Products
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="grid collection-lines-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Product & SKU</th>
                      <th>Color / Shade</th>
                      <th style={{ width: 110 }}>Purchase Price</th>
                      <th style={{ width: 90 }}>Margin %</th>
                      <th style={{ minWidth: 260 }}>
                        Size Quantities Matrix ({activeSizes.slice(0, 5).join(' · ')}{activeSizes.length > 5 ? ` +${activeSizes.length - 5}` : ''})
                      </th>
                      <th style={{ width: 80 }}>Units</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {poLines.map((line, idx) => {
                      const totalUnits = Object.values(line.quantities || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
                      const pp = Number(line.purchasePrice) || 0;
                      const margin = Number(line.marginPercent) || 0;
                      const net = round2(pp * (1 + margin / 100));
                      const lineTotal = round2(net * totalUnits);

                      return (
                        <tr key={line.productId}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{line.name}</strong>
                            <div className="muted" style={{ fontSize: 11 }}>{line.sku} · {line.brand}</div>
                          </td>
                          <td>
                            <select
                              value={line.colourId}
                              onChange={(e) => updateLine(idx, { colourId: e.target.value })}
                              style={{ padding: '4px 6px', fontSize: 12 }}
                            >
                              {colours.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={line.purchasePrice}
                              onChange={(e) => updateLine(idx, { purchasePrice: e.target.value })}
                              style={{ width: 90, padding: '4px 6px', fontSize: 12 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={line.marginPercent}
                              onChange={(e) => updateLine(idx, { marginPercent: e.target.value })}
                              style={{ width: 70, padding: '4px 6px', fontSize: 12 }}
                            />
                          </td>
                          <td>
                            <div className="collection-size-inputs">
                              {activeSizes.map((sz) => (
                                <label key={sz} className="collection-size-col">
                                  <span>{sz}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={line.quantities?.[sz] ?? 0}
                                    onChange={(e) => {
                                      const next = { ...(line.quantities || {}), [sz]: Number(e.target.value) || 0 };
                                      updateLine(idx, { quantities: next });
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{totalUnits}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(lineTotal)}</td>
                          <td>
                            <button
                              type="button"
                              className="icon-btn text-danger"
                              onClick={() => removeLine(idx)}
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PO Commercial Summary & Action Buttons */}
          <div className="collection-po-summary-box">
            <div className="collection-po-notes">
              <label className="field">
                <span className="field-label">Special Delivery / Packaging Remarks</span>
                <textarea
                  rows={2}
                  value={poRemarks}
                  onChange={(e) => setPoRemarks(e.target.value)}
                  placeholder="e.g. Master carton packing with barcode tags and E-way bill…"
                />
              </label>
            </div>

            <div className="collection-po-figures">
              <div className="collection-fig-row">
                <span>Subtotal ({poCalculations.grandUnits} Units):</span>
                <strong>{INR(poCalculations.subtotal)}</strong>
              </div>
              <div className="collection-fig-row">
                <span>GST (Est. 18%):</span>
                <strong>{INR(poCalculations.gstAmount)}</strong>
              </div>
              <div className="collection-fig-row grand">
                <span>Grand Total:</span>
                <strong style={{ color: config.themeColor }}>{INR(poCalculations.grandTotal)}</strong>
              </div>

              <div className="collection-po-btn-row">
                <button
                  type="button"
                  className="btn"
                  disabled={poSubmitting || poLines.length === 0}
                  onClick={() => submitPO(false)}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={poSubmitting || poLines.length === 0}
                  onClick={() => submitPO(true)}
                  style={{ background: config.themeColor, borderColor: config.themeColor }}
                >
                  {poSubmitting ? 'Creating PO…' : `Submit ${config.title} PO`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO Success Confirmation Modal */}
      {createdPO && (
        <Modal title="Purchase Order Created Successfully" onClose={() => setCreatedPO(null)}>
          <div className="collection-success-modal">
            <div className="collection-modal-icon">✓</div>
            <h3>{createdPO.po_number}</h3>
            <p>
              Your Purchase Order for <strong>{config.title}</strong> has been drafted and submitted into the approval workflow.
            </p>
            <div className="collection-modal-actions">
              <Link to={`/purchase-orders/${createdPO.id}`} className="btn primary">
                View PO Details & Workflow
              </Link>
              <a
                href={`/api/purchase-orders/${createdPO.id}/export/pdf`}
                target="_blank"
                rel="noreferrer"
                className="btn secondary"
              >
                Download Official PDF
              </a>
              <a
                href={`/api/purchase-orders/${createdPO.id}/export/csv`}
                download
                className="btn"
              >
                Download CSV
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Add Product Modal */}
      {showAddProduct && (
        <Modal title={`Add New SKU to ${config.title}`} onClose={() => setShowAddProduct(false)}>
          <form onSubmit={handleAddProductSubmit} className="collection-add-form">
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Product Name *</span>
                <input
                  required
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  placeholder="e.g. Slim Fit Linen Shirt"
                />
              </label>

              <label className="field">
                <span className="field-label">SKU Code *</span>
                <input
                  required
                  value={newProd.sku}
                  onChange={(e) => setNewProd({ ...newProd, sku: e.target.value.toUpperCase() })}
                  placeholder="e.g. MSH-2026-042"
                />
              </label>

              <label className="field">
                <span className="field-label">Target Section *</span>
                <select
                  required
                  value={newProd.sectionId}
                  onChange={(e) => setNewProd({ ...newProd, sectionId: e.target.value })}
                >
                  <option value="">Select Section…</option>
                  {deptSections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Brand *</span>
                <select
                  required
                  value={newProd.brandId}
                  onChange={(e) => setNewProd({ ...newProd, brandId: e.target.value })}
                >
                  <option value="">Select Brand…</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.brand_name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Category</span>
                <select
                  value={newProd.categoryId}
                  onChange={(e) => setNewProd({ ...newProd, categoryId: e.target.value })}
                >
                  <option value="">Select Category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">HSN / SAC Code</span>
                <input
                  value={newProd.hsnSac}
                  onChange={(e) => setNewProd({ ...newProd, hsnSac: e.target.value })}
                  placeholder="e.g. 620520"
                />
              </label>
            </div>

            <label className="field" style={{ marginTop: 10 }}>
              <span className="field-label">Description / Fabric Details</span>
              <textarea
                rows={2}
                value={newProd.description}
                onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                placeholder="Fabric composition, weave, fit, wash care instructions…"
              />
            </label>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setShowAddProduct(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" style={{ background: config.themeColor, borderColor: config.themeColor }}>
                Save Product & Add to Catalogue
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Custom Size Modal */}
      {showAddCustomSize && (
        <Modal title="Add Custom Market Size" onClose={() => setShowAddCustomSize(false)}>
          <form onSubmit={handleAddCustomSize}>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Add any shoe size (e.g. <strong>UK 13</strong>, <strong>EU 44</strong>, <strong>US 11</strong>), waist size (e.g. <strong>48</strong>), apparel fit (e.g. <strong>6XL</strong>), or custom pack size to this Purchase Order matrix.
            </p>
            <label className="field">
              <span className="field-label">Market Size Label *</span>
              <input
                autoFocus
                required
                value={customSizeText}
                onChange={(e) => setCustomSizeText(e.target.value)}
                placeholder="e.g. UK 13 or 5XL or Double Bed"
              />
            </label>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setShowAddCustomSize(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Add Size to Matrix
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
