// Immutable audit stream writer — FRS §17.1, RB-015.
// audit_logs is append-only (UPDATE/DELETE blocked by DB trigger in schema.sql).

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
  await client.query(
    `INSERT INTO audit_logs
       (user_id, user_role, division_id, section_id, action_type, entity_type, entity_id,
        before_value, after_value, reason, request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [userId, role, divisionId, sectionId, actionType, entityType, entityId,
     beforeValue ? JSON.stringify(beforeValue) : null,
     afterValue ? JSON.stringify(afterValue) : null,
     reason, requestId]
  );
}
