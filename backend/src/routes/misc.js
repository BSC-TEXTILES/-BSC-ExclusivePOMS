import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';
const r = Router();

// Admin-only: Initialize auction tables (run once)
r.post('/auction/init-tables', requirePermission('settings.manage'), ah(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auctions table
    await client.query(`
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
      )
    `);

    // Auction_items table
    await client.query(`
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
      )
    `);

    // Auction_bids table
    await client.query(`
      CREATE TABLE IF NOT EXISTS auction_bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auction_item_id UUID REFERENCES auction_items(id) ON DELETE CASCADE,
        supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        amount DECIMAL(12,2) NOT NULL,
        bid_at TIMESTAMP DEFAULT NOW(),
        notes TEXT,
        CONSTRAINT valid_bid_amount CHECK (amount > 0),
        CONSTRAINT valid_bid_minimum CHECK (amount >= (SELECT current_price FROM auction_items WHERE id = auction_item_id) + (SELECT min_bid_increment FROM auction_items WHERE id = auction_item_id))
      )
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auctions_created_by ON auctions(created_by)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auction_items_auction ON auction_items(auction_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auction_items_section ON auction_items(section_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auction_items_product ON auction_items(product_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auction_bids_item ON auction_bids(auction_item_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auction_bids_supplier ON auction_bids(supplier_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auction_bids_at ON auction_bids(bid_at DESC)');

    // Trigger to update current_price
    await client.query(`
      CREATE OR REPLACE FUNCTION update_auction_current_price()
      RETURNS TRIGGER AS \$\$ BEGIN UPDATE auction_items SET current_price = NEW.amount, updated_at = NOW() WHERE id = NEW.auction_item_id; RETURN NEW; END; \$\$ LANGUAGE plpgsql
    `);

    await client.query('CREATE TRIGGER trg_update_current_price AFTER INSERT ON auction_bids FOR EACH ROW EXECUTE FUNCTION update_auction_current_price()');

    // View: active auctions with highest bid
    await client.query(`
      CREATE OR REPLACE VIEW vw_active_auctions AS
      SELECT a.id, a.title, a.status, a.created_at, ai.id AS item_id, ai.section_id, ai.product_id,
             ai.starting_price, ai.current_price, ai.min_bid_increment,
             (SELECT b.amount FROM auction_bids b WHERE b.auction_item_id = ai.id ORDER BY b.bid_at DESC LIMIT 1) AS highest_bid,
             (SELECT b.supplier_id FROM auction_bids b WHERE b.auction_item_id = ai.id ORDER BY b.bid_at DESC LIMIT 1) AS highest_bidder
      FROM auctions a JOIN auction_items ai ON ai.auction_id = a.id
      WHERE a.status = 'active' AND ai.status = 'active')
    `);

    await client.query('COMMIT');
    await logAudit(pool, {
      userId: req.user.id, role: req.user.roles.join(','), actionType: 'create',
      entityType: 'auction_system', entityId: 'all', afterValue: { status: 'initialized' }
    });
    res.json({ ok: true, message: 'Auction tables initialized successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await client.release();
  }
}));

// ---------- AUDIT (§17.1, AU-01) — immutable, filterable ----------
r.get('/audit-logs', requirePermission('audit.view'), ah(async (req, res) => {
  const { userId, entityType, entityId, actionType, from, to, page = 1, pageSize = 50 } = req.query;
  const clauses = []; const params = [];
  if (!req.user.isSuperAdmin && req.user.permissions.includes('audit.view')) {
    params.push(req.user.divisionIds);
    clauses.push(`(al.division_id = ANY($${params.length}::uuid[]) OR al.division_id IS NULL)`);
  }
  if (userId) { params.push(userId); clauses.push(`al.user_id = $${params.length}`); }
  if (entityType) { params.push(entityType); clauses.push(`al.entity_type = $${params.length}`); }
  if (entityId) { params.push(entityId); clauses.push(`al.entity_id = $${params.length}`); }
  if (actionType) { params.push(actionType); clauses.push(`al.action_type = $${params.length}`); }
  if (from) { params.push(from); clauses.push(`al.occurred_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`al.occurred_at <= $${params.length}`); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const limit = Math.min(Number(pageSize) || 50, 200);
  const offset = (Math.max(Number(page), 1) - 1) * limit;
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT al.*, u.full_name AS user_name, d.code AS division_code
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN divisions d ON d.id = al.division_id
       ${where} ORDER BY al.occurred_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ data: rows, page: Number(page), pageSize: limit });
}));

// ---------- NOTIFICATIONS (§18) ----------
r.get('/notifications', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 50`, [req.user.id]);
  const { rows: [{ unread }] } = await query(
    `SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = false`, [req.user.id]);
  res.json({ data: rows, unread });
}));

r.post('/notifications/read-all', ah(async (req, res) => {
  await query(`UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND is_read = false`, [req.user.id]);
  res.json({ ok: true });
}));

r.post('/notifications/:id/read', ah(async (req, res) => {
  await query(`UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- SETTINGS (super-admin managed; read for all authenticated) ----------
r.get('/settings', ah(async (req, res) => {
  const { rows } = await query(`SELECT key, value, description FROM settings ORDER BY key`);
  res.json({ data: rows });
}));

r.put('/settings/:key', requirePermission('settings.manage'), ah(async (req, res) => {
  const { value, description } = req.body || {};
  if (value === undefined) throw badRequest('value is required');
  const { rows } = await query(
    `INSERT INTO settings (key, value, description, updated_by)
     VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = COALESCE(EXCLUDED.description, settings.description), updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING *`,
    [req.params.key, JSON.stringify(value), description || null, req.user.id]);
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'edit',
    entityType: 'setting', entityId: req.params.key, afterValue: { value },
  });
  res.json({ data: rows[0] });
}));

export default r;
