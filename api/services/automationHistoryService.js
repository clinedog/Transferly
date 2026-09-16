'use strict';

const { auditLogService } = require('./auditLogService');

const AUTOMATION_ACTIONS = [
  'invoice_reminder_configuration.updated',
  'invoice_reminder_configuration.suspended',
  'invoice_reminder_configuration.resumed'
];

function executionStatus(action) {
  if (action.endsWith('.suspended')) return 'SKIPPED';
  if (action.endsWith('.resumed')) return 'TRIGGERED';
  return 'SUCCEEDED';
}

async function listHistory({ limit = 100, before } = {}) {
  const entries = await auditLogService.list({
    action: 'invoice_reminder_configuration',
    limit,
    before
  });
  return entries
    .filter((entry) => AUTOMATION_ACTIONS.includes(entry.action))
    .map((entry) => ({
      id: entry.id,
      automation: 'Invoice reminder configuration',
      trigger: entry.metadata?.type || 'Invoice lifecycle',
      conditions: {
        interval: entry.metadata?.interval || null,
        repetition: entry.metadata?.repetition ?? null
      },
      action: entry.action.split('.').pop(),
      status: executionStatus(entry.action),
      timestamp: entry.createdAt,
      actorType: entry.actorType,
      entityId: entry.entityId
    }));
}

module.exports = {
  automationHistoryService: { listHistory }
};
