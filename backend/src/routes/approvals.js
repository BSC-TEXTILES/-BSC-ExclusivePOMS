import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { ah } from '../utils/httpError.js';

// Approval queue — FRS §14, §16 (pending approval queue), AP-01.
const r = Router();
r.use(authenticate, requirePermission('approvals.view'));

// GET /api/approvals/queue — open instances visible to me (my current-level role/user, or all for Super Admin)
r.get('/queue', ah(async (req, res) => {
  const params = [];
  let scope = '';
  if (!req.user.isSuperAdmin) {
    params.push(req.user.roles);
    params.push(req.user.id);
    scope = `AND (ro.code = ANY($1)
               OR l.approver_user_id::text = $2)`;
  }
  const { rows } = await query(
    `SELECT DISTINCT ai.id AS instance_id, ai.current_level, ai.created_at AS submitted_at,
            po.id AS po_id, po.po_number, po.po_date, po.status, po.grand_total, po.version,
            d.name AS division_name, s.name AS section_name, sup.company_name AS supplier_name,
            u.full_name AS created_by_name,
            ro.code AS approver_role_code, l.auto_escalate_after_hours
       FROM approval_instances ai
       JOIN purchase_orders po ON po.id = ai.po_id
       JOIN divisions d ON d.id = po.division_id
       JOIN sections s ON s.id = po.section_id
       JOIN suppliers sup ON sup.id = po.supplier_id
       JOIN users u ON u.id = po.created_by
       LEFT JOIN approval_levels l ON l.rule_id = ai.rule_id AND l.level_no = ai.current_level
       LEFT JOIN roles ro ON ro.id = l.approver_role_id
      WHERE ai.resolved_at IS NULL AND po.status IN ('submitted','under_review')
        ${scope}
      ORDER BY ai.created_at ASC`, params);
  res.json({ data: rows });
}));

export default r;
