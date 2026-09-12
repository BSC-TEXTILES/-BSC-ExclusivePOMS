-- Auction Tables Creation Script
-- §21.1 — Supplier Bidding System

-- 1. Auctions table — auction headers
CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'completed', 'cancelled'))
);

-- Comment: Auction headers track the overall auction event
COMMENT ON TABLE auctions IS 'Supplier bidding events — one-to-many with auction_items';

-- 2. Auction_items table — products/sections up for bid
CREATE TABLE IF NOT EXISTS auction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  starting_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_price DECIMAL(12,2) DEFAULT 0,
  min_bid_increment DECIMAL(12,2) NOT NULL DEFAULT 50,
  max_bid_amount DECIMAL(12,2),
  bid_deadline TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  CONSTRAINT valid_item_status CHECK (status IN ('active', 'reserve_met', 'completed', 'cancelled')),
  CONSTRAINT valid_starting_price CHECK (starting_price >= 0),
  CONSTRAINT valid_min_increment CHECK (min_bid_increment > 0)
);

-- Comment: Individual auction lots linked to a section or product
COMMENT ON TABLE auction_items IS 'Auction lots — many per auction, linked to sections or products';

-- 3. Auction_bids table — individual supplier bids
CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_item_id UUID REFERENCES auction_items(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  bid_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  CONSTRAINT valid_bid_amount CHECK (amount > 0),
  CONSTRAINT valid_bid_minimum CHECK (amount >= (SELECT current_price FROM auction_items WHERE id = auction_item_id) + (SELECT min_bid_increment FROM auction_items WHERE id = auction_item_id))
);

-- Comment: Supplier bids on auction lots — timestamps for order history
COMMENT ON TABLE auction_bids IS 'Supplier bids on auction lots — one bid per supplier per lot at a time';

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_created_by ON auctions(created_by);
CREATE INDEX IF NOT EXISTS idx_auction_items_auction ON auction_items(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_items_section ON auction_items(section_id);
CREATE INDEX IF NOT EXISTS idx_auction_items_product ON auction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_item ON auction_bids(auction_item_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_supplier ON auction_bids(supplier_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_at ON auction_bids(bid_at DESC);

-- 5. Trigger to update current_price on new bid
CREATE OR REPLACE FUNCTION update_auction_current_price()
RETURNS TRIGGER AS \$$
BEGIN
  UPDATE auction_items
  SET current_price = NEW.amount,
      updated_at = NOW()
  WHERE id = NEW.auction_item_id;
  RETURN NEW;
END;
\$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_current_price
AFTER INSERT ON auction_bids
FOR EACH ROW EXECUTE FUNCTION update_auction_current_price();

-- 6. View: Current active auctions with highest bid
CREATE OR REPLACE VIEW vw_active_auctions AS
SELECT
  a.id,
  a.title,
  a.status,
  a.created_at,
  ai.id AS item_id,
  ai.section_id,
  ai.product_id,
  ai.starting_price,
  ai.current_price,
  ai.min_bid_increment,
  (
    SELECT b.amount
    FROM auction_bids b
    WHERE b.auction_item_id = ai.id
    ORDER BY b.bid_at DESC
    LIMIT 1
  ) AS highest_bid,
  (
    SELECT b.supplier_id
    FROM auction_bids b
    WHERE b.auction_item_id = ai.id
    ORDER BY b.bid_at DESC
    LIMIT 1
  ) AS highest_bidder
FROM auctions a
JOIN auction_items ai ON ai.auction_id = a.id
WHERE a.status = 'active'
AND ai.status = 'active';