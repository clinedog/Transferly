'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { productionReadinessService, STATUS } = require('../services/productionReadinessService');

test('production readiness fails when migrations are pending', () => {
  const result = productionReadinessService.assessMigrationReadiness([
    { name: 'first', status: 'applied' },
    { name: 'second', status: 'pending' }
  ]);

  assert.equal(result.status, STATUS.FAIL);
  assert.match(result.detail, /second/);
});

test('production readiness passes only when all migrations are applied', () => {
  const result = productionReadinessService.assessMigrationReadiness([
    { name: 'first', status: 'applied' },
    { name: 'second', status: 'applied' }
  ]);

  assert.equal(result.status, STATUS.PASS);
  assert.match(result.detail, /2 migration/);
});

test('provider execution readiness fails closed in production without an executable provider', () => {
  const result = productionReadinessService.assessProviderExecutionReadiness([
    {
      manifest: { enabled: true },
      readiness: {
        ready: false,
        production_enabled: false,
        operations: [{ execution_eligible: { production: false } }]
      }
    }
  ], { environment: 'production' });

  assert.equal(result.status, STATUS.FAIL);
  assert.match(result.detail, /No enabled provider/);
});

test('provider execution readiness reports partial provider rollout as a warning', () => {
  const result = productionReadinessService.assessProviderExecutionReadiness([
    {
      manifest: { enabled: true },
      readiness: {
        ready: true,
        production_enabled: true,
        operations: [{ execution_eligible: { production: true } }]
      }
    },
    {
      manifest: { enabled: true },
      readiness: {
        ready: false,
        production_enabled: false,
        operations: [{ execution_eligible: { production: false } }]
      }
    }
  ], { environment: 'production' });

  assert.equal(result.status, STATUS.WARN);
  assert.match(result.detail, /1 enabled provider/);
});
