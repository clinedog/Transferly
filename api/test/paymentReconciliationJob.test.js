'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerPaymentReconciliationSchedule,
  RECONCILIATION_JOB_NAME,
  RECONCILIATION_SCHEDULER_ID
} = require('../jobs/paymentReconciliationJob');

test('payment reconciliation schedule is bounded and repeatable', async () => {
  const calls = [];
  const queue = {
    upsertJobScheduler: async (...args) => {
      calls.push(args);
      return { id: RECONCILIATION_SCHEDULER_ID };
    }
  };

  await registerPaymentReconciliationSchedule(queue, {
    intervalMs: 900000,
    invoiceLimit: 25,
    payoutLimit: 50
  });

  assert.deepEqual(calls, [[
    RECONCILIATION_SCHEDULER_ID,
    { every: 900000 },
    {
      name: RECONCILIATION_JOB_NAME,
      data: { invoiceLimit: 25, payoutLimit: 50 }
    }
  ]]);
});

test('payment reconciliation schedule rejects unsafe configuration', async () => {
  await assert.rejects(
    () => registerPaymentReconciliationSchedule({}, {
      intervalMs: 900000,
      invoiceLimit: 25,
      payoutLimit: 25
    }),
    { code: 'RECONCILIATION_QUEUE_INVALID' }
  );
  await assert.rejects(
    () => registerPaymentReconciliationSchedule({
      upsertJobScheduler: async () => null
    }, {
      intervalMs: 0,
      invoiceLimit: 25,
      payoutLimit: 25
    }),
    { code: 'RECONCILIATION_CONFIG_INVALID' }
  );
});
