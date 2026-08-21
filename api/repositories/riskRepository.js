const { randomUUID, createHash } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');
const { ACCOUNT_RISK_STATE, RISK_LEVEL } = require('../utils/constants');

function stableHash(parts) {
  return createHash('sha256').update(parts.filter(Boolean).join(':')).digest('hex').slice(0, 32);
}

function mapEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventKey: row.event_key,
    eventType: row.event_type,
    domain: row.domain,
    userId: row.user_id,
    source: row.source,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    correlationId: row.correlation_id,
    metadata: parseJson(row.metadata_json, {}),
    occurredAt: row.occurred_at,
    createdAt: row.created_at
  };
}

function mapSignal(row) {
  if (!row) return null;
  return {
    id: row.id,
    signalKey: row.signal_key,
    riskEventId: row.risk_event_id,
    signalType: row.signal_type,
    domain: row.domain,
    severity: row.severity,
    source: row.source,
    userId: row.user_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    correlationId: row.correlation_id,
    reason: row.reason,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

function mapDecision(row) {
  if (!row) return null;
  return {
    id: row.id,
    decisionKey: row.decision_key,
    riskEventId: row.risk_event_id,
    domain: row.domain,
    userId: row.user_id,
    decision: row.decision,
    riskLevel: row.risk_level,
    accountState: row.account_state,
    reasons: parseJson(row.reasons_json, []),
    signalIds: parseJson(row.signal_ids_json, []),
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    correlationId: row.correlation_id,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

function mapAccountState(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    state: row.state,
    riskLevel: row.risk_level,
    lastDecisionId: row.last_decision_id,
    lastSignalAt: row.last_signal_at,
    changedByActorId: row.changed_by_actor_id,
    changedReason: row.changed_reason,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRestriction(row) {
  if (!row) return null;
  return {
    id: row.id,
    restrictionKey: row.restriction_key,
    userId: row.user_id,
    capability: row.capability,
    status: row.status,
    reason: row.reason,
    riskDecisionId: row.risk_decision_id,
    caseId: row.case_id,
    createdByActorId: row.created_by_actor_id,
    expiresAt: row.expires_at,
    liftedAt: row.lifted_at,
    liftedByActorId: row.lifted_by_actor_id,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCase(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseNumber: row.case_number,
    case_number: row.case_number,
    userId: row.user_id,
    user_id: row.user_id,
    domain: row.domain,
    riskLevel: row.risk_level,
    risk_level: row.risk_level,
    status: row.status,
    title: row.title,
    summary: row.summary,
    assignedTo: row.assigned_to,
    assigned_to: row.assigned_to,
    openedByDecisionId: row.opened_by_decision_id,
    signalIds: parseJson(row.signal_ids_json, []),
    relatedResources: parseJson(row.related_resources_json, []),
    resolution: row.resolution,
    resolutionReason: row.resolution_reason,
    resolvedByActorId: row.resolved_by_actor_id,
    resolvedAt: row.resolved_at,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

async function createOrGetEvent(data, client = db) {
  const now = data.createdAt || new Date().toISOString();
  const eventKey = data.eventKey || `${data.eventType}:${data.correlationId || stableHash([data.userId, data.resourceType, data.resourceId])}`;
  await client.run(
    `
      INSERT INTO risk_events (
        id, event_key, event_type, domain, user_id, source, resource_type, resource_id,
        correlation_id, metadata_json, occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_key) DO NOTHING
    `,
    [
      data.id || randomUUID(),
      eventKey,
      data.eventType,
      data.domain,
      data.userId || null,
      data.source,
      data.resourceType || null,
      data.resourceId || null,
      data.correlationId || eventKey,
      serializeJson(data.metadata || {}),
      data.occurredAt || now,
      now
    ]
  );
  const row = await client.get('SELECT * FROM risk_events WHERE event_key = ?', [eventKey]);
  return mapEvent(row);
}

async function createOrGetSignal(data, client = db) {
  const now = data.createdAt || new Date().toISOString();
  const signalKey = data.signalKey || `${data.signalType}:${data.correlationId}:${data.resourceType || ''}:${data.resourceId || ''}`;
  await client.run(
    `
      INSERT INTO risk_signals (
        id, signal_key, risk_event_id, signal_type, domain, severity, source, user_id,
        resource_type, resource_id, correlation_id, reason, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(signal_key) DO NOTHING
    `,
    [
      data.id || randomUUID(),
      signalKey,
      data.riskEventId || null,
      data.signalType,
      data.domain,
      data.severity,
      data.source,
      data.userId || null,
      data.resourceType || null,
      data.resourceId || null,
      data.correlationId || signalKey,
      data.reason,
      serializeJson(data.metadata || {}),
      now
    ]
  );
  const row = await client.get('SELECT * FROM risk_signals WHERE signal_key = ?', [signalKey]);
  return mapSignal(row);
}

async function createOrGetDecision(data, client = db) {
  const now = data.createdAt || new Date().toISOString();
  const decisionKey = data.decisionKey || `${data.eventKey || data.riskEventId || data.correlationId}:decision`;
  await client.run(
    `
      INSERT INTO risk_decisions (
        id, decision_key, risk_event_id, domain, user_id, decision, risk_level, account_state,
        reasons_json, signal_ids_json, resource_type, resource_id, correlation_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(decision_key) DO NOTHING
    `,
    [
      data.id || randomUUID(),
      decisionKey,
      data.riskEventId || null,
      data.domain,
      data.userId || null,
      data.decision,
      data.riskLevel,
      data.accountState || null,
      serializeJson(data.reasons || []),
      serializeJson(data.signalIds || []),
      data.resourceType || null,
      data.resourceId || null,
      data.correlationId || decisionKey,
      serializeJson(data.metadata || {}),
      now
    ]
  );
  const row = await client.get('SELECT * FROM risk_decisions WHERE decision_key = ?', [decisionKey]);
  return mapDecision(row);
}

async function getAccountState(userId, client = db) {
  const row = await client.get('SELECT * FROM account_risk_states WHERE user_id = ?', [userId]);
  return mapAccountState(row);
}

async function upsertAccountState(data, client = db) {
  const now = new Date().toISOString();
  await client.run(
    `
      INSERT INTO account_risk_states (
        user_id, state, risk_level, last_decision_id, last_signal_at, changed_by_actor_id,
        changed_reason, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        state = excluded.state,
        risk_level = excluded.risk_level,
        last_decision_id = excluded.last_decision_id,
        last_signal_at = excluded.last_signal_at,
        changed_by_actor_id = excluded.changed_by_actor_id,
        changed_reason = excluded.changed_reason,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `,
    [
      data.userId,
      data.state || ACCOUNT_RISK_STATE.NORMAL,
      data.riskLevel || RISK_LEVEL.LOW,
      data.lastDecisionId || null,
      data.lastSignalAt || null,
      data.changedByActorId || null,
      data.changedReason || null,
      serializeJson(data.metadata || {}),
      now,
      now
    ]
  );
  return getAccountState(data.userId, client);
}

async function createOrGetRestriction(data, client = db) {
  const now = new Date().toISOString();
  const restrictionKey = data.restrictionKey || `${data.userId}:${data.capability}:${data.reasonCode || data.riskDecisionId || 'manual'}`;
  await client.run(
    `
      INSERT INTO account_restrictions (
        id, restriction_key, user_id, capability, status, reason, risk_decision_id, case_id,
        created_by_actor_id, expires_at, lifted_at, lifted_by_actor_id, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
      ON CONFLICT(restriction_key) DO UPDATE SET
        status = 'ACTIVE',
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `,
    [
      data.id || randomUUID(),
      restrictionKey,
      data.userId,
      data.capability,
      data.reason,
      data.riskDecisionId || null,
      data.caseId || null,
      data.createdByActorId || 'risk-engine',
      data.expiresAt || null,
      serializeJson(data.metadata || {}),
      now,
      now
    ]
  );
  const row = await client.get('SELECT * FROM account_restrictions WHERE restriction_key = ?', [restrictionKey]);
  return mapRestriction(row);
}

async function listActiveRestrictions(userId, client = db) {
  const now = new Date().toISOString();
  const rows = await client.all(
    `
      SELECT * FROM account_restrictions
      WHERE user_id = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC
    `,
    [userId, now]
  );
  return rows.map(mapRestriction);
}

async function createOrGetCase(data, client = db) {
  const now = new Date().toISOString();
  const caseNumber = data.caseNumber || `RC-${stableHash([data.userId, data.domain, data.correlationId]).slice(0, 8).toUpperCase()}`;
  await client.run(
    `
      INSERT INTO risk_cases (
        id, case_number, user_id, domain, risk_level, status, title, summary, assigned_to,
        opened_by_decision_id, signal_ids_json, related_resources_json, resolution, resolution_reason,
        resolved_by_actor_id, resolved_at, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)
      ON CONFLICT(case_number) DO UPDATE SET
        risk_level = excluded.risk_level,
        status = CASE WHEN risk_cases.status IN ('RESOLVED', 'FALSE_POSITIVE') THEN risk_cases.status ELSE risk_cases.status END,
        signal_ids_json = excluded.signal_ids_json,
        related_resources_json = excluded.related_resources_json,
        updated_at = excluded.updated_at
    `,
    [
      data.id || randomUUID(),
      caseNumber,
      data.userId || null,
      data.domain,
      data.riskLevel,
      data.status || 'OPEN',
      data.title,
      data.summary,
      data.assignedTo || null,
      data.openedByDecisionId || null,
      serializeJson(data.signalIds || []),
      serializeJson(data.relatedResources || []),
      serializeJson(data.metadata || {}),
      now,
      now
    ]
  );
  const row = await client.get('SELECT * FROM risk_cases WHERE case_number = ?', [caseNumber]);
  return mapCase(row);
}

async function listCases(filters = {}, client = db) {
  const where = [];
  const params = [];
  if (filters.status) { where.push('status = ?'); params.push(filters.status); }
  if (filters.userId) { where.push('user_id = ?'); params.push(filters.userId); }
  if (filters.domain) { where.push('domain = ?'); params.push(filters.domain); }
  if (filters.riskLevel) { where.push('risk_level = ?'); params.push(filters.riskLevel); }
  const limit = Math.min(Number(filters.limit || 100), 250);
  const rows = await client.all(
    `SELECT * FROM risk_cases ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
  return rows.map(mapCase);
}

async function findCaseById(caseId, client = db) {
  const row = await client.get('SELECT * FROM risk_cases WHERE id = ? OR case_number = ?', [caseId, caseId]);
  return mapCase(row);
}

async function updateCase(caseId, updates, client = db) {
  const existing = await findCaseById(caseId, client);
  if (!existing) return null;
  await client.run(
    `
      UPDATE risk_cases
      SET status = ?, assigned_to = ?, resolution = ?, resolution_reason = ?, resolved_by_actor_id = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      updates.status || existing.status,
      updates.assignedTo === undefined ? existing.assignedTo : updates.assignedTo,
      updates.resolution === undefined ? existing.resolution : updates.resolution,
      updates.resolutionReason === undefined ? existing.resolutionReason : updates.resolutionReason,
      updates.resolvedByActorId === undefined ? existing.resolvedByActorId : updates.resolvedByActorId,
      updates.resolvedAt === undefined ? existing.resolvedAt : updates.resolvedAt,
      new Date().toISOString(),
      existing.id
    ]
  );
  return findCaseById(existing.id, client);
}

async function addCaseNote(data, client = db) {
  const id = data.id || randomUUID();
  const now = new Date().toISOString();
  await client.run(
    'INSERT INTO risk_case_notes (id, case_id, actor_id, note, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, data.caseId, data.actorId, data.note, serializeJson(data.metadata || {}), now]
  );
  return { id, caseId: data.caseId, actorId: data.actorId, note: data.note, metadata: data.metadata || {}, createdAt: now };
}

async function listSignals(filters = {}, client = db) {
  const where = [];
  const params = [];
  if (filters.userId) { where.push('user_id = ?'); params.push(filters.userId); }
  if (filters.severity) { where.push('severity = ?'); params.push(filters.severity); }
  if (filters.domain) { where.push('domain = ?'); params.push(filters.domain); }
  const limit = Math.min(Number(filters.limit || 100), 250);
  const rows = await client.all(
    `SELECT * FROM risk_signals ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
  return rows.map(mapSignal);
}

async function getOverview(client = db) {
  const now = new Date().toISOString();
  const [cases, critical, restrictions, highUsers, manualReviews, falsePositives] = await Promise.all([
    client.get("SELECT COUNT(*) AS count FROM risk_cases WHERE status IN ('OPEN', 'INVESTIGATING', 'WAITING_FOR_INFORMATION', 'ESCALATED')"),
    client.get("SELECT COUNT(*) AS count FROM risk_signals WHERE severity = 'CRITICAL'"),
    client.get("SELECT COUNT(*) AS count FROM account_restrictions WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > ?)", [now]),
    client.get("SELECT COUNT(*) AS count FROM account_risk_states WHERE risk_level IN ('HIGH', 'CRITICAL')"),
    client.get("SELECT COUNT(*) AS count FROM risk_decisions WHERE decision IN ('REQUIRE_REVIEW', 'REQUIRE_VERIFICATION')"),
    client.get("SELECT COUNT(*) AS count FROM risk_cases WHERE status = 'FALSE_POSITIVE'")
  ]);
  return {
    open_cases: Number(cases?.count || 0),
    critical_alerts: Number(critical?.count || 0),
    active_restrictions: Number(restrictions?.count || 0),
    high_risk_users: Number(highUsers?.count || 0),
    manual_reviews: Number(manualReviews?.count || 0),
    false_positives: Number(falsePositives?.count || 0)
  };
}

async function cleanupExpiredRiskData({ signalRetentionDays, caseRetentionDays }, client = db) {
  const now = Date.now();
  const signalCutoff = new Date(now - Number(signalRetentionDays) * 24 * 60 * 60 * 1000).toISOString();
  const caseCutoff = new Date(now - Number(caseRetentionDays) * 24 * 60 * 60 * 1000).toISOString();

  const signalResult = await client.run(
    `
      DELETE FROM risk_signals
      WHERE created_at < ?
        AND id NOT IN (
          SELECT value
          FROM risk_cases, json_each(COALESCE(signal_ids_json, '[]'))
          WHERE status NOT IN ('RESOLVED', 'FALSE_POSITIVE')
        )
    `,
    [signalCutoff]
  );

  const decisionResult = await client.run(
    `
      DELETE FROM risk_decisions
      WHERE created_at < ?
        AND id NOT IN (SELECT COALESCE(last_decision_id, '') FROM account_risk_states)
        AND id NOT IN (SELECT COALESCE(opened_by_decision_id, '') FROM risk_cases)
    `,
    [signalCutoff]
  );

  const eventResult = await client.run(
    `
      DELETE FROM risk_events
      WHERE created_at < ?
        AND id NOT IN (SELECT COALESCE(risk_event_id, '') FROM risk_signals)
        AND id NOT IN (SELECT COALESCE(risk_event_id, '') FROM risk_decisions)
    `,
    [signalCutoff]
  );

  const caseResult = await client.run(
    `
      DELETE FROM risk_cases
      WHERE status IN ('RESOLVED', 'FALSE_POSITIVE')
        AND COALESCE(resolved_at, updated_at, created_at) < ?
    `,
    [caseCutoff]
  );

  return {
    signal_cutoff: signalCutoff,
    case_cutoff: caseCutoff,
    deleted_signals: Number(signalResult.changes || 0),
    deleted_decisions: Number(decisionResult.changes || 0),
    deleted_events: Number(eventResult.changes || 0),
    deleted_cases: Number(caseResult.changes || 0)
  };
}

module.exports = {
  riskRepository: {
    cleanupExpiredRiskData,
    createOrGetCase,
    createOrGetDecision,
    createOrGetEvent,
    createOrGetRestriction,
    createOrGetSignal,
    addCaseNote,
    findCaseById,
    getAccountState,
    getOverview,
    listActiveRestrictions,
    listCases,
    listSignals,
    mapCase,
    updateCase,
    upsertAccountState
  }
};