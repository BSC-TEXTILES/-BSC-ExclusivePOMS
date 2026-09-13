import { Router } from 'express';
import { query, pool } from '../config/db.js';
import { authenticate, loadUser } from '../middleware/auth.js';
import { ah } from '../utils/httpError.js';
import { logAudit } from '../utils/audit.js';

const r = Router();

// GET /api/auth/me — role + division scope resolution for the client
// Called by the frontend after Clerk sign-in to fetch RBAC data
r.get('/me', authenticate, ah(async (req, res) => {
  res.json({ user: req.user });
}));

// POST /api/auth/logout — audit trail
r.post('/logout', authenticate, ah(async (req, res) => {
  await logAudit(pool, {
    userId: req.user.id, role: req.user.roles.join(','), actionType: 'logout',
    entityType: 'user', entityId: req.user.id,
  });
  res.status(204).end();
}));

// POST /api/auth/sync — sync Clerk user to existing DB user
// Called on first sign-in when a Clerk user matches an existing DB user by email
r.post('/sync', authenticate, ah(async (req, res) => {
  const { clerkUserId, user } = req;
  if (!user.clerkId && clerkUserId) {
    await query('UPDATE users SET clerk_id = $1 WHERE id = $2', [clerkUserId, user.id]);
  }
  res.json({ ok: true, user: req.user });
}));

export default r;
