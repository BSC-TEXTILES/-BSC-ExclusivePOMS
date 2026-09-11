import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import api, { API_BASE, API_ORIGIN, errMessage, assetUrl } from '../api.js';
import { useAuth, useCart } from '../auth.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import CollectionIcon from '../components/CollectionIcon.jsx';
import ProductGallery from '../components/ProductGallery.jsx';

export const DEPARTMENT_CONFIG = {
  men: {
    key: 'men',
    code: 'MEN',
    title: "Men's Collection",
    subtitle: "Formal & Casual Apparel, Ethnic Wear, Innerwear & Footwear",
    icon: 'men',
    themeColor: '#2563eb',
    accentBg: '#eff6ff',
    sections: [
      { code: 'MEN-SHIRTS', name: "Men's Shirts", icon: 'shirts' },
      { code: 'MEN-TROUSERS', name: "Men's Trousers & Jeans", icon: 'trousers' },
      { code: 'MEN-TSHIRTS', name: "Men's T-Shirts", icon: 'tshirts' },
      { code: 'MEN-ETHNIC', name: "Men's Ethnic Wear (Kurta/Sherwani)", icon: 'ethnic' },
      { code: 'MEN-INNERWEAR', name: "Men's Innerwear", icon: 'innerwear' },
      { code: 'MEN-FOOTWEAR', name: 'Footwear - Men', icon: 'shoes' },
      { code: 'FOOTWEAR-M', name: "Footwear — Men", icon: 'footwear' },
    ],
  },
  women: {
    key: 'women',
    code: 'WOMEN',
    title: "Women's Collection",
    subtitle: "Sarees, Kurtis & Salwar, Western, Ethnic Fabrics, Innerwear, Jewellery & Accessories",
    icon: 'women',
    themeColor: '#e11d48',
    accentBg: '#fff1f2',
    sections: [
      { code: 'WOM-SAREES', name: "Women's Sarees", icon: 'sarees' },
      { code: 'WOM-KURTIS', name: "Women's Kurtis & Salwar Sets", icon: 'kurtis' },
      { code: 'WOM-WESTERN', name: "Women's Western Wear", icon: 'western' },
      { code: 'WOM-BLOUSE', name: "Women's Ethnic / Blouse Fabric", icon: 'fabric' },
      { code: 'WOM-INNERWEAR', name: "Women's Innerwear", icon: 'innerwear' },
      { code: 'JWL-FASHION', name: "Jewellery — Fashion / Artificial", icon: 'gem' },
      { code: 'JWL-BANGLES', name: "Jewellery — Bangles & Sets", icon: 'bangles' },
      { code: 'FOOTWEAR-W', name: "Footwear — Women", icon: 'heels' },
      { code: 'ACCESSORIES', name: "Accessories (Belts, Bags, Watches)", icon: 'bag' },
    ],
  },
  kids: {
    key: 'kids',
    code: 'KIDS',
    title: "Kids Collection",
    subtitle: "Boys Wear, Girls Wear, Infant Apparel, Toys & Interactive Games",
    icon: 'kids',
    themeColor: '#059669',
    accentBg: '#ecfdf5',
    sections: [
      { code: 'KIDS-BOYS', name: "Kids Boys Wear", icon: 'boys' },
      { code: 'KIDS-GIRLS', name: "Kids Girls Wear", icon: 'girls' },
      { code: 'KIDS-INFANT', name: "Kids Infant Wear", icon: 'infant' },
      { code: 'KIDS-TOYS', name: "Toys & Games", icon: 'ball' },
    ],
  },
  home: {
    key: 'home',
    code: 'HOME',
    title: "Home & Living Collection",
    subtitle: "Textiles, Home Furnishings, Decor, Interior Furniture & Essentials",
    icon: 'home',
    themeColor: '#d97706',
    accentBg: '#fffbeb',
    sections: [
      { code: 'HOME-FURN', name: "Home Furnishing (Textiles & Decor)", icon: 'bed' },
      { code: 'FURNITURE', name: "Furniture & Home Interiors", icon: 'chair' },
    ],
  },
};

export const MARKET_SIZE_PRESETS = {
  footwear: {
    key: 'footwear',
    name: 'Footwear / Shoes (UK 3–12)',
    icon: 'footwear',
    sizes: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
  },
  apparel: {
    key: 'apparel',
    name: 'Standard Apparel (XS–5XL)',
    icon: 'tshirts',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
  },
  waist: {
    key: 'waist',
    name: 'Numeric Waist (28–46)',
    icon: 'trousers',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42', '44', '46'],
  },
  kids: {
    key: 'kids',
    name: 'Kids Age Groups (0-16Y)',
    icon: 'infant',
    sizes: ['0-2 Yrs', '2-4 Yrs', '4-6 Yrs', '6-8 Yrs', '8-10 Yrs', '10-12 Yrs', '12-14 Yrs', '14-16 Yrs'],
  },
  free_sets: {
    key: 'free_sets',
    name: 'Free Size & Home Sets',
    icon: 'gift',
    sizes: ['Free Size', 'Single', 'Set of 2', 'Set of 4', 'Set of 6'],
  },
};

  const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

  // Map section codes to their sizing preset key
  const SECTION_SIZE_MAP = {
    'MEN-SHIRTS': 'apparel',
    'MEN-TSHIRTS': 'apparel',
    'MEN-INNERWEAR': 'apparel',
    'MEN-ETHNIC': 'apparel',
    'MEN-TROUSERS': 'waist',
    'MEN-FOOTWEAR': 'footwear',
  };

