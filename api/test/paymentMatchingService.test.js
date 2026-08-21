const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-payment-matching-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(temporaryRoot, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'payment-matching-client';
process.env.PAYPAL_CLIENT_SECRET = 'payment-matching-secret';
process.env.PAYPAL_WEBHOOK_ID = 'payment-matching-webhook';
process.env.POINTS_FUNDING_BANK_PROVIDER = 'Opay';
process.env.POINTS_FUNDING_ACCOUNT_NAME = 'TRANSFERLY MATCHING';
process.env.POINTS_FUNDING_ACCOUNT_NUMBER = '7778889990';
process.env.PAYMENT_VERIFICATION_ENABLED = 'true';
process.env.PAYMENT_AUTO_APPROVAL_ENABLED = 'true';
process.env.PAYMENT_AUTO_APPROVAL_MAX_AMOUNT_MINOR = '1000000';
process.env.OPAY_WEBHOOK_SECRET = 'opay_webhook_secret_for_tests_123456';

const config = require('../config');
const { close } = require('../db');
const { migrate } = require('../db/migrate');
const { paymentProviderTransactionRepository } = require('../repositories/paymentProviderTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { userRepository } = require('../repositories/userRepository');
const { paymentMatchingService } = require('../services/paymentMatchingService');
const { paymentProviderService } = require('../services/paymentProviderService');
const { pointsFundingService } = require('../services/pointsFundingService');
const { pointLedgerService } = require('../services/pointLedgerService');

async function createUser(userId) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@payment-matching.example.com`,
    displayName: userId,
    countryCode: 'NG'
  });
  await profileRepository.upsert({ userId, name: userId, points: 0, role: 'USER' });
}

async function createFunding(userId, packageIndex = 0) {
  const fundingConfig = await pointsFundingService.getFundingConfig();
  const created = await pointsFundingService.createFundingRequest({
    userId,
    packageId: fundingConfig.packages[packageIndex].id,
    idempotencyKey: `payment-matching-create-${userId}-${packageIndex}`
  });
  return created.funding_request;
}

function transaction(overrides = {}) {
  return {
    provider: 'opay',
    providerTransactionId: overrides.providerTransactionId || `opay-${Date.now()}-${Math.random()}`,
    providerReference: overrides.providerReference,
    eventId: overrides.eventId,
    amountMinor: overrides.amountMinor ?? 100000,
    currency: overrides.currency || 'NGN',
    status: overrides.status || 'SUCCESS',
    destination: overrides.destination || { account_number: '7778889990' },
    sender: { name: 'Test Sender' },
    transactionTime: new Date().toISOString(),
    metadata: {}
  };
}

before(async () => {
  await migrate();
});

after(async () => {
  await close();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('auto-approves an authenticated exact provider payment match and credits once', async () => {
  await createUser('payment-auto-user');
  const funding = await createFunding('payment-auto-user');
  const result = await paymentMatchingService.processVerifiedTransaction(transaction({
    providerTransactionId: 'opay-auto-1',
    eventId: 'evt-auto-1',
    providerReference: funding.public_reference
  }));

  assert.equal(result.auto_approved, true);
  assert.equal(result.match_result.status, 'MATCHED');
  assert.equal(result.approval.balance, 1000);
  assert.equal(await pointLedgerService.getBalance('payment-auto-user'), 1000);

  const duplicate = await paymentMatchingService.processVerifiedTransaction(transaction({
    providerTransactionId: 'opay-auto-1',
    eventId: 'evt-auto-1-duplicate',
    providerReference: funding.public_reference
  }));
  assert.equal(duplicate.duplicate, true);
  assert.equal(await pointLedgerService.getBalance('payment-auto-user'), 1000);
});

test('routes amount mismatch, currency mismatch, and multiple candidates to manual review', async () => {
  await createUser('payment-manual-user');
  const funding = await createFunding('payment-manual-user');
  const amountMismatch = await paymentMatchingService.processVerifiedTransaction(transaction({
    providerTransactionId: 'opay-amount-mismatch',
    providerReference: funding.public_reference,
    amountMinor: 90000
  }));
  assert.equal(amountMismatch.auto_approved, false);
  assert.equal(amountMismatch.match_result.status, 'MANUAL_REVIEW');
  assert.ok(amountMismatch.match_result.mismatches.includes('AMOUNT_MISMATCH'));

  const currencyMismatch = await paymentMatchingService.processVerifiedTransaction(transaction({
    providerTransactionId: 'opay-currency-mismatch',
    providerReference: funding.public_reference,
    currency: 'USD'
  }));
  assert.equal(currencyMismatch.auto_approved, false);
  assert.equal(currencyMismatch.risk.level, 'HIGH');
  assert.ok(currencyMismatch.risk.flags.includes('CURRENCY_MISMATCH'));

  await createUser('payment-multiple-user');
  await createFunding('payment-multiple-user');
  const multiple = await paymentMatchingService.processVerifiedTransaction(transaction({
    providerTransactionId: 'opay-multiple-candidates',
    providerReference: '',
    amountMinor: 100000
  }));
  assert.equal(multiple.auto_approved, false);
  assert.equal(multiple.match_result.status, 'MANUAL_REVIEW');
  assert.ok(multiple.match_result.mismatches.includes('MULTIPLE_CANDIDATES'));
});

test('validates payment webhook signatures and fails safe when verification disabled', () => {
  const rawBody = JSON.stringify({ eventId: 'evt-signature' });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = paymentProviderService.buildSignature({
    timestamp,
    rawBody,
    secret: process.env.OPAY_WEBHOOK_SECRET
  });

  assert.doesNotThrow(() => paymentProviderService.verifyHmacWebhook({
    provider: 'opay',
    headers: {
      'x-opay-timestamp': timestamp,
      'x-opay-signature': signature
    },
    rawBody
  }));

  assert.throws(() => paymentProviderService.verifyHmacWebhook({
    provider: 'opay',
    headers: {
      'x-opay-timestamp': timestamp,
      'x-opay-signature': 'bad-signature'
    },
    rawBody
  }), /Payment webhook signature is invalid/);

  const previous = config.PAYMENT_VERIFICATION.enabled;
  config.PAYMENT_VERIFICATION.enabled = false;
  assert.throws(() => paymentProviderService.verifyHmacWebhook({ provider: 'opay', headers: {}, rawBody }), /Automatic payment verification is disabled/);
  config.PAYMENT_VERIFICATION.enabled = previous;
});

test('stores unmatched payments for admin investigation without crediting points', async () => {
  const result = await paymentMatchingService.processVerifiedTransaction(transaction({
    providerTransactionId: 'opay-unmatched',
    providerReference: 'UNKNOWN-REFERENCE',
    amountMinor: 250000
  }));
  assert.equal(result.auto_approved, false);
  assert.equal(result.match_result.status, 'NO_MATCH');
  const stored = await paymentProviderTransactionRepository.findByProviderTransactionId('opay', 'opay-unmatched');
  assert.equal(stored.matchStatus, 'NO_MATCH');
  assert.equal(stored.fundingRequestId, null);
});