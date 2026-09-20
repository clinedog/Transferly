const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-points-funding-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'points-funding-client';
process.env.PAYPAL_CLIENT_SECRET = 'points-funding-secret';
process.env.PAYPAL_WEBHOOK_ID = 'points-funding-webhook';
process.env.POINTS_FUNDING_BANK_PROVIDER = 'Test Bank';
process.env.POINTS_FUNDING_ACCOUNT_NAME = 'TRANSFERLY TEST SERVICES';
process.env.POINTS_FUNDING_ACCOUNT_NUMBER = '1234567890';
process.env.GENERATED_ASSET_STORAGE_PATH = path.join(testDir, 'private-assets');

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { auditLogRepository } = require('../repositories/auditLogRepository');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { userRepository } = require('../repositories/userRepository');
const { pointsFundingService } = require('../services/pointsFundingService');
const { pointLedgerService } = require('../services/pointLedgerService');
const { notificationService } = require('../services/notificationService');

let fundingCreateSequence = 0;

async function createUser(userId) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@points-funding.example.com`,
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

function evidence(overrides = {}) {
  return {
    fileId: `file-${Date.now()}`,
    storageKey: `funding-evidence/${Date.now()}.png`,
    originalName: 'payment.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    sha256: 'a'.repeat(64),
    ...overrides
  };
}

function pngBase64() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
  ]).toString('base64');
}

async function createSubmittedFundingRequest(userId, txReference = 'BANK-TX-001') {
  const config = await pointsFundingService.getFundingConfig();
  const created = await pointsFundingService.createFundingRequest({
    userId,
    packageId: config.packages[0].id,
    userNote: 'I want to buy points.',
    idempotencyKey: `create-${userId}-${txReference}-${fundingCreateSequence += 1}`
  });
  const submitted = await pointsFundingService.submitEvidence({
    userId,
    requestId: created.funding_request.id,
    evidence: evidence({ fileId: `file-${txReference}`, storageKey: `funding/${txReference}.png` }),
    userTransactionReference: txReference,
    userNote: 'Paid from test bank.'
  });
  return submitted.funding_request;
}

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('loads server-controlled funding packages and payment destination', async () => {
  const config = await pointsFundingService.getFundingConfig();

  assert.ok(config.packages.length >= 3);
  assert.equal(config.packages[0].currency, 'NGN');
  assert.equal(config.payment_destination.provider, 'Test Bank');
  assert.equal(config.payment_destination.account_name, 'TRANSFERLY TEST SERVICES');
  assert.equal(config.payment_destination.account_number, '1234567890');
  assert.equal(config.payment_destination.points_value_note, '1 Transferly Point = ₦1');
  assert.equal(config.economy.points_to_naira_rate, 1);
  assert.equal(config.economy.default_service_point_charge, 250);
  assert.equal(config.economy.value_note, '1 Transferly Point = ₦1');
  assert.ok(config.evidence_policy.allowed_mime_types.includes('image/png'));
});

test('creates a funding request with unique TP reference and does not credit points from instructions or evidence', async () => {
  await createUser('funding-user-create');
  const config = await pointsFundingService.getFundingConfig();

  const created = await pointsFundingService.createFundingRequest({
    userId: 'funding-user-create',
    packageId: config.packages[1].id,
    userNote: 'Funding request test',
    idempotencyKey: 'create-funding-user-create'
  });

  assert.match(created.funding_request.public_reference, /^TP-\d{8}-[A-F0-9]{6}$/);
  assert.equal(created.funding_request.status, 'PAYMENT_INSTRUCTIONS');
  assert.equal(created.funding_request.requested_points, 5000);
  assert.equal(created.funding_request.expected_amount_minor, 500000);
  assert.equal(created.funding_request.points_value_note, '1 Transferly Point = ₦1');
  assert.equal(await pointLedgerService.getBalance('funding-user-create'), 0);

  const submitted = await pointsFundingService.submitEvidence({
    userId: 'funding-user-create',
    requestId: created.funding_request.id,
    evidence: evidence(),
    userTransactionReference: 'BANK-TX-CREATE',
    userNote: 'Payment made.'
  });

  assert.equal(submitted.funding_request.status, 'PAYMENT_REPORTED');
  assert.equal(await pointLedgerService.getBalance('funding-user-create'), 0);
});

test('funding request creation is idempotent for exact retries', async () => {
  await createUser('funding-user-idempotent-create');
  const config = await pointsFundingService.getFundingConfig();
  const input = {
    userId: 'funding-user-idempotent-create',
    packageId: config.packages[0].id,
    userNote: 'Retry-safe create.',
    idempotencyKey: 'same-create-key'
  };

  const first = await pointsFundingService.createFundingRequest(input);
  const second = await pointsFundingService.createFundingRequest(input);

  assert.equal(second.funding_request.id, first.funding_request.id);
  assert.equal(second.funding_request.public_reference, first.funding_request.public_reference);

  await assert.rejects(
    pointsFundingService.createFundingRequest({
      ...input,
      packageId: config.packages[1].id
    }),
    (error) => error?.statusCode === 409 && error?.code === 'IDEMPOTENCY_KEY_REUSED'
  );
});

test('flags possible duplicate transaction references without auto-rejecting', async () => {
  await createUser('funding-user-duplicate');
  const first = await createSubmittedFundingRequest('funding-user-duplicate', 'DUPLICATE-TX-001');
  const second = await createSubmittedFundingRequest('funding-user-duplicate', 'DUPLICATE-TX-001');

  assert.equal(first.possible_duplicate, false);
  assert.equal(second.status, 'PAYMENT_REPORTED');
  assert.equal(second.possible_duplicate, true);
  assert.equal(second.risk_status, 'POSSIBLE_DUPLICATE');
});

test('admin approval credits points exactly once and writes audit plus ledger records', async () => {
  await createUser('funding-user-approve');
  const request = await createSubmittedFundingRequest('funding-user-approve', 'APPROVE-TX-001');
  await pointsFundingService.assignFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-manager',
    assignedTo: 'finance-admin'
  });

  const approved = await pointsFundingService.approveFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-admin',
    adminNote: 'Verified in bank statement.',
    idempotencyKey: 'approve-once'
  });

  assert.equal(approved.funding_request.status, 'POINTS_CREDITED');
  assert.equal(approved.balance, 1000);
  assert.equal(approved.already_processed, false);
  assert.equal(await pointLedgerService.getBalance('funding-user-approve'), 1000);

  const notifications = await db.all(
    'SELECT type, title FROM notifications WHERE user_id = ? ORDER BY created_at ASC',
    ['funding-user-approve']
  );
  assert.ok(notifications.some((notification) => notification.type === 'funding.created'));
  assert.ok(notifications.some((notification) => notification.type === 'funding.submitted'));
  assert.equal(notifications.filter((notification) => notification.type === 'points.credited').length, 1);

  const userNotifications = await notificationService.listUserNotifications('funding-user-approve');
  const creditNotification = userNotifications.data.find((notification) => notification.type === 'points.credited');
  assert.ok(creditNotification);
  const readResult = await notificationService.markUserNotificationRead('funding-user-approve', creditNotification.id);
  assert.ok(readResult.notification.read_at);
  await createUser('funding-user-notification-other');
  await assert.rejects(
    notificationService.markUserNotificationRead('funding-user-notification-other', creditNotification.id),
    (error) => error?.statusCode === 404 && error?.code === 'NOTIFICATION_NOT_FOUND'
  );

  const retried = await pointsFundingService.approveFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-admin-2',
    adminNote: 'Second click.',
    idempotencyKey: 'approve-twice'
  });

  assert.equal(retried.already_processed, true);
  assert.equal(await pointLedgerService.getBalance('funding-user-approve'), 1000);

  const ledgerEntries = await pointTransactionRepository.findByUserId('funding-user-approve');
  assert.equal(ledgerEntries.filter((entry) => entry.referenceId === request.id).length, 1);

  const auditEntries = await auditLogRepository.findManyForEntity('points_funding_request', request.id);
  assert.ok(auditEntries.some((entry) => entry.action === 'points_funding.approved_and_credited'));
});

test('concurrent admin approvals cannot double-credit a funding request', async () => {
  await createUser('funding-user-concurrent');
  const request = await createSubmittedFundingRequest('funding-user-concurrent', 'CONCURRENT-TX-001');
  await pointsFundingService.assignFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-manager',
    assignedTo: 'finance-admin-a'
  });

  const results = await Promise.all([
    pointsFundingService.approveFundingRequest({
      requestId: request.id,
      adminActorId: 'finance-admin-a',
      adminNote: 'Verified by admin A.',
      idempotencyKey: 'concurrent-a'
    }),
    pointsFundingService.approveFundingRequest({
      requestId: request.id,
      adminActorId: 'finance-admin-b',
      adminNote: 'Verified by admin B.',
      idempotencyKey: 'concurrent-b'
    })
  ]);

  assert.equal(results.filter((result) => result.already_processed).length, 1);
  assert.equal(results.filter((result) => !result.already_processed).length, 1);
  assert.equal(await pointLedgerService.getBalance('funding-user-concurrent'), 1000);

  const creditNotifications = await db.all(
    "SELECT id FROM notifications WHERE user_id = ? AND type = 'points.credited'",
    ['funding-user-concurrent']
  );
  assert.equal(creditNotifications.length, 1);

  const ledgerEntries = await pointTransactionRepository.findByUserId('funding-user-concurrent');
  assert.equal(ledgerEntries.filter((entry) => entry.referenceId === request.id).length, 1);
});

test('funding approval requires an assigned reviewer and four-eyes separation', async () => {
  await createUser('funding-user-maker-checker');
  const request = await createSubmittedFundingRequest('funding-user-maker-checker', 'MAKER-CHECKER-001');

  await assert.rejects(
    pointsFundingService.approveFundingRequest({
      requestId: request.id,
      adminActorId: 'finance-admin',
      idempotencyKey: 'maker-checker-unassigned'
    }),
    (error) => error?.code === 'FUNDING_REQUEST_REVIEWER_REQUIRED'
  );

  await pointsFundingService.assignFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-admin',
    assignedTo: 'finance-reviewer'
  });
  await assert.rejects(
    pointsFundingService.approveFundingRequest({
      requestId: request.id,
      adminActorId: 'finance-admin',
      idempotencyKey: 'maker-checker-self-approval'
    }),
    (error) => error?.code === 'FUNDING_REQUEST_FOUR_EYES_REQUIRED'
  );
  const approved = await pointsFundingService.approveFundingRequest({
    requestId: request.id,
    adminActorId: 'finance-reviewer',
    idempotencyKey: 'maker-checker-valid-approval'
  });
  assert.equal(approved.funding_request.status, 'POINTS_CREDITED');
});

test('admin can reject or request more information without crediting points', async () => {
  await createUser('funding-user-review');
  const rejected = await createSubmittedFundingRequest('funding-user-review', 'REJECT-TX-001');
  const moreInfo = await createSubmittedFundingRequest('funding-user-review', 'INFO-TX-001');

  const rejectedResult = await pointsFundingService.rejectFundingRequest({
    requestId: rejected.id,
    adminActorId: 'finance-admin',
    rejectionReason: 'Payment could not be verified.',
    adminNote: 'No matching bank entry.'
  });
  assert.equal(rejectedResult.funding_request.status, 'REJECTED');

  const infoResult = await pointsFundingService.requestMoreInformation({
    requestId: moreInfo.id,
    adminActorId: 'support-admin',
    adminNote: 'Please upload a clearer screenshot.'
  });
  assert.equal(infoResult.funding_request.status, 'NEEDS_MORE_INFORMATION');
  assert.equal(await pointLedgerService.getBalance('funding-user-review'), 0);
});

test('rejects unsupported evidence files before state transition', async () => {
  await createUser('funding-user-evidence');
  const config = await pointsFundingService.getFundingConfig();
  const created = await pointsFundingService.createFundingRequest({
    userId: 'funding-user-evidence',
    packageId: config.packages[0].id,
    idempotencyKey: 'create-funding-user-evidence'
  });

  await assert.rejects(
    pointsFundingService.submitEvidence({
      userId: 'funding-user-evidence',
      requestId: created.funding_request.id,
      evidence: evidence({ mimeType: 'text/plain' }),
      userTransactionReference: 'BAD-FILE-001'
    }),
    (error) => error?.statusCode === 400 && error?.code === 'PAYMENT_EVIDENCE_TYPE_UNSUPPORTED'
  );

  const row = await db.get('SELECT status FROM points_funding_requests WHERE id = ?', [created.funding_request.id]);
  assert.equal(row.status, 'PAYMENT_INSTRUCTIONS');
});

test('uploads private funding evidence, enforces owner access, and does not credit points', async () => {
  await createUser('funding-user-upload');
  await createUser('funding-user-upload-other');
  const config = await pointsFundingService.getFundingConfig();
  const created = await pointsFundingService.createFundingRequest({
    userId: 'funding-user-upload',
    packageId: config.packages[0].id,
    idempotencyKey: 'create-funding-user-upload'
  });

  const uploaded = await pointsFundingService.uploadAndSubmitEvidence({
    userId: 'funding-user-upload',
    requestId: created.funding_request.id,
    fileName: '../proof.png',
    mimeType: 'image/png',
    contentBase64: pngBase64(),
    userTransactionReference: 'UPLOAD-TX-001',
    userNote: 'Uploaded from Mini App.'
  });

  assert.equal(uploaded.funding_request.status, 'PAYMENT_REPORTED');
  assert.equal(uploaded.funding_request.evidence.metadata.original_name, 'proof.png');
  assert.equal(uploaded.funding_request.evidence.storage_key, undefined);
  assert.equal(await pointLedgerService.getBalance('funding-user-upload'), 0);

  const repeated = await pointsFundingService.uploadAndSubmitEvidence({
    userId: 'funding-user-upload',
    requestId: created.funding_request.id,
    fileName: 'proof-again.png',
    mimeType: 'image/png',
    contentBase64: pngBase64(),
    userTransactionReference: 'UPLOAD-TX-001'
  });
  assert.equal(repeated.idempotent, true);
  assert.equal(await pointLedgerService.getBalance('funding-user-upload'), 0);

  const content = await pointsFundingService.getEvidenceContentForUser({
    userId: 'funding-user-upload',
    requestId: created.funding_request.id
  });
  assert.equal(content.mimeType, 'image/png');
  assert.ok(Buffer.isBuffer(content.content));

  await assert.rejects(
    pointsFundingService.getEvidenceContentForUser({
      userId: 'funding-user-upload-other',
      requestId: created.funding_request.id
    }),
    (error) => error?.statusCode === 404 && error?.code === 'FUNDING_EVIDENCE_NOT_FOUND'
  );
});

test('rejects mismatched uploaded evidence content before state transition', async () => {
  await createUser('funding-user-upload-mismatch');
  const config = await pointsFundingService.getFundingConfig();
  const created = await pointsFundingService.createFundingRequest({
    userId: 'funding-user-upload-mismatch',
    packageId: config.packages[0].id,
    idempotencyKey: 'create-funding-user-upload-mismatch'
  });

  await assert.rejects(
    pointsFundingService.uploadAndSubmitEvidence({
      userId: 'funding-user-upload-mismatch',
      requestId: created.funding_request.id,
      fileName: 'fake.png',
      mimeType: 'image/png',
      contentBase64: Buffer.from('not a png').toString('base64')
    }),
    (error) => error?.statusCode === 400 && error?.code === 'PAYMENT_EVIDENCE_CONTENT_MISMATCH'
  );

  const row = await db.get('SELECT status, evidence_storage_key FROM points_funding_requests WHERE id = ?', [created.funding_request.id]);
  assert.equal(row.status, 'PAYMENT_INSTRUCTIONS');
  assert.equal(row.evidence_storage_key, null);
});