export default function CollectionView() {
  const { deptKey } = useParams();
  const { addItem: addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  // Known departments come from the hardcoded config; NEW admin-created
  // departments resolve live from the API by matching the route key to
  // department code (case-insensitive) — so any newly added collection
  // (e.g. Cricket, Lycra, Furniture) works without code changes.
  const hardcoded = DEPARTMENT_CONFIG[deptKey] || null;
  const config = hardcoded || {
    code: (deptKey || '').toUpperCase(),
    title: department?.name || 'Collection',
    icon: 'masters',
    themeColor: '#1d4ed8',
    accentBg: '#eff6ff',
    sections: [],
  };
  const activeSectionCode = searchParams.get('sectionCode') || '';

  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue' | 'po_form' | 'orders'
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
  const pageSize = 500;
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Purchase Orders placed from this collection — list shown in the PO Studio
  const [recentPOs, setRecentPOs] = useState([]);
  const [pendingPOs, setPendingPOs] = useState([]);
  const [recentPOsTotal, setRecentPOsTotal] = useState(0);
  const [pendingPOsTotal, setPendingPOsTotal] = useState(0);
  const [orderTab, setOrderTab] = useState('all'); // 'all' | 'pending'
  const [posLoading, setPosLoading] = useState(false);

  // Product image gallery (upload / set primary / delete) — masters.manage only
  const canManageMaster = !!user?.isSuperAdmin || !!hasPermission?.('masters.manage');
  const [galleryProduct, setGalleryProduct] = useState(null);

  // PO Studio State
  const [poSectionId, setPoSectionId] = useState('');
  const [poRemarks, setPoRemarks] = useState(() => localStorage.getItem(`pom-po-remarks-${deptKey}`) || '');
  const [poLines, setPoLines] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pom-po-lines-${deptKey}`)) || []; } catch { return []; }
  });
  const [poSupplierId, setPoSupplierId] = useState(() => localStorage.getItem(`pom-po-supplier-${deptKey}`) || '');
  const [poDivisionId, setPoDivisionId] = useState(() => localStorage.getItem(`pom-po-division-${deptKey}`) || '');
  const [poWarehouse, setPoWarehouse] = useState(() => localStorage.getItem(`pom-po-warehouse-${deptKey}`) || 'WH-BGV-01');
  const [poDeliveryDate, setPoDeliveryDate] = useState(() => localStorage.getItem(`pom-po-delivery-${deptKey}`) || (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); })());
  // Per-card quick quantity — the units prefilled per size when adding to PO
  const [cardQty, setCardQty] = useState({});
  const [poSubmitting, setPoSubmitting] = useState(false);
  const [createdPO, setCreatedPO] = useState(null);

  // Persist PO form data to localStorage on change
  useEffect(() => { localStorage.setItem(`pom-po-lines-${deptKey}`, JSON.stringify(poLines)); }, [poLines, deptKey]);
  useEffect(() => { localStorage.setItem(`pom-po-remarks-${deptKey}`, poRemarks); }, [poRemarks, deptKey]);
  useEffect(() => { localStorage.setItem(`pom-po-supplier-${deptKey}`, poSupplierId); }, [poSupplierId, deptKey]);
  useEffect(() => { localStorage.setItem(`pom-po-division-${deptKey}`, poDivisionId); }, [poDivisionId, deptKey]);
  useEffect(() => { localStorage.setItem(`pom-po-warehouse-${deptKey}`, poWarehouse); }, [poWarehouse, deptKey]);
  useEffect(() => { localStorage.setItem(`pom-po-delivery-${deptKey}`, poDeliveryDate); }, [poDeliveryDate, deptKey]);

  // Add Product Modal State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [categories, setCategories] = useState([]);

  // Inline creation modals
  const [inlineModal, setInlineModal] = useState(null); // 'brand' | 'product'
  const [inlineBrand, setInlineBrand] = useState({ name: '', code: '' });
  const [inlineProduct, setInlineProduct] = useState({ name: '', sku: '', purchasePrice: '', sellingPrice: '' });
  const [inlineLoading, setInlineLoading] = useState(false);

  const [newProd, setNewProd] = useState({
    name: '',
    sku: '',
    sectionId: '',
    brandId: '',
    categoryId: '',
    hsnSac: '620520',
    taxCategory: 'GST_12',
    purchasePrice: '',
    sellingPrice: '',
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
      const wantedCode = (config?.code || deptKey || '').toUpperCase();
      const foundDept =
        allDeps.find((d) => d.code === wantedCode) ||
        allDeps.find((d) => (d.code || '').toLowerCase() === (deptKey || '').toLowerCase()) ||
        allDeps[0];
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
  }, [config?.code, deptKey]);

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
    const matchedKey = SECTION_SIZE_MAP[secCode];

    if (matchedKey) {
      setActiveSizes(MARKET_SIZE_PRESETS[matchedKey].sizes);
      setActivePresetKey(matchedKey);
    } else if (secCode.includes('SAREE') || secCode.includes('HOME') || secCode.includes('FURN') || secCode.includes('BLOUSE')) {
      setActiveSizes(MARKET_SIZE_PRESETS.free_sets.sizes);
      setActivePresetKey('free_sets');
    } else if (secCode.startsWith('KIDS') || secCode.includes('INFANT')) {
      setActiveSizes(MARKET_SIZE_PRESETS.kids.sizes);
      setActivePresetKey('kids');
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

  // Purchase Orders placed from this collection (all sections of this department,
  // narrowed to the active section filter when one is selected).
  const loadRecentPOs = useCallback(() => {
    if (!department?.id) return;
    setPosLoading(true);
    const baseParams = { departmentId: department.id, pageSize: 50, page: 1 };
    const params = activeSection ? { ...baseParams, sectionId: activeSection.id } : baseParams;
    Promise.all([
      api.get('/purchase-orders', { params }),
      api.get('/purchase-orders', { params: { ...params, status: 'draft' } }),
      api.get('/purchase-orders', { params: { ...params, status: 'submitted' } }),
      api.get('/purchase-orders', { params: { ...params, status: 'partially_received' } }),
    ]).then(([allRes, draftRes, submittedRes, partialRes]) => {
      setRecentPOs(allRes.data.data || []);
      setRecentPOsTotal(allRes.data.total ?? (allRes.data.data || []).length);
      const pending = [...(draftRes.data.data || []), ...(submittedRes.data.data || []), ...(partialRes.data.data || [])];
      const seen = new Set();
      const uniquePending = pending.filter((po) => { if (seen.has(po.id)) return false; seen.add(po.id); return true; });
      setPendingPOs(uniquePending);
      setPendingPOsTotal(uniquePending.length);
    }).catch(() => {})
      .finally(() => setPosLoading(false));
  }, [department, activeSection]);

  useEffect(() => {
    loadRecentPOs();
  }, [loadRecentPOs]);

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
  function addProductToPO(prod, qtyPerSize = 10) {
    setActiveTab('po_form');
    setSuccessMsg(`Added "${prod.name}" to Purchase Order drafting table.`);
    setTimeout(() => setSuccessMsg(''), 4000);

    const existingIndex = poLines.findIndex((l) => l.productId === prod.id);
    if (existingIndex >= 0) return;

    // Prefill first 4 active sizes with the quantity chosen on the product card
    const initialQty = {};
    activeSizes.slice(0, 4).forEach((sz) => {
      initialQty[sz] = Math.max(1, Number(qtyPerSize) || 10);
    });

    const defaultPP = Number(prod.purchase_price) > 0 ? Number(prod.purchase_price) : 450;

    setPoLines((prev) => [
      ...prev,
      {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        brandId: prod.brand_id || '',
        brand: prod.brand_name || '',
        sectionName: prod.section_name || '',
        colourVariants: colours[0] ? [{
          colourId: colours[0].id,
          purchasePrice: defaultPP,
          marginPercent: 30,
          quantities: { ...initialQty },
        }] : [],
      },
    ]);
  }

  // Quick fill all active lines
  function fillAllLines(qty) {
    setPoLines((prev) => prev.map((l) => ({
      ...l,
      colourVariants: (l.colourVariants || []).map((cv) => {
        const q = {};
        activeSizes.forEach((sz) => { q[sz] = qty; });
        return { ...cv, quantities: q };
      }),
    })));
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
      (line.colourVariants || []).forEach((cv) => {
        const units = Object.values(cv.quantities || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
        const pp = Number(cv.purchasePrice) || 0;
        const margin = Number(cv.marginPercent) || 0;
        const net = round2(pp * (1 + margin / 100));
        const lineTotal = round2(net * units);
        grandUnits += units;
        subtotal += lineTotal;
      });
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
        lines: poLines.flatMap((l) => (l.colourVariants || []).map((cv) => ({
          productId: l.productId,
          colourId: cv.colourId || colours[0]?.id || null,
          purchasePrice: Number(cv.purchasePrice) || 300,
          marginPercent: Number(cv.marginPercent) || 0,
          quantities: Object.entries(cv.quantities || {}).map(([sizeLabel, quantity]) => ({ sizeLabel, quantity: Number(quantity) || 0 })).filter((q) => q.quantity > 0),
        }))),
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
      addToCart(created); // show in the top-nav cart for crosscheck & checkout
      setPoLines([]);
      // Clear persisted PO form data
      localStorage.removeItem(`pom-po-lines-${deptKey}`);
      localStorage.removeItem(`pom-po-remarks-${deptKey}`);
      localStorage.removeItem(`pom-po-supplier-${deptKey}`);
      localStorage.removeItem(`pom-po-division-${deptKey}`);
      localStorage.removeItem(`pom-po-warehouse-${deptKey}`);
      localStorage.removeItem(`pom-po-delivery-${deptKey}`);
      setSuccessMsg(`Purchase Order ${created?.po_number || ''} created successfully!`);
      loadRecentPOs(); // refresh the collection's PO list with the new order
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setPoSubmitting(false);
    }
  }

  // Inline create brand from PO Studio
  async function handleInlineBrand(e) {
    e.preventDefault();
    if (!inlineBrand.name.trim()) return;
    setInlineLoading(true);
    try {
      const res = await api.post('/brands', {
        brandName: inlineBrand.name.trim(),
        brandCode: inlineBrand.code.trim().toUpperCase() || inlineBrand.name.trim().replace(/\s+/g, '').slice(0, 6).toUpperCase(),
        collectionIds: [],
      });
      const newBrand = res.data.data;
      setBrands((prev) => [newBrand, ...prev]);
      setInlineBrand({ name: '', code: '' });
      setInlineModal(null);
      setSuccessMsg(`Brand "${newBrand.brand_name}" created! Add it to a collection from Brands page.`);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setInlineLoading(false);
    }
  }

  // Inline create product from PO Studio
  async function handleInlineProduct(e) {
    e.preventDefault();
    if (!inlineProduct.name.trim() || !inlineProduct.sku.trim()) return;
    setInlineLoading(true);
    try {
      const res = await api.post('/products', {
        sku: inlineProduct.sku.trim().toUpperCase(),
        name: inlineProduct.name.trim(),
        sectionId: poSectionId || deptSections[0]?.id,
        brandId: brands[0]?.id,
        hsnSac: '620520',
        purchasePrice: inlineProduct.purchasePrice ? Number(inlineProduct.purchasePrice) : undefined,
        sellingPrice: inlineProduct.sellingPrice ? Number(inlineProduct.sellingPrice) : undefined,
      });
      setInlineProduct({ name: '', sku: '', purchasePrice: '', sellingPrice: '' });
      setInlineModal(null);
      setSuccessMsg(`Product "${res.data.data.name}" created! Browse catalogue to add to PO.`);
      loadProducts();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setInlineLoading(false);
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
        purchasePrice: newProd.purchasePrice ? Number(newProd.purchasePrice) : undefined,
        sellingPrice: newProd.sellingPrice ? Number(newProd.sellingPrice) : undefined,
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
        sellingPrice: '',
        description: '',
      });
    } catch (err) {
      setError(errMessage(err));
    }
  }

  return (
    <div className="page collection-view-page">
      {/* Top Department Banner */}
      <div className="collection-hero-card" style={{ borderLeftColor: config.themeColor }}>
        <div className="collection-hero-main">
          <div className="collection-hero-icon" style={{ background: config.accentBg, color: config.themeColor }}>
            <CollectionIcon name={config.icon} size={34} />
          </div>
          <div>
            <h1 className="collection-hero-title">{config.title}</h1>
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

          <button
            type="button"
            className={`btn ${activeTab === 'orders' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveTab(activeTab === 'orders' ? 'catalogue' : 'orders')}
            style={activeTab === 'orders' ? { background: config.themeColor, borderColor: config.themeColor, color: '#fff' } : {}}
          >
            <Icon name="po" size={16} />
            {activeTab === 'orders' ? 'Back to Catalogue' : 'Order List'}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}

      {/* Sub-Section Filter Bar */}
      <div className="collection-section-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="collection-filter-label">Filter Section:</span>
        <select
          value={activeSectionCode}
          onChange={(e) => handleSectionFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 200 }}
        >
          <option value="">All Sections ({totalProducts})</option>
          {deptSections.map((sec) => {
            const count = products.filter((p) => p.section_code === sec.code || p.section_id === sec.id).length;
            return (
              <option key={sec.id} value={sec.code}>{sec.name} ({count})</option>
            );
          })}
        </select>

        {/* Quick pill buttons for user's assigned sections */}
        {deptSections.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {deptSections.map((sec) => {
              const isSelected = activeSectionCode === sec.code;
              const secCfg = config.sections.find((s) => s.code === sec.code);
              return (
                <button
                  key={sec.id}
                  type="button"
                  className={`collection-pill ${isSelected ? 'active' : ''}`}
                  style={isSelected
                    ? { background: config.themeColor, borderColor: config.themeColor, color: '#fff', fontSize: 11, padding: '3px 8px' }
                    : { fontSize: 11, padding: '3px 8px' }
                  }
                  onClick={() => handleSectionFilter(sec.code)}
                >
                  <span className="collection-pill-icon"><CollectionIcon name={secCfg?.icon || config.icon} size={11} /></span>
                  <span>{sec.name}</span>
                </button>
              );
            })}
          </div>
        )}
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
              <div className="collection-empty-icon"><CollectionIcon name={config.icon} size={40} /></div>
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
                const qty = cardQty[p.id] ?? 10;
                const setQty = (v) => setCardQty({ ...cardQty, [p.id]: Math.max(1, Math.min(999, Number(v) || 1)) });
                // Deterministic brand "logo" tile — initials + stable colour per brand
                const brandInitials = (p.brand_name || 'BSC')
                  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                const hue = [...(p.brand_name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                // Real product photo (uploaded by the administrator) — no random images.
                // Fall back to the brand logo, then to initials, so connected imagery is always visible.
                const photoKey = p.primary_image_key
                  ? String(p.primary_image_key).split(/[\\/]/).join('/')
                  : '';
                const cardBrand = brands.find((x) => x.id === p.brand_id);
                const brandLogo = cardBrand?.logo_url || cardBrand?.image_url || '';
                const cardMedia = photoKey || brandLogo;
                return (
                  <div key={p.id} className={`collection-prod-card ${inPO ? 'in-po' : ''}`}>
                    <div
                      className={`collection-prod-photo ${cardMedia ? 'has-photo' : ''}`}
                      onClick={() => canManageMaster && setGalleryProduct({ id: p.id, product_id: p.product_serial, name: p.name })}
                      title={canManageMaster ? (photoKey ? 'View / manage photos' : 'Upload product photos') : p.name}
                      style={canManageMaster ? { cursor: 'pointer' } : undefined}
                    >
                      {cardMedia ? (
                        <img src={cardMedia === photoKey ? assetUrl(`/uploads/${photoKey}`) : assetUrl(brandLogo)} alt={p.name} loading="lazy" />
                      ) : (
                        <span
                          className="collection-prod-photo-fallback"
                          style={{ background: `hsl(${hue} 45% 92%)`, color: `hsl(${hue} 55% 32%)` }}
                        >
                          {brandInitials}
                        </span>
                      )}
                      {canManageMaster && (
                        <span className="collection-prod-photo-btn">
                          {photoKey ? `${p.image_count ?? 1} photo${(p.image_count ?? 1) > 1 ? 's' : ''} · Edit` : '+ Upload photo'}
                        </span>
                      )}
                    </div>
                    <div className="collection-prod-top">
                      <div className="brand-logo-tile" style={{ background: `hsl(${hue} 45% 92%)`, color: `hsl(${hue} 55% 32%)` }} title={p.brand_name || 'BSC Exclusive'}>
                        {brandInitials}
                      </div>
                      <div className="collection-prod-headline">
                        <div className="collection-prod-name" title={p.name}>{p.name}</div>
                        <div className="collection-prod-brand">
                          <span className="brand-logo-name">{p.brand_name || 'Generic'}</span>
                          {p.manufacturer ? <span className="brand-mfr">by {p.manufacturer}</span> : null}
                        </div>
                      </div>
                      {inPO && <span className="collection-inpo-chip" title="Already in the current PO">✓ in PO</span>}
                    </div>

                    <div className="collection-prod-tags">
                      <span className="collection-prod-sku">{p.sku}</span>
                      <span className="collection-prod-section">{p.section_name}</span>
                    </div>

                    <div className="collection-prod-meta">
                      <div className="collection-prod-price">
                        {Number(p.purchase_price) > 0
                          ? <>₹{Number(p.purchase_price).toLocaleString('en-IN')} <span className="collection-price-unit">/ unit</span></>
                          : <span className="collection-price-label">Price set in PO Studio</span>}
                      </div>
                      <span className="collection-price-label">HSN {p.hsn_sac || '—'}</span>
                    </div>

                    <div className="collection-prod-footer">
                      <div className="qty-stepper" role="group" aria-label={`Quantity for ${p.name}`}>
                        <button type="button" onClick={() => setQty(qty - 1)} title="Decrease units per size">−</button>
                        <input type="number" min="1" max="999" value={qty} onChange={(e) => setQty(e.target.value)} title="Units per size (editable)" />
                        <button type="button" onClick={() => setQty(qty + 1)} title="Increase units per size">+</button>
                      </div>
                      <button
                        type="button"
                        className={`btn sm ${inPO ? 'success' : 'primary'}`}
                        onClick={() => addProductToPO(p, qty)}
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

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" onClick={() => setInlineModal('brand')} style={{ border: '1px dashed #9ca3af' }}>
              + Add New Brand
            </button>
            <button type="button" className="btn sm" onClick={() => setInlineModal('product')} style={{ border: '1px dashed #9ca3af' }}>
              + Add New Product
            </button>
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
              {(() => {
                const sectionCode = (activeSection?.code || '').toUpperCase();
                const matchedKey = SECTION_SIZE_MAP[sectionCode] || activePresetKey;
                const preset = MARKET_SIZE_PRESETS[matchedKey] || MARKET_SIZE_PRESETS.apparel;
                return (
                  <span className="btn sm ghost collection-preset-btn active" style={{ cursor: 'default' }}>
                    <span><CollectionIcon name={preset.icon} size={13} /></span> {preset.name}
                  </span>
                );
              })()}

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
                      <th style={{ width: 100 }}>Purchase Price</th>
                      <th style={{ width: 80 }}>Margin %</th>
                      <th style={{ minWidth: 280 }}>Size Quantities</th>
                      <th style={{ width: 70 }}>Units</th>
                      <th style={{ width: 100, textAlign: 'right' }}>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {poLines.map((line, idx) => {
                      const lineUnits = (line.colourVariants || []).reduce((sum, cv) => sum + Object.values(cv.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0), 0);
                      const lineTotal = (line.colourVariants || []).reduce((sum, cv) => {
                        const u = Object.values(cv.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                        const pp = Number(cv.purchasePrice) || 0;
                        const m = Number(cv.marginPercent) || 0;
                        return sum + round2(pp * (1 + m / 100)) * u;
                      }, 0);

                      return (
                        <Fragment key={line.productId}>
                          {(line.colourVariants || []).map((cv, cvIdx) => {
                            const c = colours.find((x) => x.id === cv.colourId);
                            const hex = c?.swatch_hex || '#e2e8f0';
                            const pp = Number(cv.purchasePrice) || 0;
                            const margin = Number(cv.marginPercent) || 0;
                            const net = round2(pp * (1 + margin / 100));
                            const cvUnits = Object.values(cv.quantities || {}).reduce((s, q) => s + (Number(q) || 0), 0);
                            const cvTotal = round2(net * cvUnits);
                            const isLast = cvIdx === (line.colourVariants || []).length - 1;

                            return (
                              <tr key={`${line.productId}-${cv.colourId}`} style={{ background: cvIdx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                {cvIdx === 0 && (
                                  <>
                                    <td rowSpan={(line.colourVariants || []).length + 1} style={{ verticalAlign: 'top', fontWeight: 700, color: '#9ca3af' }}>{idx + 1}</td>
                                    <td rowSpan={(line.colourVariants || []).length + 1} style={{ verticalAlign: 'top' }}>
                                      <div className="collection-line-prod">
                                        {(() => {
                                          const b = brands.find((x) => x.id === line.brandId);
                                          const bLogo = b?.logo_url || b?.image_url || '';
                                          const bName = line.brand || b?.brand_name || 'BSC';
                                          const bInitials = bName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'BSC';
                                          const bHue = [...bName].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
                                          return bLogo ? (
                                            <img className="collection-line-brand" src={assetUrl(bLogo)} alt={bName} title={bName} />
                                          ) : (
                                            <span className="collection-line-brand" style={{ background: `hsl(${bHue} 45% 92%)`, color: `hsl(${bHue} 55% 32%)` }} title={bName}>{bInitials}</span>
                                          );
                                        })()}
                                        <div className="collection-line-prod-text">
                                          <strong>{line.name}</strong>
                                          <div className="muted" style={{ fontSize: 11 }}>{line.sku} · {line.brand}</div>
                                        </div>
                                      </div>
                                    </td>
                                  </>
                                )}
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#f9fafb', borderRadius: 4, padding: '3px 6px', border: '1px solid #e5e7eb' }}>
                                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: hex, border: '2px solid #d1d5db', flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontWeight: 600, color: '#374151' }}>{c?.name || 'Unknown'}</span>
                                    <button
                                      type="button"
                                      className="icon-btn text-danger"
                                      onClick={() => {
                                        const next = (line.colourVariants || []).filter((_, i) => i !== cvIdx);
                                        updateLine(idx, { colourVariants: next });
                                      }}
                                      style={{ fontSize: 10, padding: '0 3px', lineHeight: 1 }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  {isLast && (
                                    <div style={{ marginTop: 4 }}>
                                      <select
                                        defaultValue=""
                                        onChange={(e) => {
                                          const cid = e.target.value;
                                          if (!cid) return;
                                          const defaultPP = Number(line.colourVariants?.[0]?.purchasePrice) || 450;
                                          const defaultMargin = Number(line.colourVariants?.[0]?.marginPercent) || 30;
                                          const defaultQty = { ...(line.colourVariants?.[0]?.quantities || {}) };
                                          const nextVariants = [...(line.colourVariants || []), { colourId: cid, purchasePrice: defaultPP, marginPercent: defaultMargin, quantities: defaultQty }];
                                          updateLine(idx, { colourVariants: nextVariants });
                                          e.target.value = '';
                                        }}
                                        style={{ padding: '3px 6px', fontSize: 11, border: '1px dashed #9ca3af', borderRadius: 4, width: '100%' }}
                                      >
                                        <option value="" disabled>+ Add colour…</option>
                                        {colours.filter((c) => !(line.colourVariants || []).some((cv) => cv.colourId === c.id)).map((c) => (
                                          <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    value={cv.purchasePrice}
                                    onChange={(e) => {
                                      const next = [...(line.colourVariants || [])];
                                      next[cvIdx] = { ...next[cvIdx], purchasePrice: e.target.value };
                                      updateLine(idx, { colourVariants: next });
                                    }}
                                    style={{ width: 90, padding: '4px 6px', fontSize: 12 }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={cv.marginPercent}
                                    onChange={(e) => {
                                      const next = [...(line.colourVariants || [])];
                                      next[cvIdx] = { ...next[cvIdx], marginPercent: e.target.value };
                                      updateLine(idx, { colourVariants: next });
                                    }}
                                    style={{ width: 70, padding: '4px 6px', fontSize: 12 }}
                                  />
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {activeSizes.map((sz) => {
                                      const qty = Number(cv.quantities?.[sz]) || 0;
                                      return (
                                        <div key={sz} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, background: qty > 0 ? '#f0fdf4' : 'transparent', borderRadius: 3, padding: '1px 3px' }}>
                                          <span style={{ fontWeight: 600, minWidth: 34, color: qty > 0 ? '#166534' : '#9ca3af' }}>{sz}</span>
                                          <input
                                            type="number"
                                            min="0"
                                            value={qty}
                                            onChange={(e) => {
                                              const val = Number(e.target.value) || 0;
                                              const nextVariants = [...(line.colourVariants || [])];
                                              const nextQty = { ...(nextVariants[cvIdx].quantities || {}) };
                                              if (val > 0) nextQty[sz] = val; else delete nextQty[sz];
                                              nextVariants[cvIdx] = { ...nextVariants[cvIdx], quantities: nextQty };
                                              updateLine(idx, { colourVariants: nextVariants });
                                            }}
                                            style={{ width: 40, padding: '1px 3px', fontSize: 11 }}
                                          />
                                          {qty > 0 && <span style={{ fontSize: 10, color: '#6b7280' }}>₹{round2(net * qty).toLocaleString('en-IN')}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td style={{ fontWeight: 700, fontSize: 12 }}>{cvUnits}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>₹{cvTotal.toLocaleString('en-IN')}</td>
                                <td></td>
                              </tr>
                            );
                          })}
                          {/* Product subtotal row */}
                          <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                            <td colSpan={5} style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>Subtotal ({line.name})</td>
                            <td style={{ textAlign: 'right', fontSize: 12 }}>{lineUnits} units</td>
                            <td style={{ textAlign: 'right', fontSize: 13, color: '#166534' }}>₹{lineTotal.toLocaleString('en-IN')}</td>
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
                        </Fragment>
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
                  style={{ padding: '12px 24px', borderRadius: 8, fontSize: 14 }}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={poSubmitting || poLines.length === 0}
                  onClick={() => submitPO(true)}
                  style={{
                    background: poSubmitting ? '#94a3b8' : config.themeColor,
                    borderColor: poSubmitting ? '#94a3b8' : config.themeColor,
                    padding: '12px 28px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all .2s',
                  }}
                >
                  {poSubmitting && (
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                  )}
                  {poSubmitting ? 'Creating PO…' : `Submit ${config.title} PO`}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          </div>

          {/* Purchase Orders placed from this collection — complete list */}
          <div className="collection-po-list-wrap">
            <div className="collection-po-list-header">
              <h3>Purchase Orders ({recentPOsTotal})</h3>
              <button type="button" className="btn sm ghost" onClick={loadRecentPOs} disabled={posLoading}>
                {posLoading ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>
            {posLoading && !recentPOs.length ? (
              <div className="collection-loading-state">
                <div className="login-spinner" />
                <span>Loading purchase orders…</span>
              </div>
            ) : recentPOs.length === 0 ? (
              <div className="collection-empty-lines">
                <p>No purchase orders yet for this collection{activeSection ? ` (${activeSection.name})` : ''}. Create your first PO above.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="grid collection-po-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Date</th>
                      <th>Supplier</th>
                      <th>Section</th>
                      <th style={{ textAlign: 'right' }}>Units</th>
                      <th style={{ textAlign: 'right' }}>Grand Total</th>
                      <th>Status</th>
                      <th style={{ width: 70 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPOs.map((po) => (
                      <tr key={po.id}>
                        <td className="mono"><strong>{po.po_number}</strong>{po.version > 1 ? ` · v${po.version}` : ''}</td>
                        <td>{po.po_date ? String(po.po_date).slice(0, 10) : '—'}</td>
                        <td>{po.supplier_name}</td>
                        <td>{po.section_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{po.total_quantity ?? 0}</td>
                        <td style={{ textAlign: 'right' }}>{INR(po.grand_total)}</td>
                        <td><span className={`chip st-${po.status}`}>{po.status}</span></td>
                        <td><Link className="btn sm ghost" to={`/purchase-orders/${po.id}`}>View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Order List */}
      {activeTab === 'orders' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>Order List</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>Purchase Orders for {config.title}</p>
            </div>
            <button type="button" className="btn sm" onClick={loadRecentPOs}>Refresh</button>
          </div>

          {/* Sub-tabs: All / Pending */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={`btn sm ${orderTab === 'all' ? 'primary' : 'ghost'}`}
              style={orderTab === 'all' ? { background: config.themeColor, borderColor: config.themeColor, color: '#fff' } : {}}
              onClick={() => setOrderTab('all')}
            >
              All Orders ({recentPOsTotal})
            </button>
            <button
              type="button"
              className={`btn sm ${orderTab === 'pending' ? 'primary' : 'ghost'}`}
              style={orderTab === 'pending' ? { background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' } : {}}
              onClick={() => setOrderTab('pending')}
            >
              ⏳ Pending ({pendingPOsTotal})
            </button>
          </div>

          {posLoading ? (
            <div className="muted" style={{ padding: 30, textAlign: 'center' }}>Loading orders…</div>
          ) : (
            <>
              {/* All Orders Table */}
              {orderTab === 'all' && (
                recentPOs.length === 0 ? (
                  <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ fontSize: 40, margin: '0 0 8px' }}>📋</p>
                    <p>No Purchase Orders placed yet for {config.title}.</p>
                    <button type="button" className="btn primary" style={{ marginTop: 12, background: config.themeColor, borderColor: config.themeColor, color: '#fff' }} onClick={() => setActiveTab('po_form')}>
                      Create First PO
                    </button>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="grid">
                      <thead>
                        <tr>
                          <th>PO Number</th>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>Section</th>
                          <th style={{ textAlign: 'right' }}>Units</th>
                          <th style={{ textAlign: 'right' }}>Grand Total</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPOs.map((po) => (
                          <tr key={po.id}>
                            <td><strong>{po.po_number}</strong></td>
                            <td>{po.po_date ? String(po.po_date).slice(0, 10) : '—'}</td>
                            <td>{po.supplier_name}</td>
                            <td>{po.section_name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{po.total_quantity ?? 0}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(po.grand_total)}</td>
                            <td><span className={`chip st-${po.status}`}>{po.status}</span></td>
                            <td><Link className="btn sm ghost" to={`/purchase-orders/${po.id}`}>View</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Pending Orders Table */}
              {orderTab === 'pending' && (
                pendingPOs.length === 0 ? (
                  <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ fontSize: 40, margin: '0 0 8px' }}>✅</p>
                    <p>No pending orders. All caught up!</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="grid">
                      <thead>
                        <tr>
                          <th>PO Number</th>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>Section</th>
                          <th style={{ textAlign: 'right' }}>Units</th>
                          <th style={{ textAlign: 'right' }}>Grand Total</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPOs.map((po) => (
                          <tr key={po.id}>
                            <td><strong>{po.po_number}</strong></td>
                            <td>{po.po_date ? String(po.po_date).slice(0, 10) : '—'}</td>
                            <td>{po.supplier_name}</td>
                            <td>{po.section_name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{po.total_quantity ?? 0}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{INR(po.grand_total)}</td>
                            <td><span className={`chip st-${po.status}`}>{po.status}</span></td>
                            <td><Link className="btn sm ghost" to={`/purchase-orders/${po.id}`}>View</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* PO Success Confirmation Modal */}
      {createdPO && (
        <Modal title="" onClose={() => setCreatedPO(null)}>
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            {/* Animated checkmark */}
            <div style={{ margin: '0 auto 20px', width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(34,197,94,0.3)', animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'drawCheck 0.4s 0.3s ease forwards', opacity: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 style={{ margin: '0 0 6px', fontSize: 22, color: '#111827' }}>Order Placed Successfully!</h2>
            <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14 }}>Your Purchase Order has been created and submitted for approval.</p>

            {/* PO Number Card */}
            <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 12, padding: '16px 24px', marginBottom: 20, animation: 'slideUp 0.4s 0.2s ease forwards', opacity: 0, transform: 'translateY(10px)' }}>
              <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Purchase Order Number</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#166534', margin: '4px 0', fontFamily: 'monospace', letterSpacing: 2 }}>{createdPO.po_number}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                ID: {createdPO.id?.slice(0, 8)}… · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24, animation: 'slideUp 0.4s 0.35s ease forwards', opacity: 0, transform: 'translateY(10px)' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{poCalculations.grandUnits}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Total Units</div>
              </div>
              <div style={{ width: 1, background: '#e5e7eb' }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>₹{poCalculations.subtotal.toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Subtotal</div>
              </div>
              <div style={{ width: 1, background: '#e5e7eb' }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: config.themeColor }}>₹{poCalculations.grandTotal.toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Grand Total</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'slideUp 0.4s 0.5s ease forwards', opacity: 0, transform: 'translateY(10px)' }}>
              <Link
                to={`/purchase-orders/${createdPO.id}`}
                className="btn primary"
                style={{ background: config.themeColor, borderColor: config.themeColor, padding: '12px 24px', fontSize: 14, fontWeight: 600, borderRadius: 8, textDecoration: 'none', textAlign: 'center' }}
              >
                View PO Details & Workflow →
              </Link>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ flex: 1, padding: '10px', fontSize: 13, borderRadius: 8 }}
                  onClick={async () => {
                    try {
                      const res = await api.get(`/purchase-orders/${createdPO.id}/export/pdf`, { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                      const a = document.createElement('a'); a.href = url; a.download = `${createdPO.po_number || 'PO'}.pdf`; a.click(); window.URL.revokeObjectURL(url);
                    } catch { setError('Failed to download PDF'); }
                  }}
                >
                  📄 Download PDF
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, padding: '10px', fontSize: 13, borderRadius: 8 }}
                  onClick={async () => {
                    try {
                      const res = await api.get(`/purchase-orders/${createdPO.id}/export/csv`, { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
                      const a = document.createElement('a'); a.href = url; a.download = `${createdPO.po_number || 'PO'}.csv`; a.click(); window.URL.revokeObjectURL(url);
                    } catch { setError('Failed to download CSV'); }
                  }}
                >
                  📊 Download CSV
                </button>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => { setCreatedPO(null); setActiveTab('orders'); }}
                style={{ padding: '10px', fontSize: 13, borderRadius: 8 }}
              >
                View All Orders
              </button>
            </div>
          </div>
          <style>{`
            @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes drawCheck { 0% { opacity: 0; stroke-dasharray: 30; stroke-dashoffset: 30; } 100% { opacity: 1; stroke-dasharray: 30; stroke-dashoffset: 0; } }
            @keyframes slideUp { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
          `}</style>
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

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="field-label">Brand *</span>
                <div className="po-brand-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginTop: 6 }}>
                  {brands
                    .filter((b) => {
                      if (!department) return true;
                      if (!b.collections?.length) return true;
                      return b.collections.some((c) => {
                        const deptCode = (department.code || '').toUpperCase();
                        return c.code?.toUpperCase().includes(deptCode) || c.name?.toLowerCase().includes(deptCode.toLowerCase());
                      });
                    })
                    .map((b) => {
                      const selected = newProd.brandId === b.id;
                      const brandInitials = b.brand_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <div
                          key={b.id}
                          onClick={() => setNewProd({ ...newProd, brandId: b.id })}
                          className={`po-brand-tile ${selected ? 'selected' : ''}`}
                          style={{
                            border: selected ? `2px solid ${config.themeColor}` : '2px solid #e5e7eb',
                            borderRadius: 8,
                            padding: '8px 4px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: selected ? config.accentBg : '#fff',
                            transition: 'all .15s',
                          }}
                        >
                          <div style={{ width: 40, height: 40, borderRadius: '50%', margin: '0 auto 4px', overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(b.image_url || b.logo_url) ? (
                              <img src={b.image_url || b.logo_url} alt={b.brand_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#6b7280' }}>{brandInitials}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: selected ? config.themeColor : '#374151', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.brand_name}
                          </div>
                        </div>
                      );
                    })}
                </div>
                {!newProd.brandId && <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, display: 'block' }}>Click a brand to select</span>}
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

              <label className="field">
                <span className="field-label">Purchase Price (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newProd.purchasePrice || ''}
                  onChange={(e) => setNewProd({ ...newProd, purchasePrice: e.target.value })}
                  placeholder="e.g. 850"
                />
              </label>

              <label className="field">
                <span className="field-label">Selling Price (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newProd.sellingPrice || ''}
                  onChange={(e) => setNewProd({ ...newProd, sellingPrice: e.target.value })}
                  placeholder="e.g. 1299"
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

      {/* Inline Brand Creation Modal */}
      {inlineModal === 'brand' && (
        <Modal title="Add New Brand" onClose={() => setInlineModal(null)}>
          <form onSubmit={handleInlineBrand}>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Create a new brand. After creation, assign it to a collection from the <strong>Brands</strong> page.
            </p>
            <label className="field">
              <span className="field-label">Brand Name *</span>
              <input
                autoFocus
                required
                value={inlineBrand.name}
                onChange={(e) => setInlineBrand({ ...inlineBrand, name: e.target.value })}
                placeholder="e.g. Allen Solly"
              />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span className="field-label">Brand Code</span>
              <input
                value={inlineBrand.code}
                onChange={(e) => setInlineBrand({ ...inlineBrand, code: e.target.value.toUpperCase() })}
                placeholder="e.g. ALNSLL (auto-generated if empty)"
              />
            </label>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setInlineModal(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={inlineLoading}>
                {inlineLoading ? 'Creating…' : 'Create Brand'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Inline Product Creation Modal */}
      {inlineModal === 'product' && (
        <Modal title="Add New Product" onClose={() => setInlineModal(null)}>
          <form onSubmit={handleInlineProduct}>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Quick-create a product in section <strong>{deptSections.find((s) => s.id === poSectionId)?.name || 'Current'}</strong>.
            </p>
            <label className="field">
              <span className="field-label">Product Name *</span>
              <input
                autoFocus
                required
                value={inlineProduct.name}
                onChange={(e) => setInlineProduct({ ...inlineProduct, name: e.target.value })}
                placeholder="e.g. Slim Fit Linen Shirt"
              />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span className="field-label">SKU Code *</span>
              <input
                required
                value={inlineProduct.sku}
                onChange={(e) => setInlineProduct({ ...inlineProduct, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. MSH-2026-042"
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <label className="field">
                <span className="field-label">Purchase Price (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={inlineProduct.purchasePrice}
                  onChange={(e) => setInlineProduct({ ...inlineProduct, purchasePrice: e.target.value })}
                  placeholder="e.g. 850"
                />
              </label>
              <label className="field">
                <span className="field-label">Selling Price (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={inlineProduct.sellingPrice}
                  onChange={(e) => setInlineProduct({ ...inlineProduct, sellingPrice: e.target.value })}
                  placeholder="e.g. 1299"
                />
              </label>
            </div>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setInlineModal(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={inlineLoading}>
                {inlineLoading ? 'Creating…' : 'Create Product'}
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

      {/* Product photo gallery — upload / set primary / delete (masters.manage) */}
      {galleryProduct && (
        <Modal title={`Photos — ${galleryProduct.name || 'Product'}`} onClose={() => setGalleryProduct(null)}>
          <ProductGallery
            product={galleryProduct}
            canManage={canManageMaster}
            onChanged={loadProducts}
          />
        </Modal>
      )}
    </div>
  );
}
