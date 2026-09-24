'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { notificationRepository } = require('../repositories/notificationRepository');

test('notification creation records an auditable in-app delivery', async () => {
  const calls = [];
  const client = {
    async run(sql, values) {
      calls.push({ sql, values });
      return { changes: 1 };
    },
    async get() {
      return {
        id: 'notif:1',
        user_id: 'user-1',
        type: 'funding',
        title: 'Funding update',
        message: 'Review required',
        data_json: '{}',
        created_at: '2026-09-24T00:00:00.000Z'
      };
    }
  };

  const notification = await notificationRepository.createNotification({
    userId: 'user-1',
    type: 'funding',
    title: 'Funding update',
    message: 'Review required'
  }, client);

  assert.equal(notification.id, 'notif:1');
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /notification_deliveries/);
  assert.equal(calls[1].values.length, 5);
});

test('pending delivery listing is bounded and due-time aware', async () => {
  let values;
  const rows = await notificationRepository.listPendingDeliveries({
    limit: 500,
    now: '2026-09-24T00:00:00.000Z'
  }, {
    async all(_sql, params) {
      values = params;
      return [{ id: 'delivery:1', status: 'pending' }];
    }
  });

  assert.equal(rows.length, 1);
  assert.deepEqual(values, ['2026-09-24T00:00:00.000Z', 100]);
});
