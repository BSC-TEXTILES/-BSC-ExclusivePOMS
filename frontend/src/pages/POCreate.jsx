import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth, useCart } from '../auth.jsx';
import { Field, Money } from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';

const WIZARD_STEPS = [
  { id: 'collection', label: 'Collection', desc: 'Main category' },
  { id: 'type', label: 'Product Type', desc: 'Section / style' },
  { id: 'product', label: 'Product', desc: 'Choose item' },
  { id: 'brand', label: 'Brand', desc: 'Manufacturer' },
  { id: 'size', label: 'Sizes', desc: 'Size range' },
  { id: 'color', label: 'Colors', desc: 'Color variants' },
  { id: 'quantity', label: 'Quantity', desc: 'Pieces per variant' },
  { id: 'pricing', label: 'Pricing', desc: 'Cost & margins' },
  { id: 'review', label: 'Review & Submit', desc: 'Finalize order' },
];

const STANDARD_COLLECTIONS = [
  { code: 'MEN', name: "Men's Collection", icon: 'Men', desc: "Shirts, Trousers, Ethnic, Innerwear & Footwear" },
  { code: 'WOMEN', name: "Women's Collection", icon: 'Women', desc: "Sarees, Kurtis, Western Wear & Fabrics" },
  { code: 'KIDS', name: "Kids Collection", icon: 'Kids', desc: "Boys, Girls, Infants & Toddlers" },
  { code: 'HOME', name: "Home Furnishings", icon: 'Home', desc: "Bed Linen, Curtains, Towels & Accessories" },
];

