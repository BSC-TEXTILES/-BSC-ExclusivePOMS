-- 013 — Performance indexes for the hottest scoped queries.
-- Safe to re-run (IF NOT EXISTS).

-- Audit stream: dashboard + audit page list the latest events first
-- (ORDER BY occurred_at DESC LIMIT n, scoped by division).
CREATE INDEX IF NOT EXISTS idx_audit_occurred ON audit_logs (occurred_at DESC);

-- Receiving: the pending-quantities view aggregates accepted/rejected/damaged
-- per PO line item.
CREATE INDEX IF NOT EXISTS idx_receipt_items_po_item ON receipt_items (po_item_id);

-- Purchase order items: joined by po_id on every detail/pending/receipt query.
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items (po_id);

-- Purchase orders: dashboard recent-orders + list default sort.
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders (created_at DESC);
