-- Clear all brands from POMS database
BEGIN;

DELETE FROM brand_collections;
DELETE FROM supplier_brands;
DELETE FROM purchase_order_taxes;
DELETE FROM inventory_transactions;
DELETE FROM receipt_items;
DELETE FROM purchase_order_quantities;
DELETE FROM purchase_order_items;
DELETE FROM products;
DELETE FROM brands;

COMMIT;

SELECT count(*) AS remaining_brands FROM brands;
