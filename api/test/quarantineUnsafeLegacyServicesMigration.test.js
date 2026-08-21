const assert = require('node:assert/strict');
const { test } = require('node:test');

const migration = require('../db/migrations/202607230001_quarantine_unsafe_legacy_services');

test('quarantines unsafe legacy service slugs without touching supported services', async () => {
  const calls = [];
  const client = {
    async run(sql, params) {
      calls.push({ sql, params });
    }
  };

  await migration.up(client);

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SET status = 'disabled'/);
  assert.ok(calls[0].params.includes('opay'));
  assert.ok(calls[0].params.includes('pass-clone'));
  assert.equal(calls[0].params.includes('paypal'), false);
});
