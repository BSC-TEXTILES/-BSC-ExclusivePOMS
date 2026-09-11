const API_BASE = 'http://localhost:4040/api';

async function run() {
  console.log('Testing POMS enhancements against', API_BASE);

  // 1. Authenticate as Super Admin
  const captchaRes = await fetch(`${API_BASE}/auth/captcha?reveal=1`);
  const cap = await captchaRes.json();
  
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin@bsc.local',
      password: 'Admin@123',
      captchaId: cap.id,
      captchaText: cap.answer,
    }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }
  const token = loginData.accessToken;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✓ Logged in as:', loginData.user.name, 'Roles:', loginData.user.roles);

  // 2. Test Brand creation with auto-generated number and serial
  const brandName = `Test Brand ${Date.now().toString(36).toUpperCase()}`;
  const brandRes = await fetch(`${API_BASE}/brands`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brandName,
      manufacturer: 'BSC Textile Mills',
    }),
  });
  const brandData = await brandRes.json();
  console.log('Brand creation status:', brandRes.status, 'ID:', brandData.data?.id, 'Number:', brandData.data?.brand_number, 'Serial:', brandData.data?.brand_serial);
  if (!brandRes.ok || !brandData.data?.brand_number) {
    console.error('Brand creation failed:', brandData);
    process.exit(1);
  }
  console.log('✓ Auto-generated Brand Number & Serial test PASSED');

  // 3. Test CSV Preview
  const sampleCsv = `Brand,Product Name,SKU,Category,Size,Colour,Quantity,Purchase Price,Margin %,Selling Price,HSN
${brandName},Slim Luxury Shirt,SLIM-${Date.now().toString(36).toUpperCase()},Men's Shirts,40,White,20,900,30,1170.00,6205
NewBrandXYZ,Modern Casual Chino,CHINO-${Date.now().toString(36).toUpperCase()},Men's Trousers,32,Navy Blue,15,1200,25,1500.00,6203`;

  const previewRes = await fetch(`${API_BASE}/purchase-orders/import/csv-preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csvText: sampleCsv }),
  });
  const previewData = await previewRes.json();
  console.log('CSV Preview response:', previewRes.status, {
    totalRows: previewData.data?.totalRows,
    validRows: previewData.data?.validRows,
    newBrandsCount: previewData.data?.newBrandsCount,
    newProductsCount: previewData.data?.newProductsCount,
  });
  if (!previewRes.ok || previewData.data?.validRows !== 2) {
    console.error('CSV Preview failed:', previewData);
    process.exit(1);
  }
  console.log('✓ CSV Preview & Validation test PASSED');

  // 4. Test CSV Commit
  const commitRes = await fetch(`${API_BASE}/purchase-orders/import/csv-commit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csvText: sampleCsv, updateExisting: true }),
  });
  const commitData = await commitRes.json();
  console.log('CSV Commit response:', commitRes.status, commitData.message, commitData.data);
  if (!commitRes.ok || commitData.data?.productsInserted < 1) {
    console.error('CSV Commit failed:', commitData);
    process.exit(1);
  }
  console.log('✓ CSV Commit & Ingestion test PASSED');

  // 5. Fetch or Create a Purchase Order
  const poListRes = await fetch(`${API_BASE}/purchase-orders?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const poListData = await poListRes.json();
  let existingPo = poListData.data?.[0];

  if (!existingPo) {
    console.log('No existing PO found — creating one through the API...');
    const [divsRes, secsRes, supsRes, prodsRes] = await Promise.all([
      fetch(`${API_BASE}/divisions`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/sections`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/suppliers`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/products?limit=1`, { headers }).then((r) => r.json()),
    ]);

    const div = divsRes.data?.[0];
    const sec = secsRes.data?.[0];
    const sup = supsRes.data?.[0];
    const prod = prodsRes.data?.[0];

    const createPoRes = await fetch(`${API_BASE}/purchase-orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        divisionId: div.id,
        departmentId: prod.department_id,
        sectionId: prod.section_id,
        supplierId: sup.id,
        paymentTerms: 'net_30',
        deliveryTerms: 'Door Delivery',
        taxScheme: 'GST_INTRA',
        expectedDeliveryDate: '2026-10-15',
        remarks: 'Automated enhancement test order',
        lines: [
          {
            productId: prod.id,
            purchasePrice: 850,
            marginPercent: 25,
            quantity: 25,
            quantities: [
              { sizeLabel: '40', quantity: 15 },
              { sizeLabel: '42', quantity: 10 },
            ],
          },
        ],
      }),
    });

    const createPoData = await createPoRes.json();
    if (!createPoRes.ok) {
      console.error('Failed to create test PO:', createPoData);
      process.exit(1);
    }
    existingPo = createPoData.data;
    console.log('✓ Created test PO:', existingPo.po_number);
  }

  // 6. Test PO CSV Export (all 18 business columns)
  const exportRes = await fetch(`${API_BASE}/purchase-orders/${existingPo.id}/export/csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const exportCsv = await exportRes.text();
  const firstLine = exportCsv.split('\n')[0].trim();
  console.log('PO Export CSV header:', firstLine);
  const expectedCols = [
    'PO Number',
    'PO Date',
    'Collection',
    'Category',
    'Product SKU',
    'Product Name',
    'Brand',
    'Supplier',
    'Colour',
    'Size Breakdown',
    'Quantity',
    'Purchase Value',
    'Margin %',
    'Selling Price',
    'Profit Per Piece',
    'Total Purchase Value',
    'Total Selling Value',
    'Total Profit',
  ];
  const missingCols = expectedCols.filter((col) => !exportCsv.includes(col));
  if (missingCols.length > 0) {
    console.error('Missing expected columns in CSV export:', missingCols);
    process.exit(1);
  }
  console.log('✓ PO CSV Export (all 18 specified columns verified) test PASSED');

  // 7. Test Email PO endpoint
  const emailRes = await fetch(`${API_BASE}/purchase-orders/${existingPo.id}/email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      recipientEmail: 'vendor.test@example.com',
      subject: `PO Notice ${existingPo.po_number}`,
      message: 'Please review and confirm dispatch schedule.',
    }),
  });
    const emailData = await emailRes.json();
    console.log('PO Email response:', emailRes.status, emailData.message);
    if (!emailRes.ok) {
      console.error('PO Email failed:', emailData);
      process.exit(1);
    }
    console.log('✓ PO Email test PASSED');

  console.log('\n========================================');
  console.log('ALL BSC POMS ENHANCEMENT TESTS PASSED!');
  console.log('========================================\n');
}

run().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
