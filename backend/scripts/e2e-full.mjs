import 'dotenv/config';

const BASE = 'http://localhost:4040/api';
let token = null;
let failures = 0;

async function req(method, path, body, expect = 200) {
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ok = res.status === expect;
    if (!ok) {
      failures++;
      const text = await res.text();
      console.log(`FAIL ${method} ${path} → ${res.status} (expected ${expect}): ${text.slice(0, 200)}`);
    } else {
      console.log(`PASS ${method} ${path} → ${res.status}`);
    }
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, json };
  } catch (e) {
    failures++;
    console.log(`ERROR ${method} ${path}: ${e.message}`);
    return { status: 0, json: null };
  }
}

// 1. Login
const login = await req('POST', '/auth/login', { identifier: 'admin@bsc.local', password: 'Admin@123' });
if (login.json?.accessToken) {
  token = login.json.accessToken;
  console.log('Logged in as', login.json.user?.email, 'roles:', login.json.user?.roles?.join(','));
} else {
  console.log('LOGIN FAILED — aborting');
  process.exit(1);
}

// 2. Core reference endpoints
await req('GET', '/auth/me');
await req('GET', '/divisions');
await req('GET', '/departments');
await req('GET', '/sections');
await req('GET', '/size-methods');
await req('GET', '/sizes');
await req('GET', '/colours');
await req('GET', '/brands');
await req('GET', '/categories');
await req('GET', '/products?pageSize=5');
await req('GET', '/suppliers');
await req('GET', '/users');
await req('GET', '/users/_meta/roles');
await req('GET', '/roles');
await req('GET', '/manufacturers?limit=5');
await req('GET', '/pricing?limit=5');
await req('GET', '/pricing/stats');
await req('GET', '/purchase-orders?pageSize=5');
await req('GET', '/approvals/queue');
await req('GET', '/receipts');
await req('GET', '/inventory/balances');
await req('GET', '/inventory/transactions');
await req('GET', '/reports/dashboard');
await req('GET', '/reports/calendar');
await req('GET', '/reports/po-register');
await req('GET', '/reports/purchase-summary');
await req('GET', '/reports/dealer');
await req('GET', '/reports/size');
await req('GET', '/reports/margin');
await req('GET', '/reports/receiving');
await req('GET', '/audit-logs?pageSize=5');
await req('GET', '/notifications');
await req('GET', '/settings');
await req('GET', '/search?q=shirt');
await req('GET', '/chat/messages');

// 3. PO lifecycle test (create → submit → approve → issue → receive)
const divisions = (await req('GET', '/divisions')).json?.data || [];
const departments = (await req('GET', '/departments')).json?.data || [];
const sections = (await req('GET', '/sections')).json?.data || [];
const suppliers = (await req('GET', '/suppliers')).json?.data || [];
const products = (await req('GET', '/products?pageSize=5')).json?.data || [];
const sizes = (await req('GET', '/sizes')).json?.data || [];

if (divisions.length && departments.length && sections.length && suppliers.length && products.length) {
  const section = sections.find((s) => s.id === products[0].section_id) || sections[0];
  const dept = departments.find((d) => d.id === section.department_id) || departments[0];
  const sizeId = sizes[0]?.id;

  const created = await req('POST', '/purchase-orders', {
    divisionId: divisions[0].id,
    departmentId: dept.id,
    sectionId: section.id,
    supplierId: suppliers[0].id,
    paymentTerms: 'net_30',
    lines: [{
      productId: products[0].id,
      purchasePrice: 650,
      marginPercent: 40,
      discountType: 'percent',
      discountValue: 10,
      quantities: [{ sizeId, sizeLabel: sizeId ? undefined : 'Free Size', quantity: 80 }],
    }],
  }, 201);

  const poId = created.json?.data?.id;
  if (poId) {
    await req('GET', `/purchase-orders/${poId}`);
    await req('POST', `/purchase-orders/${poId}/submit`);
    await req('POST', `/purchase-orders/${poId}/approval-action`, { action: 'approved', comments: 'e2e test approval' });
    await req('POST', `/purchase-orders/${poId}/issue`);
    // Receipt
    const pending = (await req('GET', `/receipts/pending/${poId}`)).json?.data || [];
    if (pending.length) {
      await req('POST', '/receipts', {
        poId,
        lines: [{ poItemId: pending[0].po_item_id, receivedQty: 10, damagedQty: 0, rejectedQty: 0 }],
        post: true,
      }, 201);
    }
    await req('GET', `/purchase-orders/${poId}/versions`);
  }
}

console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} E2E CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);