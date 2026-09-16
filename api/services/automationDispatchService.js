'use strict';

const { automationRuleRepository } = require('../repositories/automationRuleRepository');
const { automationExecutionRepository } = require('../repositories/automationExecutionRepository');
const { auditLogService } = require('./auditLogService');

const ACTIONS = Object.freeze([
  'NOTIFY_ADMIN',
  'NOTIFY_USER',
  'CREATE_RECONCILIATION_TASK',
  'SEND_RECEIPT'
]);

function valuesEqual(expected, actual) {
  if (expected === undefined || expected === null || expected === '') return true;
  return String(expected).toLowerCase() === String(actual ?? '').toLowerCase();
}

function matchesCondition(condition = {}, event = {}) {
  const checks = [
    ['amount', condition.amount === undefined || Number(event.amount || 0) > Number(condition.amount)],
    ['currency', valuesEqual(condition.currency, event.currency)],
    ['provider', valuesEqual(condition.provider, event.provider)],
    ['status', valuesEqual(condition.status, event.status)],
    ['country', valuesEqual(condition.country, event.country)],
    ['risk', valuesEqual(condition.risk, event.risk)],
    ['customer', valuesEqual(condition.customer, event.customer)]
  ];
  return checks.every(([, matched]) => matched);
}

function eventIdempotencyKey(event, rule) {
  return String(event.idempotencyKey || event.eventId || `${event.trigger || 'unknown'}:${event.entityId || 'unknown'}:${event.occurredAt || ''}`) + `:rule:${rule.id}`;
}

async function dispatch({
  event = {},
  repository = automationRuleRepository,
  executionRepository = automationExecutionRepository,
  actionHandlers = {},
  audit = auditLogService
} = {}) {
  if (!event.trigger) {
    return { trigger: null, matched: 0, executions: [] };
  }
  const rules = await repository.list({ status: 'ACTIVE', limit: 250 });
  const executions = [];

  for (const rule of rules.filter((candidate) => candidate.trigger === event.trigger && matchesCondition(candidate.condition, event))) {
    const idempotencyKey = eventIdempotencyKey(event, rule);
    const existing = await executionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      executions.push(existing);
      continue;
    }
    const execution = await executionRepository.create({
      ruleId: rule.id,
      mode: 'LIVE',
      status: 'RUNNING',
      event,
      result: { action: rule.action, state: 'RUNNING' },
      idempotencyKey,
      completedAt: null
    });
    try {
      if (!ACTIONS.includes(rule.action)) {
        throw new Error(`Unsupported automation action: ${rule.action}`);
      }
      const handler = actionHandlers[rule.action];
      if (!handler) {
        const skipped = await executionRepository.update(execution.id, {
          status: 'SKIPPED',
          result: { action: rule.action, state: 'SKIPPED', reason: 'handler_not_configured' },
          completedAt: new Date().toISOString()
        });
        executions.push(skipped);
        continue;
      }
      const result = await handler({ event, rule });
      const completed = await executionRepository.update(execution.id, {
        status: 'SUCCEEDED',
        result: { action: rule.action, state: 'SUCCEEDED', result: result || null },
        completedAt: new Date().toISOString()
      });
      await audit.log({
        actorType: 'automation',
        actorId: rule.id,
        action: 'automation.execution_succeeded',
        entityType: 'automation_execution',
        entityId: execution.id,
        metadata: { trigger: event.trigger, action: rule.action }
      });
      executions.push(completed);
    } catch (error) {
      const failed = await executionRepository.update(execution.id, {
        status: 'FAILED',
        result: { action: rule.action, state: 'FAILED', error: error.message },
        completedAt: new Date().toISOString()
      });
      executions.push(failed);
    }
  }

  return { trigger: event.trigger, matched: executions.length, executions };
}

module.exports = { automationDispatchService: { dispatch, matchesCondition } };
