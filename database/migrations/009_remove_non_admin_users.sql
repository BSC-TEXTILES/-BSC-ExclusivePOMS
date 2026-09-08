-- Migration 009: Remove all non-admin users
-- Keeps only the super_admin user (admin@bsc.local)

-- Step 1: Clear child tables first (order matters due to FK chains)
DELETE FROM receipts WHERE po_id IN (SELECT id FROM purchase_orders WHERE created_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local'));
DELETE FROM approval_actions WHERE approver_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM approval_instances WHERE created_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM approval_levels WHERE approver_user_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM attachments WHERE uploaded_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM chat_messages WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM comments WHERE author_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM export_jobs WHERE requested_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM import_jobs WHERE requested_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM inventory_transactions WHERE created_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM product_images WHERE uploaded_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM videos WHERE uploaded_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');

-- Step 2: Delete purchase orders (after receipts are cleared)
DELETE FROM purchase_orders WHERE created_by IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');

-- Step 3: Clear junction tables
DELETE FROM user_collections WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM user_sections WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM user_divisions WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email <> 'admin@bsc.local');

-- Step 4: Delete the non-admin users
DELETE FROM users WHERE email <> 'admin@bsc.local';

-- Note: audit_logs are append-only (protected by trigger) and cannot be deleted.
-- Non-admin audit entries will remain as historical records.
