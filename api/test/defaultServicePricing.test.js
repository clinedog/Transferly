const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-default-pricing-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(temporaryRoot, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'default-pricing-client';
process.env.PAYPAL_CLIENT_SECRET = 'default-pricing-secret';
process.env.PAYPAL_WEBHOOK_ID = 'default-pricing-webhook';
process.env.DEFAULT_SERVICE_POINT_CHARGE = '250';
process.env.POINTS_TO_NAIRA_RATE = '1';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { profileRepository } = require('../repositories/profileRepository');
const { serviceRepository } = require('../repositories/serviceRepository');
const { userRepository } = require('../repositories/userRepository');
const { catalogueService } = require('../services/catalogueService');
const { orderService } = require('../services/orderService');
const { pointPricingService } = require('../services/pointPricingService');
const { slipcraftReceiptService } = require('../services/slipcraftReceiptService');
const { setPointBalance } = require('./helpers/pointLedgerFixtures');

async function createUser(userId, points) {
  await userRepository.upsert({
    id: userId,
    email: `${userId}@default-pricing.example.com`,
    displayName: userId,
    countryCode: 'NG'
  });
  await profileRepository.upsert({
    userId,
    name: userId,
    points: 0,
    role: 'USER'
  });
  await setPointBalance(userId, points);
}

before(async () => {
  await migrate();
  await serviceRepository.upsert({
    slug: 'default-priced-action',
    title: 'Default Priced Action',
    category: 'Testing',
    description: 'No explicit service point override.',
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

test('pricing service exposes fixed 1 point = ₦1 and 250 point default charge', () => {
  assert.deepEqual(pointPricingService.getEconomySummary(), {
    points_to_naira_rate: 1,
    default_service_point_charge: 250,
    value_note: '1 Transferly Point = ₦1'
  });
});

test('catalogue displays the effective 250 point default service charge', async () => {
  const result = await catalogueService.getServiceBySlug('default-priced-action', {
    auth: { userId: 'pricing-viewer', role: 'USER' }
  });

  assert.equal(result.service.point_price, 250);
  assert.equal(result.service.configured_point_price, 0);
  assert.equal(result.service.points_value_note, '1 Transferly Point = ₦1');
  assert.equal(result.economy.default_service_point_charge, 250);
});

test('orders enforce 250 point default charge, insufficient points, and duplicate submission safety', async () => {
  await createUser('default-pricing-poor-user', 249);
  await assert.rejects(
    orderService.createOrder({
      userId: 'default-pricing-poor-user',
      serviceSlug: 'default-priced-action',
      idempotencyKey: 'default-price-insufficient',
      preflightAccepted: true,
      input: { reference: 'poor' }
    }),
    (error) =>
      error?.statusCode === 400 &&
      error?.code === 'INSUFFICIENT_POINTS' &&
      error.details.requiredPoints === 250 &&
      error.details.availablePoints === 249 &&
      error.details.shortfallPoints === 1
  );

  await createUser('default-pricing-user', 250);
  const created = await orderService.createOrder({
    userId: 'default-pricing-user',
    serviceSlug: 'default-priced-action',
    idempotencyKey: 'default-price-success',
    preflightAccepted: true,
    input: { reference: 'ok' }
  });

  assert.equal(created.order.point_cost, 250);
  assert.equal((await profileRepository.findByUserId('default-pricing-user')).points, 0);

  const retried = await orderService.createOrder({
    userId: 'default-pricing-user',
    serviceSlug: 'default-priced-action',
    idempotencyKey: 'default-price-success',
    preflightAccepted: true,
    input: { reference: 'ok' }
  });
  assert.equal(retried.idempotent, true);
  assert.equal((await profileRepository.findByUserId('default-pricing-user')).points, 0);

  const holds = await db.all(
    "SELECT * FROM points_transactions WHERE user_id = ? AND entry_key LIKE '%:hold'",
    ['default-pricing-user']
  );
  assert.equal(holds.length, 1);
  assert.equal(holds[0].amount, -250);
});

test('legacy sandbox receipt generation uses the centralized 250 point service charge', async () => {
  await createUser('default-pricing-receipt-poor-user', 249);
  await assert.rejects(
    slipcraftReceiptService.generateReceipt({
      userId: 'default-pricing-receipt-poor-user',
      serviceSlug: 'faker-data',
      type: 'bank',
      details: { service: 'faker-data' }
    }),
    (error) =>
      error?.statusCode === 400 &&
      error?.code === 'INSUFFICIENT_POINTS' &&
      error.details.requiredPoints === 250 &&
      error.details.availablePoints === 249 &&
      error.details.shortfallPoints === 1
  );

  await createUser('default-pricing-receipt-user', 250);
  const result = await slipcraftReceiptService.generateReceipt({
    userId: 'default-pricing-receipt-user',
    serviceSlug: 'faker-data',
    type: 'bank',
    details: { service: 'faker-data' },
    receiptId: 'default-pricing-receipt-1'
  });

  assert.equal(result.summary.cost_points, 250);
  assert.equal(result.summary.remaining_points, 0);
  assert.equal((await profileRepository.findByUserId('default-pricing-receipt-user')).points, 0);
});