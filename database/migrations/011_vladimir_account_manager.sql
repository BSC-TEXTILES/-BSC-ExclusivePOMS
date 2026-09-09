-- Migration 011: Vladimir — Account & Category Manager
-- New "account_manager" role: creates user accounts and manages category
-- sections / master data. Role assignment and RBAC stay Administrator-only
-- (enforced in backend/src/routes/users.js and roles.js).

-- 1. Role (re-runnable: refresh name/description if it already exists)
INSERT INTO roles (code, name, description)
VALUES ('account_manager', 'Account & Category Manager',
        'Creates user accounts and manages category sections. Roles and access scope are decided by the Administrator.')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Role permissions: users.manage (create accounts) + masters (category sections)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.code = 'account_manager'
   AND p.code IN ('users.manage', 'masters.view', 'masters.manage')
ON CONFLICT DO NOTHING;

-- 3. Vladimir's login (initial password Vladimir@123 — reset it from
--    Users & Roles as needed; there is no self-service reset in the UI)
INSERT INTO users (email, username, password_hash, full_name, status, force_password_reset)
VALUES ('vladimir@bsc.local', 'vladimir',
        '$2a$10$0mdtUMxM3J2Ae8CpjtbKpu0dOd32FsPjFD9ql2DeFeVMsOcxdgcCe',
        'Vladimir', 'active', false)
ON CONFLICT (email) DO UPDATE
   SET password_hash = EXCLUDED.password_hash,
       username      = EXCLUDED.username,
       full_name     = EXCLUDED.full_name,
       status        = 'active',
       force_password_reset = true;

-- 4. Attach the role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM users u, roles r
 WHERE u.email = 'vladimir@bsc.local' AND r.code = 'account_manager'
ON CONFLICT DO NOTHING;
