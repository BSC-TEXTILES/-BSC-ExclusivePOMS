import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { badRequest, notFoundError, forbidden, ah } from '../utils/httpError.js';

const r = Router();
r.use(authenticate, requirePermission('users.manage'));

// RBAC: defining roles and their permissions is the Administrator's decision.
const requireSuperAdmin = (req, res, next) => {
  if (req.user.isSuperAdmin) return next();
  next(forbidden('Only the Administrator can manage roles and permissions'));
};

// List all roles with permission count
r.get('/', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, (SELECT count(*)::int FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
     FROM roles r ORDER BY r.code`);
  res.json({ data: rows });
}));

// List all available permissions (MUST be before /:id to avoid shadowing)
r.get('/meta/permissions', ah(async (req, res) => {
  const { rows } = await query(`SELECT * FROM permissions ORDER BY module, code`);
  res.json({ data: rows });
}));

// Get single role with permissions
r.get('/:id', ah(async (req, res) => {
  const { rows: roles } = await query(`SELECT * FROM roles WHERE id=$1`, [req.params.id]);
  if (!roles.length) throw notFoundError('Role');
  const { rows: perms } = await query(
    `SELECT p.* FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id=$1 ORDER BY p.code`, [req.params.id]);
  res.json({ data: { ...roles[0], permissions: perms } });
}));

// Create role (Administrator only)
r.post('/', requireSuperAdmin, ah(async (req, res) => {
  const { code, name, description } = req.body || {};
  if (!code || !name) throw badRequest('code and name are required');
  const { rows } = await query(
    `INSERT INTO roles (code, name, description) VALUES ($1,$2,$3) RETURNING *`,
    [code, name, description || null]);
  res.status(201).json({ data: rows[0] });
}));

// Update role name/description (Administrator only)
r.patch('/:id', requireSuperAdmin, ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM roles WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Role');
  if (existing[0].code === 'super_admin') throw badRequest('Cannot modify Super Admin role');
  const { name, description } = req.body || {};
  const { rows } = await query(
    `UPDATE roles SET name=COALESCE($2,name), description=COALESCE($3,description) WHERE id=$1 RETURNING *`,
    [req.params.id, name, description]);
  res.json({ data: rows[0] });
}));

// Replace role permissions (full set, Administrator only)
r.put('/:id/permissions', requireSuperAdmin, ah(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM roles WHERE id=$1`, [req.params.id]);
  if (!existing.length) throw notFoundError('Role');
  if (existing[0].code === 'super_admin') throw badRequest('Cannot modify Super Admin permissions');
  const { permissionIds } = req.body || {};
  if (!Array.isArray(permissionIds)) throw badRequest('permissionIds must be an array');
  await query(`DELETE FROM role_permissions WHERE role_id=$1`, [req.params.id]);
  for (const pid of permissionIds) {
    await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, pid]);
  }
  const { rows: perms } = await query(
    `SELECT p.* FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id=$1 ORDER BY p.code`, [req.params.id]);
  res.json({ data: perms });
}));

export default r;
