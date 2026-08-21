const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-risk-engine-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'risk-engine-client';
process.env.PAYPAL_CLIENT_SECRET = 'risk-engine-secret';
process.env.PAYPAL_WEBHOOK_ID = 'risk-engine-webhook';
process.env.RISK_ENGINE_ENABLED = 'true';
process.env.MAX_FUNDING_ATTEMPTS_PER_HOUR = '2';
process.env.LARGE_FUNDING_THRESHOLD = '100000';
process.env.MAX_SERVICE_ACTIONS_PER_MINUTE = '2';
process.env.LARGE_ADMIN_ADJUSTMENT_THRESHOLD = '100';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { profileRepository } = require('../repositories/profileRepository');
const { userRepository } = require('../repositories/userRepository');
const { riskEngineService } = require('../services/riskEngineService');
const { RISK_DOMAIN } = require('../utils/constants');

async function createUser(userId) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@risk.example.com`,
    displayName: userId,
    countryCode: 'NG'
  });
  await profileRepository.upsert({ userId, name: userId, points: 0, role: 'USER' });
}

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('funding velocity produces idempotent monitoring decision without balance mutation', async () => {
  await createUser('risk-funding-user');
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO points_funding_requests (id, public_reference, user_id, package_id, requested_points, expected_amount_minor, currency, payment_method, payment_destination_id, payment_reference, destination_snapshot_json, status, risk_status, possible_duplicate, metadata_json, created_at, updated_at) VALUES ('rf-1', 'RF-1', 'risk-funding-user', 'points_pkg_1000_ngn', 1000, 100000, 'NGN', 'MANUAL', 'manual_ngn_destination_default', 'RF-1', '{}', 'PAYMENT_INSTRUCTIONS', 'NORMAL', 0, '{}', ?, ?)",
    [now, now]
  );
  await db.run(
    "INSERT INTO points_funding_requests (id, public_reference, user_id, package_id, requested_points, expected_amount_minor, currency, payment_method, payment_destination_id, payment_reference, destination_snapshot_json, status, risk_status, possible_duplicate, metadata_json, created_at, updated_at) VALUES ('rf-2', 'RF-2', 'risk-funding-user', 'points_pkg_1000_ngn', 1000, 100000, 'NGN', 'MANUAL', 'manual_ngn_destination_default', 'RF-2', '{}', 'PAYMENT_INSTRUCTIONS', 'NORMAL', 0, '{}', ?, ?)",
    [now, now]
  );

  const first = await riskEngineService.evaluateEvent({
    eventType: 'FUNDING_CREATED',
    domain: RISK_DOMAIN.VELOCITY,
    userId: 'risk-funding-user',
    source: 'test',
    resourceType: 'points_funding_request',
    resourceId: 'rf-2',
    correlationId: 'risk-funding-velocity'
  });
  const second = await riskEngineService.evaluateEvent({
    eventType: 'FUNDING_CREATED',
    domain: RISK_DOMAIN.VELOCITY,
    userId: 'risk-funding-user',
    source: 'test',
    resourceType: 'points_funding_request',
    resourceId: 'rf-2',
    correlationId: 'risk-funding-velocity'
  });

  assert.equal(first.decision.decision, 'ALLOW_WITH_MONITORING');
  assert.equal(second.decision.id, first.decision.id);
  assert.ok(first.signals.some((signal) => signal.signalType === 'RAPID_FUNDING'));
  const ledger = await db.get('SELECT COUNT(*) AS count FROM points_transactions WHERE user_id = ?', ['risk-funding-user']);
  assert.equal(Number(ledger.count), 0);
});

test('critical financial anomaly creates escalated case', async () => {
  await createUser('risk-critical-user');
  const result = await riskEngineService.evaluateEvent({
    eventType: 'FINANCIAL_ANOMALY',
    domain: RISK_DOMAIN.PAYMENT,
    userId: 'risk-critical-user',
    source: 'test',
    resourceType: 'points_reconciliation_alert',
    resourceId: 'alert-1',
    correlationId: 'critical-alert-1',
    metadata: { criticalFinancialAnomaly: true, anomalyType: 'points_credited_without_payment' }
  });

  assert.equal(result.decision.riskLevel, 'CRITICAL');
  assert.equal(result.decision.decision, 'TEMPORARILY_RESTRICT');
  assert.equal(result.risk_case.status, 'ESCALATED');
});

test('admins can resolve and mark false positives with reasons', async () => {
  const cases = await riskEngineService.listCases({ userId: 'risk-critical-user' });
  assert.ok(cases.length >= 1);
  const resolved = await riskEngineService.updateCaseStatus({
    caseId: cases[0].id,
    status: 'FALSE_POSITIVE',
    reason: 'Verified legitimate business activity.',
    adminActorId: 'risk-admin'
  });

  assert.equal(resolved.status, 'FALSE_POSITIVE');
  assert.equal(resolved.resolutionReason, 'Verified legitimate business activity.');
});

test('risk retention cleanup prunes old risk telemetry without touching financial audit history', async () => {
  await createUser('risk-retention-user');
  const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  await db.run(
    "INSERT INTO audit_logs (id, actor_type, actor_id, action, entity_type, entity_id, metadata_json, created_at) VALUES ('audit-retention-1', 'SYSTEM', 'risk-test', 'financial.audit.must_stay', 'points_funding_request', 'retention-funding', '{}', ?)",
    [oldDate]
  );
  const evaluated = await riskEngineService.evaluateEvent({
    eventType: 'FINANCIAL_ANOMALY',
    domain: RISK_DOMAIN.PAYMENT,
    userId: 'risk-retention-user',
    source: 'test',
    resourceType: 'points_reconciliation_alert',
    resourceId: 'retention-alert',
    correlationId: 'retention-alert',
    metadata: { criticalFinancialAnomaly: true, anomalyType: 'retention-test' }
  });
  await db.run('UPDATE risk_events SET created_at = ?, occurred_at = ? WHERE id = ?', [oldDate, oldDate, evaluated.event.id]);
  await db.run('UPDATE risk_signals SET created_at = ? WHERE risk_event_id = ?', [oldDate, evaluated.event.id]);
  await db.run('UPDATE risk_decisions SET created_at = ? WHERE risk_event_id = ?', [oldDate, evaluated.event.id]);
  await db.run(
    "UPDATE risk_cases SET status = 'RESOLVED', resolved_at = ?, updated_at = ? WHERE id = ?",
    [oldDate, oldDate, evaluated.risk_case.id]
  );

  const cleanup = await riskEngineService.cleanupExpiredRiskData({ signalRetentionDays: 1, caseRetentionDays: 1 });
  assert.ok(cleanup.deleted_cases >= 1);
  assert.ok(cleanup.deleted_signals >= 1);

  const audit = await db.get('SELECT * FROM audit_logs WHERE id = ?', ['audit-retention-1']);
  assert.ok(audit, 'financial audit history must not be deleted by risk retention cleanup');
});