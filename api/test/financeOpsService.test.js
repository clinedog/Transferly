const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-finance-ops-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(temporaryRoot, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'finance-ops-client';
process.env.PAYPAL_CLIENT_SECRET = 'finance-ops-secret';
process.env.PAYPAL_WEBHOOK_ID = 'finance-ops-webhook';
process.env.POINTS_FUNDING_BANK_PROVIDER = 'Finance Bank';
process.env.POINTS_FUNDING_ACCOUNT_NAME = 'TRANSFERLY FINANCE';
process.env.POINTS_FUNDING_ACCOUNT_NUMBER = '5556667778';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { profileRepository } = require('../repositories/profileRepository');
const { userRepository } = require('../repositories/userRepository');
const { financeOpsService } = require('../services/financeOpsService');
const { pointsFundingService } = require('../services/pointsFundingService');
const { reconciliationTimelineService } = require('../services/reconciliationTimelineService');

async function createUser(userId) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@finance-ops.example.com`,
    displayName: userId,
    countryCode: 'NG'
  });
  await profileRepository.upsert({
    userId,
    name: userId,
    points: 0,
    role: 'USER'
  });
}

async function createSubmittedFundingRequest(userId) {
  const config = await pointsFundingService.getFundingConfig();
  const created = await pointsFundingService.createFundingRequest({
    userId,
    packageId: config.packages[0].id,
    idempotencyKey: `finance-create-${userId}`
  });
  await pointsFundingService.submitEvidence({
    userId,
    requestId: created.funding_request.id,
    evidence: {
      fileId: `file-${userId}`,
      storageKey: `finance/${userId}.png`,
      originalName: 'payment.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      sha256: 'c'.repeat(64)
    },
    userTransactionReference: `FINANCE-TX-${userId}`
  });
  return created.funding_request;
}

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('finance operations summarize funding, ledger, and pending review state', async () => {
  await createUser('finance-overview-user');
  const request = await createSubmittedFundingRequest('finance-overview-user');
  await pointsFundingService.assignFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-admin-a',
    assignedTo: 'finance-admin-b'
  });
  await pointsFundingService.approveFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-admin-b',
    idempotencyKey: 'finance-overview-approve'
  });

  const overview = await financeOpsService.getOverview();
  assert.equal(overview.total_funding_minor, 100000);
  assert.equal(overview.total_points_in_circulation, 1000);
  assert.equal(overview.total_points_issued, 1000);
  assert.equal(overview.pending_funding, 0);
  assert.equal(overview.reconciliation_status, 'HEALTHY');
});

test('finance transaction explorer and user profile use authoritative point ledger data', async () => {
  const transactions = await financeOpsService.listTransactions({ userId: 'finance-overview-user', limit: 10 });
  assert.ok(transactions.data.some((entry) => entry.type === 'PURCHASE_CREDIT'));
  assert.ok(transactions.data.every((entry) => entry.direction === 'CREDIT'));

  const profile = await financeOpsService.getUserFinanceProfile('finance-overview-user');
  assert.equal(profile.available_points, 1000);
  assert.equal(profile.purchased_points, 1000);
  assert.equal(profile.pending_funding, 0);
});

test('funding assignment is persisted and visible in admin funding responses', async () => {
  await createUser('finance-assignment-user');
  const request = await createSubmittedFundingRequest('finance-assignment-user');
  const assigned = await pointsFundingService.assignFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-manager',
    assignedTo: 'finance-reviewer'
  });

  assert.equal(assigned.funding_request.assigned_to, 'finance-reviewer');
  assert.equal(assigned.funding_request.assigned_by, 'finance-manager');
  assert.equal(assigned.funding_request.status, 'UNDER_REVIEW');

  const list = await pointsFundingService.listAdminFundingRequests({ query: request.public_reference });
  assert.equal(list.data[0].assigned_to, 'finance-reviewer');
});

test('finance operations list persisted reconciliation alerts', async () => {
  await createUser('finance-alert-user');
  await db.run('UPDATE profiles SET points = ? WHERE user_id = ?', [1, 'finance-alert-user']);
  await reconciliationTimelineService.detectMismatches({ pointsLimit: 50 });

  const alerts = await financeOpsService.listReconciliationAlerts({ status: 'OPEN', userId: 'finance-alert-user' });
  assert.equal(alerts.data.length, 1);
  assert.equal(alerts.data[0].alert_type, 'points_projection_mismatch');
  assert.equal(alerts.data[0].status, 'OPEN');
});