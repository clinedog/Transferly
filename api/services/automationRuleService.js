'use strict';

const { automationRuleRepository } = require('../repositories/automationRuleRepository');
const { automationExecutionRepository } = require('../repositories/automationExecutionRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');

const TRIGGERS = ['PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'INVOICE_PAID', 'INVOICE_OVERDUE', 'PAYOUT_SUCCEEDED', 'PAYOUT_FAILED', 'TRANSACTION_UNKNOWN', 'PROVIDER_HEALTH_CHANGED'];
const ACTIONS = ['NOTIFY_ADMIN', 'NOTIFY_USER', 'CREATE_RECONCILIATION_TASK', 'SEND_RECEIPT'];

function validateRule({ trigger, action, condition = {} }) {
  if (!TRIGGERS.includes(trigger)) throw new AppError(400, 'AUTOMATION_TRIGGER_INVALID', 'Unsupported automation trigger.');
  if (!ACTIONS.includes(action)) throw new AppError(400, 'AUTOMATION_ACTION_INVALID', 'Unsupported automation action.');
  if (condition.amount !== undefined && (!Number.isFinite(Number(condition.amount)) || Number(condition.amount) < 0)) {
    throw new AppError(400, 'AUTOMATION_CONDITION_INVALID', 'Condition amount must be a non-negative number.');
  }
  return condition;
}

async function create({ name, trigger, condition, action, actorId, repository = automationRuleRepository, audit = auditLogService }) {
  const normalized = validateRule({ trigger, action, condition });
  const rule = await repository.create({ name, trigger, condition: normalized, action, createdBy: actorId });
  await audit.log({ actorType: 'admin', actorId, action: 'automation_rule.created', entityType: 'automation_rule', entityId: rule.id, metadata: { trigger, action } });
  return rule;
}

async function list({ repository = automationRuleRepository } = {}) {
  return repository.list({ limit: 250 });
}

async function setStatus({ id, status, actorId, repository = automationRuleRepository, audit = auditLogService }) {
  if (!['ACTIVE', 'PAUSED'].includes(status)) throw new AppError(400, 'AUTOMATION_STATUS_INVALID', 'Automation status must be ACTIVE or PAUSED.');
  const updated = await repository.setStatus(id, status);
  if (!updated) throw new AppError(404, 'AUTOMATION_RULE_NOT_FOUND', 'Automation rule not found.');
  await audit.log({ actorType: 'admin', actorId, action: `automation_rule.${status.toLowerCase()}`, entityType: 'automation_rule', entityId: id, metadata: {} });
  return updated;
}

async function dryRun({
  id,
  event = {},
  idempotencyKey = `dry-run:${id}:${event.trigger || 'unknown'}:${event.amount || 0}`,
  repository = automationRuleRepository,
  executionRepository = automationExecutionRepository
}) {
  const rule = await repository.findById(id);
  if (!rule) throw new AppError(404, 'AUTOMATION_RULE_NOT_FOUND', 'Automation rule not found.');
  const existing = await executionRepository.findByIdempotencyKey(idempotencyKey);
  if (existing) return existing.result;
  const triggerMatches = rule.trigger === event.trigger;
  const amount = rule.condition.amount === undefined || Number(event.amount || 0) > Number(rule.condition.amount);
  const result = { ruleId: id, wouldRun: rule.status === 'ACTIVE' && triggerMatches && amount, execution: 'DRY_RUN', action: rule.action, reason: rule.status !== 'ACTIVE' ? 'paused' : triggerMatches && amount ? 'conditions_matched' : 'conditions_not_matched' };
  await executionRepository.create({
    ruleId: id,
    mode: 'DRY_RUN',
    status: 'SUCCEEDED',
    event,
    result,
    idempotencyKey
  });
  return result;
}

async function listExecutions({ ruleId, repository = automationExecutionRepository } = {}) {
  return repository.list({ ruleId, limit: 250 });
}

module.exports = { automationRuleService: { create, list, setStatus, dryRun, listExecutions } };
