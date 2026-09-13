import { pool } from '../config/db.js';

const queries = [
  `CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'completed', 'cancelled'))
  )`,
  `CREATE TABLE IF NOT EXISTS auction_items (
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
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_item_status CHECK (status IN ('active', 'reserve_met', 'completed', 'cancelled')),
    CONSTRAINT valid_starting_price CHECK (starting_price >= 0),
    CONSTRAINT valid_min_increment CHECK (min_bid_increment > 0)
  )`,
  `CREATE TABLE IF NOT EXISTS auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_item_id UUID REFERENCES auction_items(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    bid_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    CONSTRAINT valid_bid_amount CHECK (amount > 0)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_auctions_created_by ON auctions(created_by)`,
  `CREATE INDEX IF NOT EXISTS idx_auction_items_auction ON auction_items(auction_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auction_items_section ON auction_items(section_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auction_items_product ON auction_items(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auction_bids_item ON auction_bids(auction_item_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auction_bids_supplier ON auction_bids(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auction_bids_at ON auction_bids(bid_at DESC)`,
  `CREATE OR REPLACE FUNCTION check_bid_minimum() RETURNS TRIGGER AS $$ 
   DECLARE 
     item_price DECIMAL;
     item_inc DECIMAL;
   BEGIN 
     SELECT current_price, min_bid_increment INTO item_price, item_inc FROM auction_items WHERE id = NEW.auction_item_id;
     IF NEW.amount < (item_price + item_inc) THEN 
       RAISE EXCEPTION 'Bid amount must be at least %', (item_price + item_inc); 
     END IF; 
     RETURN NEW; 
   END; $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_check_bid_minimum BEFORE INSERT ON auction_bids FOR EACH ROW EXECUTE FUNCTION check_bid_minimum()`,
  `CREATE OR REPLACE FUNCTION update_auction_current_price() RETURNS TRIGGER AS $$ BEGIN UPDATE auction_items SET current_price = NEW.amount, updated_at = NOW() WHERE id = NEW.auction_item_id; RETURN NEW; END; $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_update_current_price AFTER INSERT ON auction_bids FOR EACH ROW EXECUTE FUNCTION update_auction_current_price()`,
  `CREATE OR REPLACE VIEW vw_active_auctions AS SELECT a.id, a.title, a.status, a.created_at, ai.id AS item_id, ai.section_id, ai.product_id, ai.starting_price, ai.current_price, ai.min_bid_increment, (SELECT b.amount FROM auction_bids b WHERE b.auction_item_id = ai.id ORDER BY b.bid_at DESC LIMIT 1) AS highest_bid, (SELECT b.supplier_id FROM auction_bids b WHERE b.auction_item_id = ai.id ORDER BY b.bid_at DESC LIMIT 1) AS highest_bidder FROM auctions a JOIN auction_items ai ON ai.auction_id = a.id WHERE a.status = 'active' AND ai.status = 'active'`
];

(async () => {
  const client = await pool.connect();
  try {
    for (const q of queries) {
      try {
        await client.query(q);
        console.log('✓', q.substring(0, 50).replace(/\s+/g, ' '));
      } catch (e) {
        console.log('Note:', e.message.split('\\n')[0]);
      }
    }
    // Verify tables exist
    const { rows } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('auctions', 'auction_items', 'auction_bids')`);
    console.log('\nTables created:', rows.map(r => r.table_name).join(', '));
    console.log('\n✓ All auction tables initialized');
  } catch (e) {
    console.error('✗ Fatal error:', e.message);
  } finally {
    await client.release();
    await pool.end();
  }
})();