const STANDARD_COLORS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#1C1C1C' },
  { name: 'Navy Blue', hex: '#0B2545' },
  { name: 'Grey', hex: '#64748B' },
  { name: 'Sky Blue', hex: '#38BDF8' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Maroon', hex: '#881337' },
  { name: 'Dark Green', hex: '#166534' },
  { name: 'Olive', hex: '#65A30D' },
  { name: 'Beige', hex: '#D6D3D1' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Yellow', hex: '#FACC15' },
];

const STANDARD_SIZES_BY_CATEGORY = {
  apparel_alpha: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'],
  apparel_numeric: ['28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56'],
  footwear: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
  kids: ['0-3M', '3-6M', '6-12M', '1-2Y', '2-3Y', '3-4Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-14Y'],
  home: ['Single', 'Double', 'Queen', 'King', 'Standard', 'Custom'],
};

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export default function POCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, user } = useAuth();
  const { addItem: addToCart } = useCart();
  const editId = searchParams.get('edit');

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Master records
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [colours, setColours] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [gstPercent, setGstPercent] = useState(18);

  // Current wizard line selection
  const [selectedCollection, setSelectedCollection] = useState(null); // department
  const [selectedSection, setSelectedSection] = useState(null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState(['White']);
  const [quantities, setQuantities] = useState({}); // key: `${color}__${size}` -> number
  const [quickFillQty, setQuickFillQty] = useState('10');

  // Commercials for current line
  const [purchasePrice, setPurchasePrice] = useState('850');
  const [marginPercent, setMarginPercent] = useState('25');

  // Persistent cart lines
  const [cartLines, setCartLines] = useState([]);

  // Final Order Header
  const [orderHeader, setOrderHeader] = useState({
    supplierId: '',
    divisionId: '',
    expectedDeliveryDate: '',
    remarks: '',
    taxScheme: 'GST_INTRA',
  });

  // Inline modals
  const [inlineModal, setInlineModal] = useState(null); // 'brand' | 'color' | 'supplier' | 'product'
  const [brandForm, setBrandForm] = useState({ brandName: '', brandCode: '', manufacturer: '' });
  const [colorForm, setColorForm] = useState({ name: '' });
  const [supplierForm, setSupplierForm] = useState({ companyName: '', code: '', contactPerson: '', mobile: '', gstin: '' });
  const [customProductForm, setCustomProductForm] = useState({ name: '', sku: '', hsn: '6205', purchasePrice: '800' });

  // Initial master data fetch
  useEffect(() => {
    Promise.all([
      api.get('/departments'),
      api.get('/sections?status=active'),
      api.get('/suppliers?status=active'),
      api.get('/brands'),
      api.get('/colours'),
      api.get('/divisions'),
      api.get('/settings'),
    ])
      .then(([d, s, sup, b, col, div, set]) => {
        setDepartments(d.data.data || []);
        setSections(s.data.data || []);
        setSuppliers(sup.data.data || []);
        setBrands(b.data.data || []);
        setColours(col.data.data || []);
        setDivisions(div.data.data || []);
        const gst = set.data.data?.find((x) => x.key === 'gst_percent');
        if (gst) setGstPercent(Number(gst.value));

        if (div.data.data?.length) {
          setOrderHeader((h) => ({ ...h, divisionId: h.divisionId || div.data.data[0].id }));
        }
        if (sup.data.data?.length) {
          setOrderHeader((h) => ({ ...h, supplierId: h.supplierId || sup.data.data[0].id }));
        }
      })
      .catch((e) => setError(errMessage(e)));
  }, []);

  // Fetch products when section changes
  useEffect(() => {
    if (!selectedSection) {
      setProducts([]);
      return;
    }
    api.get('/products', { params: { sectionId: selectedSection.id, status: 'active', pageSize: 500 } })
      .then((r) => setProducts(r.data.data || []))
      .catch(() => {});
  }, [selectedSection]);

  // If editing an existing PO
  useEffect(() => {
    if (!editId) return;
    api.get(`/purchase-orders/${editId}`).then(({ data: { data: po } }) => {
      setOrderHeader({
        supplierId: po.supplier_id,
        divisionId: po.division_id,
        expectedDeliveryDate: po.expected_delivery_date || '',
        remarks: po.remarks || '',
        taxScheme: po.tax_scheme || 'GST_INTRA',
      });
      // Convert existing lines to cartLines
      const restored = (po.items || []).map((i) => {
        const lineQty = Number(i.total_quantity) || 0;
        const pp = Number(i.purchase_price) || 0;
        const mp = Number(i.margin_percent) || 0;
        const sp = Number(i.final_value_per_unit || (pp * (1 + mp / 100)));
        return {
          id: i.id || Math.random().toString(),
          product: { id: i.product_id, name: i.product_name, sku: i.sku },
          brand: { id: i.brand_id, brand_name: i.brand_name },
          section: { id: po.section_id, name: po.section_name },
          sizes: (i.quantities || []).map((q) => q.sizeLabel),
          colors: [i.colour_name || 'Standard'],
          quantities: Object.fromEntries((i.quantities || []).map((q) => [`${i.colour_name || 'Standard'}__${q.sizeLabel}`, q.quantity])),
          purchasePrice: pp,
          marginPercent: mp,
          sellingPrice: sp,
          profitPerPiece: round2(sp - pp),
          totalQty: lineQty,
          totalPurchase: round2(pp * lineQty),
          totalSelling: round2(sp * lineQty),
          totalProfit: round2((sp - pp) * lineQty),
        };
      });
      setCartLines(restored);
      setStep(8); // Go straight to Review & Submit
    }).catch((e) => setError(errMessage(e)));
  }, [editId]);

  // Filter sections by collection/department
  const filteredSections = useMemo(() => {
    if (!selectedCollection) return [];
    return sections.filter((s) => {
      if (selectedCollection.id && s.department_id === selectedCollection.id) return true;
      const cCode = (selectedCollection.code || '').toUpperCase();
      return (s.code || '').toUpperCase().startsWith(cCode);
    });
  }, [selectedCollection, sections]);

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const term = productSearch.toLowerCase();
    return products.filter((p) =>
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      (p.brand_name && p.brand_name.toLowerCase().includes(term))
    );
  }, [products, productSearch]);

  // Sizes available for selected section
  const availableSizes = useMemo(() => {
    if (!selectedSection) return STANDARD_SIZES_BY_CATEGORY.apparel_alpha;
    const code = (selectedSection.code || '').toLowerCase();
    const name = (selectedSection.name || '').toLowerCase();
    if (code.includes('footwear') || name.includes('footwear')) {
      return STANDARD_SIZES_BY_CATEGORY.footwear;
    }
    if (code.includes('kid') || name.includes('kid') || code.includes('infant')) {
      return STANDARD_SIZES_BY_CATEGORY.kids;
    }
    if (code.includes('home') || name.includes('home') || code.includes('linen') || name.includes('towel')) {
      return STANDARD_SIZES_BY_CATEGORY.home;
    }
    if (code.includes('trouser') || code.includes('jean') || name.includes('trouser') || name.includes('jean')) {
      return STANDARD_SIZES_BY_CATEGORY.apparel_numeric;
    }
    return STANDARD_SIZES_BY_CATEGORY.apparel_alpha;
  }, [selectedSection]);

  // Calculations for current working line
  const currentLineCalc = useMemo(() => {
    const pp = Math.max(0, parseFloat(purchasePrice) || 0);
    const mp = Math.max(0, parseFloat(marginPercent) || 0);
    const sellingPrice = round2(pp * (1 + mp / 100));
    const profitPerPiece = round2(sellingPrice - pp);

    let totalQty = 0;
    Object.values(quantities).forEach((q) => {
      const n = parseInt(q, 10);
      if (n > 0) totalQty += n;
    });

    const totalPurchase = round2(pp * totalQty);
    const totalSelling = round2(sellingPrice * totalQty);
    const totalProfit = round2(profitPerPiece * totalQty);

    return {
      purchasePrice: pp,
      marginPercent: mp,
      sellingPrice,
      profitPerPiece,
      totalQty,
      totalPurchase,
      totalSelling,
      totalProfit,
    };
  }, [purchasePrice, marginPercent, quantities]);

  // Overall Cart Totals
  const cartSummary = useMemo(() => {
    const lines = [...cartLines];
    // If currently configuring an item and it has quantity > 0
    let totalPieces = lines.reduce((acc, l) => acc + (l.totalQty || 0), 0);
    let totalPurchaseVal = lines.reduce((acc, l) => acc + (l.totalPurchase || 0), 0);
    let totalSellingVal = lines.reduce((acc, l) => acc + (l.totalSelling || 0), 0);
    let totalProfit = lines.reduce((acc, l) => acc + (l.totalProfit || 0), 0);

    const overallMargin = totalPurchaseVal > 0 ? round2((totalProfit / totalPurchaseVal) * 100) : 0;
    const tax = round2((totalPurchaseVal * gstPercent) / 100);
    const grandTotal = round2(totalPurchaseVal + tax);

    return {
      itemCount: lines.length,
      totalPieces,
      totalPurchaseVal,
      totalSellingVal,
      totalProfit,
      overallMargin,
      tax,
      grandTotal,
    };
  }, [cartLines, gstPercent]);

  // Step Validation
  function canAdvance(targetStep) {
    setError('');
    if (targetStep > 0 && !selectedCollection) {
      setError('Please select a main collection first.');
      return false;
    }
    if (targetStep > 1 && !selectedSection) {
      setError('Please select a product type / category.');
      return false;
    }
    if (targetStep > 2 && !selectedProduct) {
      setError('Please choose a product.');
      return false;
    }
    if (targetStep > 3 && !selectedBrand) {
      setError('Please choose or add a brand.');
      return false;
    }
    if (targetStep > 4 && (!selectedSizes || !selectedSizes.length)) {
      setError('Please select at least one size.');
      return false;
    }
    if (targetStep > 5 && (!selectedColors || !selectedColors.length)) {
      setError('Please select at least one color.');
      return false;
    }
    if (targetStep > 6 && currentLineCalc.totalQty <= 0) {
      setError('Please enter a quantity of at least 1 piece.');
      return false;
    }
    if (targetStep > 7 && currentLineCalc.purchasePrice <= 0) {
      setError('Please enter a valid purchase value.');
      return false;
    }
    return true;
  }

  function goToStep(s) {
    if (s > step && !canAdvance(s)) return;
    setStep(s);
  }

  // Quick fill quantities
  function applyQuickFill() {
    const qty = parseInt(quickFillQty, 10);
    if (isNaN(qty) || qty < 0) return;
    const next = {};
    selectedColors.forEach((c) => {
      selectedSizes.forEach((s) => {
        next[`${c}__${s}`] = qty;
      });
    });
    setQuantities(next);
  }

  // Toggle size selection
  function toggleSize(sz) {
    if (selectedSizes.includes(sz)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== sz));
    } else {
      setSelectedSizes([...selectedSizes, sz]);
    }
  }

  // Toggle color selection
  function toggleColor(colName) {
    if (selectedColors.includes(colName)) {
      if (selectedColors.length === 1) {
        setError('At least one color must remain selected.');
        return;
      }
      setSelectedColors(selectedColors.filter((c) => c !== colName));
    } else {
      setSelectedColors([...selectedColors, colName]);
    }
  }

  // Add line to cart and reset line-level inputs
  function commitCurrentLineToCart(stayOrReview = 'stay') {
    if (!canAdvance(7)) return false;

    const newLine = {
      id: Math.random().toString(36).substring(2, 9),
      product: selectedProduct,
      brand: selectedBrand,
      section: selectedSection,
      collection: selectedCollection,
      sizes: [...selectedSizes],
      colors: [...selectedColors],
      quantities: { ...quantities },
      purchasePrice: currentLineCalc.purchasePrice,
      marginPercent: currentLineCalc.marginPercent,
      sellingPrice: currentLineCalc.sellingPrice,
      profitPerPiece: currentLineCalc.profitPerPiece,
      totalQty: currentLineCalc.totalQty,
      totalPurchase: currentLineCalc.totalPurchase,
      totalSelling: currentLineCalc.totalSelling,
      totalProfit: currentLineCalc.totalProfit,
    };

    setCartLines((prev) => [...prev, newLine]);
    setSuccessMsg(`Ô£ô Added "${selectedProduct.name}" (${currentLineCalc.totalQty} pcs) to Purchase Order!`);
    setTimeout(() => setSuccessMsg(''), 3500);

    if (stayOrReview === 'review') {
      setStep(8);
    } else {
      // Clear line selections to add another product
      setSelectedProduct(null);
      setSelectedSizes([]);
      setQuantities({});
      setStep(2); // Go back to Product Selection
    }
    return true;
  }

  function removeCartLine(lineId) {
    setCartLines(cartLines.filter((l) => l.id !== lineId));
  }

  // Inline Brand Creation
  async function handleCreateBrand() {
    if (!brandForm.brandName.trim()) {
      setError('Brand name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/brands', {
        brandName: brandForm.brandName.trim(),
        brandCode: brandForm.brandCode.trim() || undefined,
        manufacturer: brandForm.manufacturer.trim() || undefined,
      });
      const newBrand = res.data.data;
      setBrands((prev) => [newBrand, ...prev]);
      setSelectedBrand(newBrand);
      setInlineModal(null);
      setBrandForm({ brandName: '', brandCode: '', manufacturer: '' });
      setSuccessMsg(`Ô£ô Brand "${newBrand.brand_name}" created and selected!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Inline Custom Color Creation
  async function handleCreateColor() {
    if (!colorForm.name.trim()) {
      setError('Color name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/colours', { name: colorForm.name.trim() });
      const newCol = res.data.data;
      setColours((prev) => [...prev, newCol]);
      if (!selectedColors.includes(newCol.name)) {
        setSelectedColors([...selectedColors, newCol.name]);
      }
      setInlineModal(null);
      setColorForm({ name: '' });
      setSuccessMsg(`Ô£ô Color "${newCol.name}" added and selected!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Inline Custom Product Creation
  async function handleCreateCustomProduct() {
    if (!customProductForm.name.trim()) {
      setError('Product name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const sku = customProductForm.sku.trim() || `SKU-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const res = await api.post('/products', {
        name: customProductForm.name.trim(),
        sku,
        hsnSac: customProductForm.hsn.trim() || '6205',
        sectionId: selectedSection.id,
        brandId: selectedBrand?.id || (brands[0]?.id || null),
        purchasePrice: parseFloat(customProductForm.purchasePrice) || 800,
      });
      const newP = res.data.data;
      setProducts((prev) => [newP, ...prev]);
      setSelectedProduct(newP);
      if (newP.brand_id) {
        const b = brands.find((x) => x.id === newP.brand_id);
        if (b) setSelectedBrand(b);
      }
      setInlineModal(null);
      setCustomProductForm({ name: '', sku: '', hsn: '6205', purchasePrice: '800' });
      setSuccessMsg(`Ô£ô Product "${newP.name}" created and selected!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setStep(3); // Proceed to brand
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Inline Supplier Creation
  async function handleCreateSupplier() {
    if (!supplierForm.companyName.trim()) {
      setError('Supplier company name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const code = supplierForm.code.trim() || `SUP-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const res = await api.post('/suppliers', {
        companyName: supplierForm.companyName.trim(),
        code,
        contactPerson: supplierForm.contactPerson.trim() || undefined,
        mobile: supplierForm.mobile.trim() || undefined,
        gstin: supplierForm.gstin.trim() || undefined,
        divisionIds: orderHeader.divisionId ? [orderHeader.divisionId] : undefined,
      });
      const newSup = res.data.data;
      setSuppliers((prev) => [...prev, newSup]);
      setOrderHeader((h) => ({ ...h, supplierId: newSup.id }));
      setInlineModal(null);
      setSupplierForm({ companyName: '', code: '', contactPerson: '', mobile: '', gstin: '' });
      setSuccessMsg(`Ô£ô Supplier "${newSup.company_name}" created and selected!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Submit Final PO
  async function handleFinalSave(submitForApproval = false) {
    if (!orderHeader.supplierId) {
      setError('Please select a supplier for this purchase order.');
      return;
    }
    if (!orderHeader.divisionId) {
      setError('Please select a division for this order.');
      return;
    }

    // Determine lines to persist: cartLines + active line if not committed
    let finalLines = [...cartLines];
    if (finalLines.length === 0) {
      if (currentLineCalc.totalQty > 0) {
        finalLines = [{
          product: selectedProduct,
          brand: selectedBrand,
          section: selectedSection,
          quantities: { ...quantities },
          purchasePrice: currentLineCalc.purchasePrice,
          marginPercent: currentLineCalc.marginPercent,
          totalQty: currentLineCalc.totalQty,
        }];
      } else {
        setError('Your purchase order has no items. Add at least one product.');
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      const primarySectionId = finalLines[0]?.section?.id || selectedSection?.id || sections[0]?.id;
      const primaryDepartmentId = selectedCollection?.id || departments[0]?.id;

      // Format payload for /api/purchase-orders
      const payload = {
        supplierId: orderHeader.supplierId,
        divisionId: orderHeader.divisionId,
        departmentId: primaryDepartmentId,
        sectionId: primarySectionId,
        expectedDeliveryDate: orderHeader.expectedDeliveryDate || null,
        remarks: orderHeader.remarks || undefined,
        taxScheme: orderHeader.taxScheme || 'GST_INTRA',
        lines: finalLines.map((l) => {
          // Break quantities into array of { sizeLabel, quantity }
          const qtyList = Object.entries(l.quantities || {})
            .map(([k, v]) => {
              const [, sLabel] = k.includes('__') ? k.split('__') : ['', k];
              return { sizeLabel: sLabel || k, quantity: Number(v) || 0 };
            })
            .filter((q) => q.quantity > 0);

          return {
            productId: l.product?.id,
            colourId: colours.find((c) => (l.colors || [])[0] === c.name)?.id || null,
            purchasePrice: l.purchasePrice,
            marginPercent: l.marginPercent,
            discountType: null,
            discountValue: 0,
            quantities: qtyList,
          };
        }),
      };

      let poId = editId;
      if (editId) {
        await api.put(`/purchase-orders/${editId}`, payload);
      } else {
        const { data } = await api.post('/purchase-orders', payload);
        poId = data.data.id;
        addToCart(data.data);
      }

      if (submitForApproval) {
        await api.post(`/purchase-orders/${poId}/submit`);
      }

      navigate(`/purchase-orders/${poId}`, { state: { submitted: submitForApproval } });
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="row" style={{ alignItems: 'baseline', marginBottom: 6 }}>
        <h1 className="page-title">{editId ? 'Edit Draft Purchase Order' : 'Create Purchase Order'}</h1>
        <span className="muted" style={{ fontSize: 13 }}>
          {selectedCollection ? `${selectedCollection.name} ${selectedSection ? `- ${selectedSection.name}` : ''}` : 'Guided Procurement Workflow'}
        </span>
        <button className="btn sm ghost right" onClick={() => navigate('/purchase-orders')}>
          Cancel & Exit
        </button>
      </div>
      <p className="page-sub">Progressive 9-step guided workflow for fast, error-free purchase ordering.</p>

      {/* Progress Stepper */}
      <div className="po-wizard-stepper">
        {WIZARD_STEPS.map((s, idx) => (
          <div
            key={s.id}
            className={`po-wizard-step ${step === idx ? 'active' : step > idx ? 'done' : ''}`}
            onClick={() => goToStep(idx)}
          >
            <span className="po-wizard-step-num">{step > idx ? 'Ô£ô' : idx + 1}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert ok">{successMsg}</div>}

      {/* Two-Column Layout (Wizard on Left, Working PO Cart on Right) */}
      <div className="po-wizard-layout">
        {/* Left: Step Content */}
        <div className="po-wizard-main">
          {/* STEP 0: MAIN COLLECTION */}
          {step === 0 && (
            <div className="panel">
              <h3>1. What are you purchasing? Select Main Collection</h3>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
                Choose the department to begin. Unrelated categories will be filtered out automatically.
              </p>

              <div className="po-collection-grid">
                {STANDARD_COLLECTIONS.map((col) => {
                  const matchedDept = departments.find((d) => (d.code || '').toUpperCase() === col.code) || col;
                  const isSelected = selectedCollection?.code === col.code;
                  return (
                    <div
                      key={col.code}
                      className={`po-collection-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCollection(matchedDept);
                        setSelectedSection(null);
                        setSelectedProduct(null);
                        goToStep(1);
                      }}
                    >
                      <div className="po-collection-icon">{col.icon}</div>
                      <div className="po-collection-title">{col.name}</div>
                      <div className="po-collection-desc">{col.desc}</div>
                      <button className={`btn sm ${isSelected ? 'primary' : ''}`} style={{ marginTop: 6 }}>
                        {isSelected ? 'Selected Ô£ô' : 'Select Collection &rarr;'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 1: PRODUCT TYPE / CATEGORY */}
          {step === 1 && (
            <div className="panel">
              <div className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>2. Select Product Type / Category in {selectedCollection?.name}</h3>
                <button className="btn sm ghost right" onClick={() => goToStep(0)}>
                  &larr; Change Collection
                </button>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 16px' }}>
                Select the specific garment, item, or fabric section you want to order.
              </p>

              <div className="po-category-grid">
                {filteredSections.map((sec) => {
                  const isSelected = selectedSection?.id === sec.id;
                  return (
                    <div
                      key={sec.id}
                      className={`po-category-tile ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedSection(sec);
                        setSelectedProduct(null);
                        goToStep(2);
                      }}
                    >
                      <div className="po-category-name">{sec.name}</div>
                      <div className="po-category-sub">Code: {sec.code}</div>
                    </div>
                  );
                })}
                {filteredSections.length === 0 && (
                  <div className="muted" style={{ padding: 20, textAlign: 'center', gridColumn: '1 / -1' }}>
                    No specific sub-sections found. You can proceed with general ordering or configure sections in Masters.
                  </div>
                )}
              </div>

              <div className="row mt">
                <button className="btn" onClick={() => goToStep(0)}>&larr; Back to Collection</button>
              </div>
            </div>
          )}

          {/* STEP 2: PRODUCT SELECTION */}
          {step === 2 && (
            <div className="panel">
              <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>3. Select Product in {selectedSection?.name}</h3>
                  <div className="muted" style={{ fontSize: 12 }}>Showing active products for {selectedCollection?.name} ÔÇ║ {selectedSection?.name}</div>
                </div>
                <div className="right row" style={{ gap: 8 }}>
                  <button className="btn sm" onClick={() => setInlineModal('product')}>+ Add New Product</button>
                  <button className="btn sm ghost" onClick={() => goToStep(1)}>&larr; Change Section</button>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <input
                  type="text"
                  placeholder="­ƒöì Search product by name, SKU, or brand..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 14 }}
                />
              </div>

              <div className="po-product-grid">
                {filteredProducts.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`po-product-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedProduct(p);
                        if (p.purchase_price) setPurchasePrice(String(p.purchase_price));
                        // Auto-assign brand if product already has brand
                        if (p.brand_id) {
                          const b = brands.find((x) => x.id === p.brand_id);
                          if (b) setSelectedBrand(b);
                        }
                        goToStep(3);
                      }}
                    >
                      <div className="po-product-title">{p.name}</div>
                      <div className="po-product-sku">SKU: {p.sku || 'N/A'} - Brand: {p.brand_name || 'Standard'}</div>
                      <div className="po-product-meta">
                        <span className="po-product-price">Rs.{Number(p.purchase_price || 850).toFixed(2)}</span>
                        <button className={`btn sm ${isSelected ? 'primary' : ''}`}>
                          {isSelected ? 'Selected Ô£ô' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <p className="muted">No products found matching &quot;{productSearch}&quot; in this category.</p>
                  <button className="btn primary" onClick={() => setInlineModal('product')}>
                    + Create &quot;{productSearch || 'Custom Product'}&quot;
                  </button>
                </div>
              )}

              <div className="row mt">
                <button className="btn" onClick={() => goToStep(1)}>&larr; Back</button>
                {selectedProduct && (
                  <button className="btn primary right" onClick={() => goToStep(3)}>Continue to Brand &rarr;</button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: BRAND SELECTION */}
          {step === 3 && (
            <div className="panel">
              <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>4. Select Brand for {selectedProduct?.name}</h3>
                  <div className="muted" style={{ fontSize: 12 }}>Choose the manufacturer brand or add a new one. Showing brands from {selectedCollection?.name || 'all collections'}.</div>
                </div>
                <button className="btn sm primary right" onClick={() => setInlineModal('brand')}>
                  + Add New Brand
                </button>
              </div>

              <div className="po-brand-grid">
                {brands
                  .filter((b) => {
                    if (!selectedCollection) return true;
                    if (!b.collections?.length) return true;
                    return b.collections.some((c) => c.id === selectedCollection.id);
                  })
                  .map((b) => {
                    const isSelected = selectedBrand?.id === b.id;
                    const initials = (b.brand_name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={b.id}
                        className={`po-brand-tile ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedBrand(b);
                          goToStep(4);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {b.image_url ? (
                            <img
                              src={b.image_url}
                              alt={b.brand_name}
                              style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: '#f8fafc', border: '1px solid #e2e8f0', flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #b98a2f, #d4a84b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                              {initials}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{b.brand_name}</div>
                            {b.manufacturer && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                                {b.manufacturer}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                <div className="po-brand-tile add-new" onClick={() => setInlineModal('brand')}>
                  + Add New Brand
                </div>
              </div>

              <div className="row mt">
                <button className="btn" onClick={() => goToStep(2)}>← Back</button>
                {selectedBrand && (
                  <button className="btn primary right" onClick={() => goToStep(4)}>Continue to Sizes →</button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: SIZES SELECTION */}
          {step === 4 && (
            <div className="panel">
              <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>5. Select Sizes to Include</h3>
                <button
                  className="btn sm ghost right"
                  onClick={() => setSelectedSizes([...availableSizes])}
                >
                  Select All Sizes
                </button>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
                Pick all sizes needed for this order. Industry sizes tailored for {selectedSection?.name || 'apparel'}.
              </p>

              <div className="po-chip-group">
                {availableSizes.map((sz) => {
                  const isSelected = selectedSizes.includes(sz);
                  return (
                    <div
                      key={sz}
                      className={`po-size-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSize(sz)}
                    >
                      {sz} {isSelected ? 'Ô£ô' : ''}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 14 }}>
                <span className="muted" style={{ fontSize: 12 }}>Selected sizes: </span>
                {selectedSizes.length > 0 ? (
                  selectedSizes.map((sz) => (
                    <span key={sz} className="po-tag" style={{ marginRight: 6 }}>
                      {sz} <span className="po-tag-remove" onClick={() => toggleSize(sz)}>├ù</span>
                    </span>
                  ))
                ) : (
                  <span className="muted" style={{ fontStyle: 'italic', fontSize: 12 }}>None selected yet. Click size chips above.</span>
                )}
              </div>

              <div className="row mt">
                <button className="btn" onClick={() => goToStep(3)}>&larr; Back</button>
                <button
                  className="btn primary right"
                  disabled={selectedSizes.length === 0}
                  onClick={() => goToStep(5)}
                >
                  Continue to Colors &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: COLOR SELECTION */}
          {step === 5 && (
            <div className="panel">
              <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>6. Select Color Variants</h3>
                <button className="btn sm right" onClick={() => setInlineModal('color')}>
                  + Add Custom Color
                </button>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
                Choose one or multiple colors. Each color will be combined with your selected sizes.
              </p>

              <div className="po-chip-group">
                {STANDARD_COLORS.map((c) => {
                  const isSelected = selectedColors.includes(c.name);
                  return (
                    <div
                      key={c.name}
                      className={`po-color-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleColor(c.name)}
                    >
                      <span className="po-color-dot" style={{ background: c.hex }} />
                      <span>{c.name}</span>
                      {isSelected && <span style={{ marginLeft: 4 }}>Ô£ô</span>}
                    </div>
                  );
                })}
                {colours
                  .filter((c) => !STANDARD_COLORS.some((sc) => sc.name.toLowerCase() === c.name.toLowerCase()))
                  .map((c) => {
                    const isSelected = selectedColors.includes(c.name);
                    return (
                      <div
                        key={c.id}
                        className={`po-color-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleColor(c.name)}
                      >
                        <span className="po-color-dot" style={{ background: '#94a3b8' }} />
                        <span>{c.name}</span>
                        {isSelected && <span style={{ marginLeft: 4 }}>Ô£ô</span>}
                      </div>
                    );
                  })}
              </div>

              <div style={{ marginTop: 14 }}>
                <span className="muted" style={{ fontSize: 12 }}>Selected colors: </span>
                {selectedColors.map((c) => (
                  <span key={c} className="po-tag" style={{ marginRight: 6 }}>
                    {c} <span className="po-tag-remove" onClick={() => toggleColor(c)}>├ù</span>
                  </span>
                ))}
              </div>

              <div className="row mt">
                <button className="btn" onClick={() => goToStep(4)}>&larr; Back</button>
                <button
                  className="btn primary right"
                  disabled={selectedColors.length === 0}
                  onClick={() => goToStep(6)}
                >
                  Continue to Quantity Matrix &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: QUANTITY MATRIX */}
          {step === 6 && (
            <div className="panel">
              <div className="row" style={{ alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>7. Enter Quantities per Color & Size</h3>
                  <div className="muted" style={{ fontSize: 12 }}>Non-negative piece counts for {selectedProduct?.name} ({selectedBrand?.brand_name})</div>
                </div>
                <div className="right row" style={{ alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Quick Fill:</span>
                  <input
                    type="number"
                    min="0"
                    value={quickFillQty}
                    onChange={(e) => setQuickFillQty(e.target.value)}
                    style={{ width: 54, padding: '4px 6px', textAlign: 'center', border: '1px solid var(--line)', borderRadius: 6 }}
                  />
                  <button className="btn sm" onClick={applyQuickFill}>Fill All</button>
                </div>
              </div>

              <div className="po-matrix-container">
                <table className="po-matrix-table">
                  <thead>
                    <tr>
                      <th>Color</th>
                      <th>Size</th>
                      <th style={{ width: 120 }}>Quantity (pcs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedColors.flatMap((c) =>
                      selectedSizes.map((sz) => {
                        const key = `${c}__${sz}`;
                        return (
                          <tr key={key}>
                            <td>
                              <strong>{c}</strong>
                            </td>
                            <td>
                              <span className="chip">{sz}</span>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="po-matrix-input"
                                value={quantities[key] ?? ''}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setQuantities({ ...quantities, [key]: val });
                                }}
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="row mt" style={{ alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: 8 }}>
                <strong style={{ fontSize: 15 }}>Total Quantity: {currentLineCalc.totalQty} Pieces</strong>
                <span className="muted" style={{ marginLeft: 12, fontSize: 13 }}>
                  across {selectedColors.length * selectedSizes.length} variant combinations
                </span>
              </div>

              <div className="row mt">
                <button className="btn" onClick={() => goToStep(5)}>&larr; Back</button>
                <button
                  className="btn primary right"
                  disabled={currentLineCalc.totalQty <= 0}
                  onClick={() => goToStep(7)}
                >
                  Continue to Pricing &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: PRICING & MARGINS */}
          {step === 7 && (
            <div className="panel">
              <h3>8. Pricing, Margin & Selling Value Calculation</h3>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 16px' }}>
                Enter purchase price and target margin. Selling price and net profit per piece calculate automatically.
              </p>

              <div className="fields-2">
                <Field label="Purchase Value / Cost Price (Rs. per piece)" hint="Must be greater than 0">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                  />
                </Field>
                <Field label="Expected Margin %" hint="Profit margin percentage applied to cost">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(e.target.value)}
                  />
                </Field>
              </div>

              {/* Real-time Calculation Panel */}
              <div className="po-calc-panel">
                <div className="po-calc-grid">
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Purchase Value</span>
                    <span className="po-calc-metric-val">Rs.{currentLineCalc.purchasePrice.toFixed(2)}</span>
                  </div>
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Margin Applied</span>
                    <span className="po-calc-metric-val">{currentLineCalc.marginPercent}%</span>
                  </div>
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Selling Price</span>
                    <span className="po-calc-metric-val">Rs.{currentLineCalc.sellingPrice.toFixed(2)}</span>
                  </div>
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Profit / Piece</span>
                    <span className="po-calc-metric-val profit">Rs.{currentLineCalc.profitPerPiece.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 14, paddingTop: 12 }} className="po-calc-grid">
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Line Total Qty</span>
                    <span className="po-calc-metric-val">{currentLineCalc.totalQty} Pieces</span>
                  </div>
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Total Purchase Value</span>
                    <span className="po-calc-metric-val">Rs.{currentLineCalc.totalPurchase.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Total Expected Sales</span>
                    <span className="po-calc-metric-val">Rs.{currentLineCalc.totalSelling.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="po-calc-metric">
                    <span className="po-calc-metric-label">Total Expected Profit</span>
                    <span className="po-calc-metric-val profit">Rs.{currentLineCalc.totalProfit.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="row mt" style={{ gap: 12 }}>
                <button className="btn" onClick={() => goToStep(6)}>&larr; Back</button>
                <button
                  className="btn"
                  style={{ marginLeft: 'auto', fontWeight: 600 }}
                  onClick={() => commitCurrentLineToCart('stay')}
                >
                  + Add Another Product
                </button>
                <button
                  className="btn primary"
                  onClick={() => commitCurrentLineToCart('review')}
                >
                  Review Order &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 8: FINAL REVIEW & SUBMIT */}
          {step === 8 && (
            <div className="panel">
              <h3>9. Review & Finalize Purchase Order</h3>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 16px' }}>
                Verify supplier details, line items, and financial summary before creating the purchase order.
              </p>

              {/* Order Metadata Form */}
              <div className="fields-3" style={{ marginBottom: 16 }}>
                <Field label="Supplier / Dealer" hint="Mandatory vendor assignment">
                  <div className="row" style={{ gap: 6 }}>
                    <select
                      value={orderHeader.supplierId}
                      onChange={(e) => setOrderHeader({ ...orderHeader, supplierId: e.target.value })}
                      style={{ flex: 1 }}
                    >
                      <option value="">ÔÇö Select Supplier ÔÇö</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.company_name} ({s.code})
                        </option>
                      ))}
                    </select>
                    <button className="btn sm" type="button" onClick={() => setInlineModal('supplier')}>+ New</button>
                  </div>
                </Field>

                <Field label="Division / Hub">
                  <select
                    value={orderHeader.divisionId}
                    onChange={(e) => setOrderHeader({ ...orderHeader, divisionId: e.target.value })}
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </Field>

                <Field label="Expected Delivery Date">
                  <input
                    type="date"
                    value={orderHeader.expectedDeliveryDate}
                    onChange={(e) => setOrderHeader({ ...orderHeader, expectedDeliveryDate: e.target.value })}
                  />
                </Field>
              </div>

              <div className="fields-2" style={{ marginBottom: 18 }}>
                <Field label="Tax Scheme">
                  <select
                    value={orderHeader.taxScheme}
                    onChange={(e) => setOrderHeader({ ...orderHeader, taxScheme: e.target.value })}
                  >
                    <option value="GST_INTRA">GST Intra-state (CGST + SGST)</option>
                    <option value="GST_INTER">GST Inter-state (IGST)</option>
                  </select>
                </Field>
                <Field label="Remarks / Procurement Notes">
                  <input
                    placeholder="e.g. Urgent delivery required for festive collection"
                    value={orderHeader.remarks}
                    onChange={(e) => setOrderHeader({ ...orderHeader, remarks: e.target.value })}
                  />
                </Field>
              </div>

              {/* Items Table */}
              <h4 style={{ margin: '14px 0 8px', color: 'var(--brand-ink)' }}>Purchase Order Items ({cartLines.length})</h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 16 }}>
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Brand</th>
                      <th>Sizes & Colors</th>
                      <th className="num">Qty</th>
                      <th className="num">Cost / Unit</th>
                      <th className="num">Margin</th>
                      <th className="num">Selling Price</th>
                      <th className="num">Profit / Piece</th>
                      <th className="num">Total Value</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartLines.map((line, idx) => (
                      <tr key={line.id || idx}>
                        <td>
                          <strong>{line.product?.name}</strong>
                          <div className="muted" style={{ fontSize: 11 }}>SKU: {line.product?.sku}</div>
                        </td>
                        <td>{line.brand?.brand_name || 'ÔÇö'}</td>
                        <td>
                          <div style={{ fontSize: 12 }}>{line.colors?.join(', ')}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{line.sizes?.join(', ')}</div>
                        </td>
                        <td className="num"><strong>{line.totalQty}</strong></td>
                        <td className="num">Rs.{line.purchasePrice?.toFixed(2)}</td>
                        <td className="num">{line.marginPercent}%</td>
                        <td className="num">Rs.{line.sellingPrice?.toFixed(2)}</td>
                        <td className="num" style={{ color: '#16a34a' }}>+Rs.{line.profitPerPiece?.toFixed(2)}</td>
                        <td className="num"><strong><Money value={line.totalPurchase} /></strong></td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn sm danger"
                            style={{ padding: '2px 8px' }}
                            onClick={() => removeCartLine(line.id)}
                            title="Remove line"
                          >
                            ├ù
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cartLines.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                          No items committed to this purchase order yet. Click &quot;Add Another Product&quot; to configure lines.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                <button className="btn" onClick={() => goToStep(7)}>
                  &larr; Back to Pricing
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setSelectedProduct(null);
                    setSelectedSizes([]);
                    setQuantities({});
                    setStep(2);
                  }}
                >
                  + Add More Products
                </button>

                <div className="right row" style={{ gap: 10 }}>
                  <button
                    className="btn"
                    disabled={busy || cartLines.length === 0}
                    onClick={() => handleFinalSave(false)}
                  >
                    {busy ? 'SavingÔÇª' : editId ? 'Save Draft Changes' : 'Save Draft'}
                  </button>
                  {hasPermission('po.submit') && (
                    <button
                      className="btn accent"
                      disabled={busy || cartLines.length === 0}
                      onClick={() => handleFinalSave(true)}
                    >
                      {busy ? 'SubmittingÔÇª' : 'Create & Submit for Approval'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Persistent Working PO Cart */}
        <div className="po-wizard-sidebar">
          <div className="po-cart-panel">
            <div className="po-cart-title">
              <span>Current PO Cart</span>
              <span className="chip st-active">{cartSummary.itemCount} SKUs</span>
            </div>

            {/* List of items in cart */}
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {cartLines.map((line, i) => (
                <div key={line.id || i} className="po-cart-item">
                  <div className="po-cart-item-header">
                    <span>{line.product?.name}</span>
                    <span style={{ color: '#b3261e', cursor: 'pointer' }} onClick={() => removeCartLine(line.id)}>├ù</span>
                  </div>
                  <div className="po-cart-item-sub">
                    {line.brand?.brand_name} - {line.totalQty} pcs - Rs.{line.purchasePrice}/pc
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontWeight: 700 }}>
                    <span style={{ color: '#16a34a', fontSize: 11.5 }}>+{line.marginPercent}% (Rs.{line.totalProfit} profit)</span>
                    <span>Rs.{line.totalPurchase?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
              {cartLines.length === 0 && (
                <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: '16px 0' }}>
                  No items in cart yet. Select a product, sizes, and quantities to add.
                </p>
              )}
            </div>

            {/* Cart Aggregations */}
            <div className="po-cart-totals">
              <div className="po-cart-totals-row">
                <span>Total Quantity:</span>
                <strong>{cartSummary.totalPieces} Pieces</strong>
              </div>
              <div className="po-cart-totals-row">
                <span>Purchase Value:</span>
                <strong>Rs.{cartSummary.totalPurchaseVal.toLocaleString('en-IN')}</strong>
              </div>
              <div className="po-cart-totals-row">
                <span>Expected Sales:</span>
                <strong>Rs.{cartSummary.totalSellingVal.toLocaleString('en-IN')}</strong>
              </div>
              <div className="po-cart-totals-row" style={{ color: '#16a34a' }}>
                <span>Expected Profit:</span>
                <strong style={{ color: '#16a34a' }}>Rs.{cartSummary.totalProfit.toLocaleString('en-IN')} ({cartSummary.overallMargin}%)</strong>
              </div>
              <div className="po-cart-totals-row grand">
                <span>Total (incl. GST):</span>
                <span>Rs.{cartSummary.grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {step < 8 && cartLines.length > 0 && (
                <button className="btn primary" style={{ width: '100%' }} onClick={() => goToStep(8)}>
                  Review & Finalize Order ({cartSummary.itemCount}) &rarr;
                </button>
              )}
              {step >= 2 && step <= 7 && selectedProduct && currentLineCalc.totalQty > 0 && (
                <button
                  className="btn"
                  style={{ width: '100%', fontSize: 12.5 }}
                  onClick={() => commitCurrentLineToCart('stay')}
                >
                  + Add Another Product
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Inline Modal: Add New Brand ---------- */}
      {inlineModal === 'brand' && (
        <Modal title="+ Add New Brand" onClose={() => setInlineModal(null)}>
          <div style={{ padding: '8px 0' }}>
            <Field label="Brand Name" hint="Brand name must be unique">
              <input
                placeholder="e.g. Louis Philippe"
                value={brandForm.brandName}
                onChange={(e) => setBrandForm({ ...brandForm, brandName: e.target.value })}
                autoFocus
              />
            </Field>
            <div className="fields-2">
              <Field label="Brand Code (Optional)" hint="e.g. LP">
                <input
                  placeholder="e.g. LP"
                  value={brandForm.brandCode}
                  onChange={(e) => setBrandForm({ ...brandForm, brandCode: e.target.value })}
                />
              </Field>
              <Field label="Company / Manufacturer">
                <input
                  placeholder="e.g. Madura Fashion & Lifestyle"
                  value={brandForm.manufacturer}
                  onChange={(e) => setBrandForm({ ...brandForm, manufacturer: e.target.value })}
                />
              </Field>
            </div>
            <div className="row mt" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setInlineModal(null)}>Cancel</button>
              <button className="btn primary" disabled={busy || !brandForm.brandName.trim()} onClick={handleCreateBrand}>
                {busy ? 'SavingÔÇª' : 'Save Brand'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------- Inline Modal: Add Custom Color ---------- */}
      {inlineModal === 'color' && (
        <Modal title="+ Add Custom Color" onClose={() => setInlineModal(null)}>
          <div style={{ padding: '8px 0' }}>
            <Field label="Color Name" hint="e.g. Sage Green, Coral Pink">
              <input
                placeholder="e.g. Mustard Yellow"
                value={colorForm.name}
                onChange={(e) => setColorForm({ ...colorForm, name: e.target.value })}
                autoFocus
              />
            </Field>
            <div className="row mt" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setInlineModal(null)}>Cancel</button>
              <button className="btn primary" disabled={busy || !colorForm.name.trim()} onClick={handleCreateColor}>
                {busy ? 'AddingÔÇª' : 'Add Color'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------- Inline Modal: Add Custom Product ---------- */}
      {inlineModal === 'product' && (
        <Modal title="+ Add New Product" onClose={() => setInlineModal(null)}>
          <div style={{ padding: '8px 0' }}>
            <Field label="Product Name" hint="Full descriptive name">
              <input
                placeholder="e.g. Premium Cotton Formal Shirt"
                value={customProductForm.name}
                onChange={(e) => setCustomProductForm({ ...customProductForm, name: e.target.value })}
                autoFocus
              />
            </Field>
            <div className="fields-3">
              <Field label="SKU (Optional)">
                <input
                  placeholder="e.g. RAY-SH-09"
                  value={customProductForm.sku}
                  onChange={(e) => setCustomProductForm({ ...customProductForm, sku: e.target.value })}
                />
              </Field>
              <Field label="HSN Code">
                <input
                  placeholder="6205"
                  value={customProductForm.hsn}
                  onChange={(e) => setCustomProductForm({ ...customProductForm, hsn: e.target.value })}
                />
              </Field>
              <Field label="Estimated Cost (Rs.)">
                <input
                  type="number"
                  min="0"
                  value={customProductForm.purchasePrice}
                  onChange={(e) => setCustomProductForm({ ...customProductForm, purchasePrice: e.target.value })}
                />
              </Field>
            </div>
            <div className="row mt" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setInlineModal(null)}>Cancel</button>
              <button className="btn primary" disabled={busy || !customProductForm.name.trim()} onClick={handleCreateCustomProduct}>
                {busy ? 'CreatingÔÇª' : 'Create & Select Product'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------- Inline Modal: Add Supplier ---------- */}
      {inlineModal === 'supplier' && (
        <Modal title="+ Add New Supplier" onClose={() => setInlineModal(null)}>
          <div style={{ padding: '8px 0' }}>
            <div className="fields-2">
              <Field label="Company Name">
                <input
                  placeholder="e.g. Arvind Textiles Ltd"
                  value={supplierForm.companyName}
                  onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label="Supplier Code">
                <input
                  placeholder="e.g. ARV-01"
                  value={supplierForm.code}
                  onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                />
              </Field>
            </div>
            <div className="fields-3">
              <Field label="Contact Person">
                <input
                  placeholder="e.g. Rajesh Kumar"
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                />
              </Field>
              <Field label="Phone / Mobile">
                <input
                  placeholder="9876543210"
                  value={supplierForm.mobile}
                  onChange={(e) => setSupplierForm({ ...supplierForm, mobile: e.target.value })}
                />
              </Field>
              <Field label="GSTIN">
                <input
                  placeholder="29AAAAA0000A1Z5"
                  value={supplierForm.gstin}
                  onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                />
              </Field>
            </div>
            <div className="row mt" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setInlineModal(null)}>Cancel</button>
              <button className="btn primary" disabled={busy || !supplierForm.companyName.trim()} onClick={handleCreateSupplier}>
                {busy ? 'SavingÔÇª' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
