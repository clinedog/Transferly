'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProviderHealth } = require('../services/providerHealthService');

test('provider health surfaces database/read-model failures as critical operational state', async () => {
  const result = await buildProviderHealth(
    { key: 'paypal', display_name: 'PayPal', status: 'configured', next_actions: [] },
    {
      webhookRepository: {
        async findMany() {
          const error = new Error('migrations required');
          error.code = 'SQLITE_ERROR';
          throw error;
        }
      },
      issueService: { async listIssues() { return []; } }
    }
  );

  assert.equal(result.status, 'critical');
  assert.equal(result.score, 0);
  assert.equal(result.health_check_error, 'SQLITE_ERROR');
  assert.match(result.next_actions[0], /migrations/);
});
