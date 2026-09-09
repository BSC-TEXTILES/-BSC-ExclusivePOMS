// Immutable audit stream writer — FRS §17.1, RB-015.
// audit_logs is append-only (UPDATE/DELETE blocked by DB trigger in schema.sql).

import crypto from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Natural-key entities (e.g. settings keys) still need a uuid entity_id —
// derive a stable one so audit rows for the same key always line up.
function stableUuid(seed) {
  const h = crypto.createHash('md5').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-3${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function logAudit(client, opts) {
  const {
    userId = null,
    role = null,
    divisionId = null,
    sectionId = null,
    actionType,
    entityType,
    entityId,
    beforeValue = null,
    afterValue = null,
    reason = null,
    requestId = null,
  } = opts;
  const safeEntityId = typeof entityId === 'string' && UUID_RE.test(entityId)
    ? entityId
    : stableUuid(`${entityType}:${entityId}`);
  await client.query(
    `INSERT INTO audit_logs
       (user_id, user_role, division_id, section_id, action_type, entity_type, entity_id,
        before_value, after_value, reason, request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [userId, role, divisionId, sectionId, actionType, entityType, safeEntityId,
     beforeValue ? JSON.stringify(beforeValue) : null,
     afterValue ? JSON.stringify(afterValue) : null,
     reason, requestId]
  );
}
