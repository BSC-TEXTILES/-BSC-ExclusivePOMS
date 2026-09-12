import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { Field } from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';

// Auction Page — Supplier Bidding System (§21.1)
// Suppliers place competing bids on products/sections; buyer picks best price/terms
export default function AuctionPage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('sectionId') || '';

  // State
  const [auctions, setAuctions] = useState([]);
  const [auction, setAuction] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bidding state
  const [biddingItem, setBiddingItem] = useState(null);
  const [biddingAmount, setBiddingAmount] = useState('');
  const [myBids, setMyBids] = useState([]);
  const [bidding, setBidding] = useState(false);

  // Load auctions for this section
  useEffect(() => {
    api.get('/api/auctions?sectionId=' + sectionId)
      .then((r) => setAuctions(r.data.data || []))
      .catch((e) => setError(errMessage(e)));
  }, [sectionId]);

  // Load my bids
  useEffect(() => {
    if (user?.id) {
      api.get('/api/auctions/my-bids')
        .then((r) => setMyBids(r.data.data || []))
        .catch(() => {});
    }
  }, [user?.id]);

  // Create new auction
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setError('');
    try {
      const { data } = await api.post('/api/auctions', {
        title: e.target.title.value,
        description: e.target.description.value,
        sectionId,
        startingPrice: Number(e.target.startingPrice.value),
        minBidIncrement: Number(e.target.minBidIncrement.value) || 50,
      });
      setAuction(data.data);
      setSuccess('Auction created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) { setError(errMessage(e)); }
    setCreating(false);
  };

  // Place bid
  const handleBid = async () => {
    if (!biddingAmount || Number(biddingAmount) <= 0) return;
    setBidding(true); setError('');
    try {
      const { data } = await api.post('/api/auctions/:id/bids'.replace(':id', biddingItem?.id || ''), {
        amount: Number(biddingAmount),
      });
      setSuccess('Bid placed successfully!');
      setTimeout(() => setSuccess(''), 2000);
      setBiddingAmount('');
      // Refresh my bids
      if (user?.id) {
        api.get('/api/auctions/my-bids')
          .then((r) => setMyBids(r.data.data || []))
          .catch(() => {});
      }
    } catch (e) { setError(errMessage(e)); }
    setBidding(false);
  };

  // Format currency
  const fmt = (n) => n.toLocaleString('en-IN');

  // Render status badge
  const statusBadge = (s) => {
    const map = { active: 'Active', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled' };
    const colors = { active: '#10b981', paused: '#f59e0b', completed: '#6b7280', cancelled: '#ef4444' };
    return <span style={{ color: colors[s] || '#6b7280', fontWeight: 600 }}>{map[s] || s}</span>;
  };

  // If no section filter, show all active auctions
  if (!sectionId && auctions.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Auctions</h1>
        <p className="page-sub">Supplier bidding system — place competing bids on products and sections</p>
        <div className="alert info">No active auctions found. <button className="btn sm" onClick={() => setSectionId((s) => s || 'men')} style={{ marginTop: 8 }}>Create First Auction</button></div>
      </div>
    );
  }

  // Create Auction Modal
  if (creating) {
    return (
      <Modal title="Create Auction" onClose={() => setCreating(false)}>
        <form onSubmit={handleCreate}>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Auction Title" hint="e.g. Men's Shirts Season Opening">
                <input name="title" type="text" required defaultValue="Men's Shirts Opening" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Starting Price (INR)" hint="e.g. 5000">
                <input name="startingPrice" type="number" min="0" required defaultValue="5000" />
              </Field>
            </div>
          </div>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Min Bid Increment" hint="e.g. 50">
                <input name="minBidIncrement" type="number" min="1" required defaultValue="50" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Section" hint="Optional — limit auction to a section">
                <select defaultValue={sectionId || ''}>
                  <option value="">All sections</option>
                  {sectionId ? [] : [
                    { key: 'men', name: "Men's Collection" },
                    { key: 'women', name: "Women's Collection" },
                    { key: 'kids', name: "Kids Collection" },
                    { key: 'home', name: "Home & Furnishing" },
                  ].map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn primary" type="submit" disabled={creating}>{creating ? 'Saving…' : 'Create Auction'}</button>
            <button className="btn ghost sm" type="button" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    );
  }

  // Auction item card
  const AuctionItem = ({ item }) => {
    const highestBid = item.highest_bid || item.starting_price;
    const isCurrentBid = myBids.some((b) => b.auction_item_id === item.id);
    const myBidAmount = isCurrentBid
      ? myBids.find((b) => b.auction_item_id === item.id)?.amount || 0
      : 0;

    return (
      <div style={{
        border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 12,
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justify-content: 'space-between', alignItems: 'start', marginBottom: 8 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{item.title || item.section_name || 'Auction Lot'}</h4>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>Section: {item.section_name || '—'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>₹{fmt(highestBid)}</strong>
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
          Min increment: ₹{fmt(item.min_bid_increment)} · Status: {statusBadge(item.status)}
        </p>
        {item.current_price > 0 && (
          <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: '#059669' }}>
            Current: ₹{fmt(item.current_price)}
          </p>
        )}
        {/* Bid form */}
        {user?.isSuperAdmin || hasPermission('masters.manage') ? (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Place Bid</label>
            <input
              type="number"
              min={Number(item.min_bid_increment)}
              value={biddingAmount}
              onChange={(e) => setBiddingAmount(e.target.value)}
              placeholder="Your bid amount"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}
            />
            <button
              className="btn primary"
              onClick={() => setBidding(true)}
              style={{ marginTop: 6, width: '100%', padding: '8px 12px', fontSize: 12 }}
            >
              {bidding ? 'Submitting…' : 'Place Bid'}
            </button>
          </div>
        ) : null}
        {/* My bid indicator */}
        {myBids.length > 0 && myBids.some((b) => b.auction_item_id === item.id) && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#059669' }}>
            ← Your bid: ₹{fmt(myBidAmount)}
          </div>
        )}
      </div>
    );
  };

  // Auctions list
  return (
    <div className="page">
      <h1 className="page-title">Auctions</h1>
      <p className="page-sub">{auctions.length} active auction{s: auctions.length !== 1}</p>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="row" style={{ gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {sectionId ? (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>Section: {sectionId ? 'All' : 'None'}</p>
            <button className="btn ghost sm" style={{ marginTop: 4 }} onClick={() => setSectionId('')}>Clear filter</button>
          </div>
        ) : (
          <select
            style={{ minWidth: 180, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">All Sections</option>
            <option value="men">Men's Collection</option>
            <option value="women">Women's Collection</option>
            <option value="kids">Kids Collection</option>
            <option value="home">Home & Furnishing</option>
          </select>
        )}
      </div>

      {auctions.length === 0 && sectionId && (
        <p style={{ margin: '16px 0', fontSize: 12, color: '#6b7280' }}>No auctions for this section yet. <button className="btn ghost sm">Create First Auction</button>
      )}

      {auctions.map((a) => (
        <AuctionItem key={a.id} item={a} />
      ))}

      {/* Bid modal */}
      {bidding && biddingItem && (
        <Modal title="Place Bid — {biddingItem.title || 'Auction'}">
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Current highest: ₹{fmt(biddingItem.current_price || biddingItem.starting_price)}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Min bid: ₹{fmt(biddingItem.min_bid_increment)}
          </p>
          <form onSubmit={handleBid}>
            <input
              type="number"
              min={Number(biddingItem.min_bid_increment)}
              value={biddingAmount}
              onChange={(e) => setBiddingAmount(e.target.value)}
              placeholder="Enter bid amount"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
            />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button className="btn ghost" type="button" onClick={() => { setBidding(false); setBiddingItem(null); }}>Cancel</button>
              <button className="btn primary" type="submit">Place Bid</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}