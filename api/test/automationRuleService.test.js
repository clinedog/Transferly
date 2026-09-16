'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { automationRuleService } = require('../services/automationRuleService');

test('automation rules validate supported actions and provide safe dry runs', async () => {
  let audit;
  const rule = await automationRuleService.create({
    name: 'Notify on large invoice',
    trigger: 'INVOICE_PAID',
    condition: { amount: 100000 },
    action: 'NOTIFY_ADMIN',
    actorId: 'admin-1',
    repository: { async create(data) { return { id: 'rule-1', ...data, status: 'ACTIVE' }; } },
    audit: { async log(entry) { audit = entry; } }
  });
  assert.equal(rule.id, 'rule-1');
  assert.equal(audit.action, 'automation_rule.created');
  const preview = await automationRuleService.dryRun({
    id: 'rule-1',
    event: { trigger: 'INVOICE_PAID', amount: 150000 },
    repository: { async findById() { return rule; } },
    executionRepository: {
      async findByIdempotencyKey() { return null; },
      async create(data) { return { id: 'execution-1', result: data.result }; }
    }
  });
  assert.equal(preview.wouldRun, true);
  assert.equal(preview.execution, 'DRY_RUN');
});

test('automation dry runs are idempotent', async () => {
  const result = { ruleId: 'rule-1', wouldRun: true, execution: 'DRY_RUN' };
  let creates = 0;
  const preview = await automationRuleService.dryRun({
    id: 'rule-1',
    idempotencyKey: 'same-run',
    event: { trigger: 'INVOICE_PAID' },
    repository: { async findById() { return { id: 'rule-1', status: 'ACTIVE', trigger: 'INVOICE_PAID', condition: {}, action: 'NOTIFY_ADMIN' }; } },
    executionRepository: {
      async findByIdempotencyKey() { return creates ? { result } : null; },
      async create() { creates += 1; }
    }
  });
  assert.equal(preview.wouldRun, true);
  const replay = await automationRuleService.dryRun({
    id: 'rule-1',
    idempotencyKey: 'same-run',
    event: { trigger: 'INVOICE_PAID' },
    repository: { async findById() { return { id: 'rule-1', status: 'ACTIVE', trigger: 'INVOICE_PAID', condition: {}, action: 'NOTIFY_ADMIN' }; } },
    executionRepository: {
      async findByIdempotencyKey() { return { result }; },
      async create() { creates += 1; }
    }
  });
  assert.deepEqual(replay, result);
  assert.equal(creates, 1);
});
