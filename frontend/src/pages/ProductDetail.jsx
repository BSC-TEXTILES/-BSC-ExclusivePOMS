import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/products/${id}`).then((r) => setProduct(r.data.data || r.data)).catch((e) => setError(errMessage(e)));
  }, [id]);

  if (error) return <div className="content"><div className="alert error">{error}</div><Link to="/products">← Back to Products</Link></div>;
  if (!product) return <div className="content"><div className="loading"><span className="loading-spinner" /> Loading product…</div></div>;

  const attrs = product.attributes || {};
  const colours = product.colours || product.colors || [];
  const sizes = product.sizes || [];

  return (
    <div className="content">
      <div style={{ marginBottom: 16 }}>
        <Link to="/products" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← Back to Products</Link>
      </div>

      <div className="product-detail-header">
        <div className="product-detail-img">
          {product.images?.[0] ? <img src={product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : '👕'}
        </div>
        <div className="product-detail-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="product-detail-name">{product.name}</h1>
              <div className="product-detail-sku">SKU: {product.sku} &nbsp;|&nbsp; Serial: {product.product_serial}</div>
            </div>
            <span className={`chip st-${product.status}`}>{product.status}</span>
          </div>

          {product.description && <p style={{ color: '#6b7280', marginTop: 8 }}>{product.description}</p>}

          <div className="product-detail-meta" style={{ marginTop: 16 }}>
            <div className="meta-item"><div className="meta-label">Category</div><div className="meta-value">{product.category_name || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Brand</div><div className="meta-value">{product.brand_name || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Manufacturer</div><div className="meta-value">{product.manufacturer_name || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Gender</div><div className="meta-value" style={{ textTransform: 'capitalize' }}>{product.gender || 'Men'}</div></div>
            <div className="meta-item"><div className="meta-label">Material</div><div className="meta-value">{product.material || attrs.material || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Pattern</div><div className="meta-value">{product.pattern || attrs.pattern || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Fit</div><div className="meta-value">{product.fit || attrs.fit || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Neck Type</div><div className="meta-value">{product.neck_type || attrs.neck_type || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Sleeve Type</div><div className="meta-value">{product.sleeve_type || attrs.sleeve_type || '—'}</div></div>
            <div className="meta-item"><div className="meta-label">Season</div><div className="meta-value">{product.season || attrs.season || '—'}</div></div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="pricing-card">
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Pricing (INR)</div>
        <div className="pricing-row"><span className="pricing-label">Purchase Price</span><span className="pricing-value">{INR(product.purchase_price)}</span></div>
        <div className="pricing-row"><span className="pricing-label">Selling Price</span><span className="pricing-value">{INR(product.selling_price)}</span></div>
        <div className="pricing-row"><span className="pricing-label">Profit Amount</span><span className="pricing-value pricing-profit">{INR(product.profit_amount)}</span></div>
        <div className="pricing-row"><span className="pricing-label">Profit Margin</span><span className="pricing-value pricing-margin">{Number(product.profit_margin || 0).toFixed(1)}%</span></div>
      </div>

      {/* Sizes & Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="panel">
          <h3>Available Sizes</h3>
          <div className="tag-list">
            {sizes.map((s, i) => <span key={i} className="tag">{s.label || s}</span>)}
            {!sizes.length && <span style={{ color: '#6b7280', fontSize: 13 }}>No sizes defined</span>}
          </div>
        </div>
        <div className="panel">
          <h3>Available Colors</h3>
          <div className="tag-list">
            {colours.map((c, i) => (
              <span key={i} className="tag">
                {c.swatch_hex && <span className="color-dot" style={{ background: c.swatch_hex }} />}
                {c.name || c}
              </span>
            ))}
            {!colours.length && <span style={{ color: '#6b7280', fontSize: 13 }}>No colors defined</span>}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Metadata</h3>
        <div className="product-detail-meta">
          <div className="meta-item"><div className="meta-label">Created At</div><div className="meta-value" style={{ fontSize: 13 }}>{product.created_at ? new Date(product.created_at).toLocaleString('en-IN') : '—'}</div></div>
          <div className="meta-item"><div className="meta-label">Updated At</div><div className="meta-value" style={{ fontSize: 13 }}>{product.updated_at ? new Date(product.updated_at).toLocaleString('en-IN') : '—'}</div></div>
          <div className="meta-item"><div className="meta-label">Barcode</div><div className="meta-value" style={{ fontSize: 13 }}>{product.barcode || '—'}</div></div>
          <div className="meta-item"><div className="meta-label">Internal Ref</div><div className="meta-value" style={{ fontSize: 13 }}>{product.internal_ref || '—'}</div></div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        {(user?.isSuperAdmin || user?.permissions?.includes('products.edit')) && (
          <Link to={`/products/${product.id}/edit`} className="btn primary">Edit Product</Link>
        )}
        {(user?.isSuperAdmin || user?.permissions?.includes('orders.create')) && (
          <Link to={`/purchase-orders/new?product=${product.id}`} className="btn accent">Place Order</Link>
        )}
      </div>
    </div>
  );
}
