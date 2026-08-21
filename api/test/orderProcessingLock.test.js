const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-order-lock-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(temporaryRoot, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'order-lock-client';
process.env.PAYPAL_CLIENT_SECRET = 'order-lock-secret';
process.env.PAYPAL_WEBHOOK_ID = 'order-lock-webhook';
process.env.ORDER_PROCESSING_LOCK_TTL_MS = '60000';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { orderAttemptRepository } = require('../repositories/orderAttemptRepository');
const { pointReservationRepository } = require('../repositories/pointReservationRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { serviceRepository } = require('../repositories/serviceRepository');
const { userRepository } = require('../repositories/userRepository');
const { orderService } = require('../services/orderService');
const { setPointBalance } = require('./helpers/pointLedgerFixtures');
const {
  ORDER_ATTEMPT_STATUS,
  ORDER_STATUS,
  POINT_RESERVATION_STATUS
} = require('../utils/constants');

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function createQueuedOrder(testName) {
  const userId = `order-lock-${testName}`;
  await userRepository.upsert({
    id: userId,
    email: `${testName}@example.com`,
    displayName: `Order Lock ${testName}`,
    countryCode: 'US'
  });
  await profileRepository.upsert({
    userId,
    name: `Order Lock ${testName}`,
    points: 0,
    role: 'USER'
  });
  await setPointBalance(userId, 20);

  const created = await orderService.createOrder({
    userId,
    serviceSlug: 'lock-test-service',
    idempotencyKey: `lock-test-${testName}`,
    preflightAccepted: true,
    input: { reference: testName }
  });

  return { order: created.order, userId };
}

before(async () => {
  await migrate();
  await serviceRepository.upsert({
    slug: 'lock-test-service',
    title: 'Lock Test Service',
    category: 'Testing',
    description: 'Exercises durable worker ownership.',
    pointPrice: 4,
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

test('rejects overlapping workers while one durable processing lock is active', async () => {
  const { order, userId } = await createQueuedOrder('overlap');
  const started = createDeferred();
  const release = createDeferred();
  let executorCalls = 0;

  const firstProcessing = orderService.processQueuedOrder({
    orderId: order.id,
    dispatchGeneration: 1,
    jobId: 'overlap-job-1',
    correlationId: 'overlap-correlation-1',
    executor: async () => {
      executorCalls += 1;
      started.resolve();
      await release.promise;
      return { status: ORDER_STATUS.COMPLETED, output: { worker: 'first' } };
    }
  });

  await started.promise;
  await assert.rejects(
    orderService.processQueuedOrder({
      orderId: order.id,
      dispatchGeneration: 1,
      jobId: 'overlap-job-2',
      correlationId: 'overlap-correlation-2',
      executor: async () => {
        executorCalls += 1;
        return { status: ORDER_STATUS.COMPLETED };
      }
    }),
    (error) => {
      assert.equal(error.code, 'ORDER_PROCESSING_LOCKED');
      assert.equal(error.statusCode, 409);
      assert.equal(error.details.correlationId, 'overlap-correlation-1');
      assert.ok(error.details.retryAfterMs > 0);
      return true;
    }
  );

  release.resolve();
  const completed = await firstProcessing;
  assert.equal(completed.order.status, ORDER_STATUS.COMPLETED);
  assert.equal(executorCalls, 1);

  const attempts = await orderAttemptRepository.findManyByOrderId(order.id);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, ORDER_ATTEMPT_STATUS.SUCCEEDED);
  assert.equal(attempts[0].attemptNumber, 1);

  const detail = await orderService.getOrder({ orderId: order.id, userId });
  assert.equal(detail.attempts.length, 1);
  assert.equal(detail.attempts[0].correlation_id, 'overlap-correlation-1');
  assert.equal(detail.attempts[0].lock_token, undefined);
});

test('records failed attempts and permits a bounded queue retry to acquire a new lock', async () => {
  const { order } = await createQueuedOrder('retry');

  await assert.rejects(
    orderService.processQueuedOrder({
      orderId: order.id,
      dispatchGeneration: 1,
      jobId: 'retry-job',
      correlationId: 'retry-correlation',
      queueAttempt: 1,
      executor: async () => {
        const error = new Error('temporary renderer outage');
        error.code = 'RENDERER_UNAVAILABLE';
        throw error;
      }
    }),
    /temporary renderer outage/
  );

  const processingOrder = await db.get('SELECT status, attempt_count FROM orders WHERE id = ?', [order.id]);
  assert.equal(processingOrder.status, ORDER_STATUS.PROCESSING);
  assert.equal(processingOrder.attempt_count, 1);

  const completed = await orderService.processQueuedOrder({
    orderId: order.id,
    dispatchGeneration: 1,
    jobId: 'retry-job',
    correlationId: 'retry-correlation',
    queueAttempt: 2,
    executor: async () => ({
      status: ORDER_STATUS.COMPLETED,
      output: { recovered: true }
    })
  });

  assert.equal(completed.order.status, ORDER_STATUS.COMPLETED);
  assert.equal(completed.order.attempt_count, 2);
  const attempts = await orderAttemptRepository.findManyByOrderId(order.id);
  assert.deepEqual(
    attempts.map((attempt) => attempt.status),
    [ORDER_ATTEMPT_STATUS.FAILED, ORDER_ATTEMPT_STATUS.SUCCEEDED]
  );
  assert.equal(attempts[0].failureCode, 'RENDERER_UNAVAILABLE');
  assert.equal(attempts[0].metadata.queueAttempt, 1);
  assert.equal(attempts[1].metadata.queueAttempt, 2);

  const reservation = await pointReservationRepository.findById(order.point_reservation_id);
  assert.equal(reservation.status, POINT_RESERVATION_STATUS.COMMITTED);
});

test('fences an expired worker and allows only its replacement to settle the order', async () => {
  const { order } = await createQueuedOrder('stale');
  const firstStarted = createDeferred();
  const releaseFirst = createDeferred();
  const secondStarted = createDeferred();
  const releaseSecond = createDeferred();

  const firstProcessing = orderService.processQueuedOrder({
    orderId: order.id,
    dispatchGeneration: 1,
    jobId: 'stale-job-1',
    correlationId: 'stale-correlation-1',
    executor: async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
      return { status: ORDER_STATUS.COMPLETED, output: { worker: 'expired' } };
    }
  });

  await firstStarted.promise;
  await db.run(
    "UPDATE order_attempts SET lock_expires_at = ? WHERE order_id = ? AND status = 'processing'",
    [new Date(Date.now() - 1000).toISOString(), order.id]
  );

  const secondProcessing = orderService.processQueuedOrder({
    orderId: order.id,
    dispatchGeneration: 1,
    jobId: 'stale-job-2',
    correlationId: 'stale-correlation-2',
    queueAttempt: 2,
    executor: async () => {
      secondStarted.resolve();
      await releaseSecond.promise;
      return { status: ORDER_STATUS.COMPLETED, output: { worker: 'replacement' } };
    }
  });

  await secondStarted.promise;
  releaseFirst.resolve();
  const fencedResult = await firstProcessing;
  assert.equal(fencedResult.skipped, true);
  assert.equal(fencedResult.skipReason, 'processing_lock_lost');

  releaseSecond.resolve();
  const completed = await secondProcessing;
  assert.equal(completed.order.status, ORDER_STATUS.COMPLETED);
  assert.equal(completed.order.output.worker, 'replacement');
  assert.equal(completed.order.attempt_count, 2);

  const attempts = await orderAttemptRepository.findManyByOrderId(order.id);
  assert.deepEqual(
    attempts.map((attempt) => attempt.status),
    [ORDER_ATTEMPT_STATUS.STALE, ORDER_ATTEMPT_STATUS.SUCCEEDED]
  );
  assert.equal(attempts[0].failureCode, 'ORDER_PROCESSING_LOCK_EXPIRED');

  const settlementRows = await db.all(
    `
      SELECT entry_key
      FROM points_transactions
      WHERE reference_type = 'ORDER' AND reference_id = ?
    `,
    [order.id]
  );
  assert.equal(settlementRows.length, 2);
});
