const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-point-recovery-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(temporaryRoot, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'point-recovery-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'point-recovery-webhook';
process.env.POINT_RESERVATION_TTL_MS = '60000';
process.env.POINT_RESERVATION_EXPIRY_BATCH_SIZE = '100';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { pointReservationRepository } = require('../repositories/pointReservationRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { serviceRepository } = require('../repositories/serviceRepository');
const { userRepository } = require('../repositories/userRepository');
const { orderService } = require('../services/orderService');
const { setPointBalance } = require('./helpers/pointLedgerFixtures');
const {
  ORDER_QUEUE_STATUS,
  ORDER_STATUS,
  POINT_RESERVATION_STATUS
} = require('../utils/constants');

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function createUser(testName, points = 10) {
  const userId = `point-recovery-${testName}`;
  await userRepository.upsert({
    id: userId,
    email: `${testName}@point-recovery.example.com`,
    displayName: `Point Recovery ${testName}`,
    countryCode: 'US'
  });
  await profileRepository.upsert({
    userId,
    name: `Point Recovery ${testName}`,
    points: 0,
    role: 'USER'
  });
  await setPointBalance(userId, points);
  return userId;
}

async function createQueuedOrder(testName, points = 10) {
  const userId = await createUser(testName, points);
  const created = await orderService.createOrder({
    userId,
    serviceSlug: 'reservation-recovery-service',
    idempotencyKey: `point-recovery-${testName}`,
    preflightAccepted: true,
    input: { reference: testName }
  });
  return { order: created.order, userId };
}

async function backdateReservation(reservationId) {
  const expiresAt = new Date(Date.now() - 60000).toISOString();
  await db.run('UPDATE point_reservations SET expires_at = ? WHERE id = ?', [expiresAt, reservationId]);
  return expiresAt;
}

before(async () => {
  await migrate();
  await serviceRepository.upsert({
    slug: 'reservation-recovery-service',
    title: 'Reservation Recovery Service',
    category: 'Testing',
    description: 'Exercises point reservation expiry and concurrency behavior.',
    pointPrice: 8,
    status: 'active',
    inputSchema: {},
    executionMode: 'production',
    version: '1'
  });
});

after(async () => {
  await close();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('expires a stale queued reservation and refunds its points exactly once', async () => {
  const { order, userId } = await createQueuedOrder('expiry');
  await backdateReservation(order.point_reservation_id);

  assert.equal((await profileRepository.findByUserId(userId)).points, 2);

  const firstRun = await orderService.expireStalePointReservations({
    before: new Date().toISOString(),
    actorId: 'point-recovery-test'
  });
  assert.deepEqual(firstRun, { scanned: 1, expired: 1, skipped: 0 });

  const detail = await orderService.getOrder({ orderId: order.id, userId });
  assert.equal(detail.order.status, ORDER_STATUS.EXPIRED);
  assert.equal(detail.order.queue_status, ORDER_QUEUE_STATUS.UNAVAILABLE);
  assert.equal(detail.order.failure_code, 'POINT_RESERVATION_EXPIRED');

  const reservation = await pointReservationRepository.findById(order.point_reservation_id);
  assert.equal(reservation.status, POINT_RESERVATION_STATUS.EXPIRED);
  assert.ok(reservation.releasedAt);
  assert.ok(reservation.expiredAt);
  assert.equal((await profileRepository.findByUserId(userId)).points, 10);

  const pointEntries = await db.all(
    `
      SELECT entry_key, amount, balance_after
      FROM points_transactions
      WHERE reference_type = 'ORDER' AND reference_id = ?
      ORDER BY entry_key ASC
    `,
    [order.id]
  );
  assert.equal(pointEntries.length, 2);
  assert.deepEqual(pointEntries.map((entry) => entry.amount).sort((left, right) => left - right), [-8, 8]);
  assert.deepEqual(
    pointEntries.map((entry) => entry.balance_after).sort((left, right) => left - right),
    [2, 10]
  );
  assert.ok(pointEntries.some((entry) => entry.entry_key.endsWith(':hold')));
  assert.ok(pointEntries.some((entry) => entry.entry_key.endsWith(':expire')));

  const secondRun = await orderService.expireStalePointReservations({
    before: new Date().toISOString(),
    actorId: 'point-recovery-test'
  });
  assert.deepEqual(secondRun, { scanned: 0, expired: 0, skipped: 0 });
  assert.equal((await profileRepository.findByUserId(userId)).points, 10);
  assert.equal(
    (await db.get('SELECT COUNT(*) AS count FROM points_transactions WHERE reference_id = ?', [order.id])).count,
    2
  );
});

test('allows only one of two concurrent orders to reserve a limited balance', async () => {
  const userId = await createUser('concurrent-spend');
  const attempts = await Promise.allSettled([
    orderService.createOrder({
      userId,
      serviceSlug: 'reservation-recovery-service',
      idempotencyKey: 'concurrent-spend-a',
      preflightAccepted: true,
      input: { reference: 'a' }
    }),
    orderService.createOrder({
      userId,
      serviceSlug: 'reservation-recovery-service',
      idempotencyKey: 'concurrent-spend-b',
      preflightAccepted: true,
      input: { reference: 'b' }
    })
  ]);

  const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, 'INSUFFICIENT_POINTS');
  assert.equal((await profileRepository.findByUserId(userId)).points, 2);
  assert.equal(
    (await db.get('SELECT COUNT(*) AS count FROM point_reservations WHERE user_id = ?', [userId])).count,
    1
  );
  assert.equal(
    (await db.get(
      "SELECT COUNT(*) AS count FROM points_transactions WHERE user_id = ? AND entry_key LIKE '%:hold'",
      [userId]
    )).count,
    1
  );
});

test('deduplicates concurrent order requests before a second point hold is created', async () => {
  const userId = await createUser('concurrent-idempotency');
  const request = {
    userId,
    serviceSlug: 'reservation-recovery-service',
    idempotencyKey: 'concurrent-idempotency-key',
    preflightAccepted: true,
    input: { reference: 'same-request' }
  };

  const [first, second] = await Promise.all([
    orderService.createOrder(request),
    orderService.createOrder(request)
  ]);

  assert.equal(first.order.id, second.order.id);
  assert.deepEqual([first.idempotent, second.idempotent].sort(), [false, true]);
  assert.equal((await profileRepository.findByUserId(userId)).points, 2);
  assert.equal(
    (await db.get('SELECT COUNT(*) AS count FROM point_reservations WHERE user_id = ?', [userId])).count,
    1
  );
  assert.equal(
    (await db.get(
      "SELECT COUNT(*) AS count FROM points_transactions WHERE user_id = ? AND entry_key LIKE '%:hold'",
      [userId]
    )).count,
    1
  );
});

test('does not reclaim an expired reservation after order processing owns it', async () => {
  const { order, userId } = await createQueuedOrder('processing-race');
  await backdateReservation(order.point_reservation_id);
  const started = createDeferred();
  const release = createDeferred();

  const processing = orderService.processQueuedOrder({
    orderId: order.id,
    dispatchGeneration: 1,
    jobId: 'point-recovery-processing-race',
    executor: async () => {
      started.resolve();
      await release.promise;
      return { status: ORDER_STATUS.COMPLETED, output: { recovered: true } };
    }
  });

  await started.promise;
  const expiryRun = await orderService.expireStalePointReservations({
    before: new Date().toISOString(),
    actorId: 'point-recovery-test'
  });
  assert.deepEqual(expiryRun, { scanned: 1, expired: 0, skipped: 1 });
  assert.equal(
    (await pointReservationRepository.findById(order.point_reservation_id)).status,
    POINT_RESERVATION_STATUS.RESERVED
  );
  assert.equal((await profileRepository.findByUserId(userId)).points, 2);

  release.resolve();
  const completed = await processing;
  assert.equal(completed.order.status, ORDER_STATUS.COMPLETED);
  assert.equal(
    (await pointReservationRepository.findById(order.point_reservation_id)).status,
    POINT_RESERVATION_STATUS.COMMITTED
  );
  assert.equal((await profileRepository.findByUserId(userId)).points, 2);
});
