'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { automationDispatchService } = require('../services/automationDispatchService');

function rule(overrides = {}) {
  return {
    id: 'rule-1',
    trigger: 'INVOICE_PAID',
    condition: { amount: 100 },
    action: 'NOTIFY_ADMIN',
    status: 'ACTIVE',
    ...overrides
  };
}

test('dispatch matches active rules, executes the supported handler, and persists success', async () => {
  const updates = [];
  const executions = [];
  const result = await automationDispatchService.dispatch({
    event: { trigger: 'INVOICE_PAID', eventId: 'evt-1', amount: 150 },
    repository: { async list() { return [rule()]; } },
    executionRepository: {
      async findByIdempotencyKey() { return null; },
      async create(data) {
        const execution = { id: 'execution-1', ...data };
        executions.push(execution);
        return execution;
      },
      async update(id, data) {
        updates.push({ id, data });
        return { id, ...executions[0], ...data };
      }
    },
    actionHandlers: { NOTIFY_ADMIN: async () => ({ delivered: true }) },
    audit: { async log(entry) { assert.equal(entry.action, 'automation.execution_succeeded'); } }
  });

  assert.equal(result.matched, 1);
  assert.equal(updates[0].data.status, 'SUCCEEDED');
  assert.deepEqual(updates[0].data.result.result, { delivered: true });
});

test('dispatch is idempotent and does not execute a handler twice', async () => {
  let calls = 0;
  const existing = { id: 'execution-1', status: 'SUCCEEDED' };
  const result = await automationDispatchService.dispatch({
    event: { trigger: 'INVOICE_PAID', eventId: 'evt-1', amount: 150 },
    repository: { async list() { return [rule()]; } },
    executionRepository: {
      async findByIdempotencyKey() { return existing; },
      async create() { throw new Error('should not create'); }
    },
    actionHandlers: { NOTIFY_ADMIN: async () => { calls += 1; } }
  });

  assert.equal(result.executions[0], existing);
  assert.equal(calls, 0);
});

test('dispatch records skipped execution when an action handler is unavailable', async () => {
  let update;
  const result = await automationDispatchService.dispatch({
    event: { trigger: 'INVOICE_PAID', eventId: 'evt-2', amount: 150 },
    repository: { async list() { return [rule({ action: 'SEND_RECEIPT' })]; } },
    executionRepository: {
      async findByIdempotencyKey() { return null; },
      async create(data) { return { id: 'execution-2', ...data }; },
      async update(_id, data) { update = data; return data; }
    }
  });

  assert.equal(result.executions.length, 1);
  assert.equal(update.status, 'SKIPPED');
  assert.equal(update.result.reason, 'handler_not_configured');
});
