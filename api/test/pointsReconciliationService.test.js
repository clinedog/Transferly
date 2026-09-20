const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-points-reconciliation-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(temporaryRoot, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'points-reconciliation-client';
process.env.PAYPAL_CLIENT_SECRET = 'points-reconciliation-secret';
process.env.PAYPAL_WEBHOOK_ID = 'points-reconciliation-webhook';
process.env.POINTS_FUNDING_BANK_PROVIDER = 'Recon Bank';
process.env.POINTS_FUNDING_ACCOUNT_NAME = 'TRANSFERLY RECON';
process.env.POINTS_FUNDING_ACCOUNT_NUMBER = '2223334445';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { profileRepository } = require('../repositories/profileRepository');
const { serviceRepository } = require('../repositories/serviceRepository');
const { userRepository } = require('../repositories/userRepository');
const { orderService } = require('../services/orderService');
const { pointsFundingService } = require('../services/pointsFundingService');
const { reconciliationTimelineService } = require('../services/reconciliationTimelineService');
const { setPointBalance } = require('./helpers/pointLedgerFixtures');

async function createUser(userId, points = 0) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@points-reconciliation.example.com`,
    displayName: userId,
    countryCode: 'NG'
  });
  await profileRepository.upsert({
    userId,
    name: userId,
    points: 0,
    role: 'USER'
  });
  if (points > 0) {
    await setPointBalance(userId, points);
  }
}

async function createSubmittedFundingRequest(userId) {
  const config = await pointsFundingService.getFundingConfig();
  const created = await pointsFundingService.createFundingRequest({
    userId,
    packageId: config.packages[0].id,
    idempotencyKey: `recon-create-${userId}`
  });
  await pointsFundingService.submitEvidence({
    userId,
    requestId: created.funding_request.id,
    evidence: {
      fileId: `file-${userId}`,
      storageKey: `funding/${userId}.png`,
      originalName: 'payment.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      sha256: 'b'.repeat(64)
    },
    userTransactionReference: `RECON-TX-${userId}`
  });
  return created.funding_request;
}

before(async () => {
  await migrate();
  await serviceRepository.upsert({
    slug: 'recon-default-action',
    title: 'Reconciliation Default Action',
    category: 'Testing',
    description: 'Exercises reservation reconciliation.',
    status: 'active',
    permissions: ['authenticated'],
    inputSchema: {},
    executionMode: 'production',
    version: '1'
  });
});

after(async () => {
  await close();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('points reconciliation detects projected balance drift', async () => {
  await createUser('recon-projection-drift', 100);
  await db.run('UPDATE profiles SET points = ? WHERE user_id = ?', [99, 'recon-projection-drift']);

  const result = await reconciliationTimelineService.detectMismatches({ pointsLimit: 20 });
  const mismatch = result.mismatches.find((entry) =>
    entry.type === 'points_projection_mismatch' && entry.entityId === 'recon-projection-drift'
  );

  assert.ok(mismatch);
  assert.equal(mismatch.expectedBalance, 100);
  assert.equal(mismatch.actualBalance, 99);
  assert.equal(mismatch.difference, -1);

  const alert = await db.get(
    'SELECT * FROM points_reconciliation_alerts WHERE alert_type = ? AND user_id = ?',
    ['points_projection_mismatch', 'recon-projection-drift']
  );
  assert.ok(alert);
  assert.equal(alert.status, 'OPEN');
  assert.equal(alert.expected_points, 100);
  assert.equal(alert.actual_points, 99);

  await reconciliationTimelineService.detectMismatches({ pointsLimit: 20 });
  const duplicateCount = await db.get(
    'SELECT COUNT(*) AS count FROM points_reconciliation_alerts WHERE alert_type = ? AND user_id = ?',
    ['points_projection_mismatch', 'recon-projection-drift']
  );
  assert.equal(duplicateCount.count, 1);
});

test('points reconciliation detects credited funding requests without matching purchase credit', async () => {
  await createUser('recon-missing-funding-credit');
  const request = await createSubmittedFundingRequest('recon-missing-funding-credit');
  await db.run(
    "UPDATE points_funding_requests SET status = 'POINTS_CREDITED', credited_at = ?, ledger_entry_key = ? WHERE id = ?",
    [new Date().toISOString(), 'missing-ledger-entry', request.id]
  );

  const result = await reconciliationTimelineService.detectMismatches({ pointsLimit: 20 });
  const mismatch = result.mismatches.find((entry) =>
    entry.type === 'points_funding_missing_credit' && entry.entityId === request.id
  );

  assert.ok(mismatch);
  assert.equal(mismatch.expectedPoints, 1000);
  assert.equal(mismatch.actualPoints, 0);
  assert.equal(mismatch.ledgerEntryCount, 0);

  const alert = await db.get(
    'SELECT * FROM points_reconciliation_alerts WHERE alert_type = ? AND funding_request_id = ?',
    ['points_funding_missing_credit', request.id]
  );
  assert.ok(alert);
  assert.equal(alert.status, 'OPEN');
  assert.equal(alert.expected_points, 1000);
  assert.equal(alert.actual_points, 0);
});

test('points reconciliation detects duplicate funding purchase credits', async () => {
  await createUser('recon-duplicate-funding-credit');
  const request = await createSubmittedFundingRequest('recon-duplicate-funding-credit');
  await pointsFundingService.assignFundingRequest({
    requestId: request.id,
    adminActorId: 'recon-manager',
    assignedTo: 'recon-admin'
  });
  await pointsFundingService.approveFundingRequest({
    requestId: request.id,
    adminActorId: 'recon-admin',
    idempotencyKey: 'recon-approve'
  });
  await db.run(
    `
      INSERT INTO points_transactions (
        id, entry_key, user_id, type, amount, description, reference_type,
        reference_id, balance_after, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      'duplicate-credit-row',
      `points-funding:${request.id}:duplicate-credit`,
      'recon-duplicate-funding-credit',
      'PURCHASE_CREDIT',
      1000,
      'Injected duplicate credit for reconciliation test',
      'POINTS_FUNDING_REQUEST',
      request.id,
      2000,
      '{}',
      new Date().toISOString()
    ]
  );

  const result = await reconciliationTimelineService.detectMismatches({ pointsLimit: 20 });
  const mismatch = result.mismatches.find((entry) =>
    entry.type === 'points_funding_credit_mismatch' && entry.entityId === request.id
  );

  assert.ok(mismatch);
  assert.equal(mismatch.expectedPoints, 1000);
  assert.equal(mismatch.actualPoints, 2000);
  assert.equal(mismatch.ledgerEntryCount, 2);
});

test('points reconciliation detects reservation lifecycle ledger mismatches', async () => {
  await createUser('recon-reservation-mismatch', 250);
  const created = await orderService.createOrder({
    userId: 'recon-reservation-mismatch',
    serviceSlug: 'recon-default-action',
    idempotencyKey: 'recon-reservation-order',
    preflightAccepted: true,
    input: { reference: 'reservation' }
  });
  await db.run('DELETE FROM points_transactions WHERE entry_key = ?', [
    `point-reservation:${created.order.point_reservation_id}:hold`
  ]);

  const result = await reconciliationTimelineService.detectMismatches({ pointsLimit: 20 });
  const mismatch = result.mismatches.find((entry) =>
    entry.type === 'point_reservation_ledger_mismatch' && entry.entityId === created.order.point_reservation_id
  );

  assert.ok(mismatch);
  assert.equal(mismatch.expectedPoints, 250);
  assert.equal(mismatch.holdCount, 0);
});