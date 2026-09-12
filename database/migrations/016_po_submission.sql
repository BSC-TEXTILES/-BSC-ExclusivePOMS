-- ============================================================
-- Migration 016: PO submission — QR codes + duplicate protection
-- ============================================================
-- qr_code stores the SVG QR image for the purchase order (same pattern as
-- brands.qr_code). It is generated AFTER the PO row is saved and encodes a
-- deep link to /purchase-orders/<po_number>.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS qr_code text;

-- Idempotency key: a UUID the client generates once per submission attempt.
-- Backend rejects/absorbs repeat requests carrying the same key so a double
-- click can never create two purchase orders. NULL for rows created before
-- this migration / without a key (Postgres permits multiple NULLs).
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS idempotency_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_po_idempotency_key
  ON purchase_orders (idempotency_key) WHERE idempotency_key IS NOT NULL;