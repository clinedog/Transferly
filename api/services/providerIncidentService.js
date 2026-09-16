'use strict';

const { paymentOpsIssueService } = require('./paymentOpsIssueService');
const { providerHealthService } = require('./providerHealthService');
const { providerIncidentRepository } = require('../repositories/providerIncidentRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');

const ACTIVE_STATUSES = ['OPEN', 'ACKNOWLEDGED'];

function incidentStatus(provider, issues) {
  if (provider.status === 'critical' || issues.some((issue) => issue.severity === 'HIGH' || issue.severity === 'CRITICAL')) {
    return 'DETECTED';
  }
  if (provider.status === 'degraded' || provider.status === 'watch' || issues.length) {
    return 'INVESTIGATING';
  }
  return null;
}

async function listProviderIncidents({ repository = providerIncidentRepository } = {}) {
  const [health, ...issueBatches] = await Promise.all([
    providerHealthService.getProviderHealthReport(),
    ...ACTIVE_STATUSES.map((status) => paymentOpsIssueService.listIssues({ status, limit: 250 }))
  ]);
  const issuesByProvider = new Map();
  issueBatches.flat().forEach((issue) => {
    const provider = String(issue.metadata?.provider || 'unknown').toLowerCase();
    const current = issuesByProvider.get(provider) || [];
    current.push(issue);
    issuesByProvider.set(provider, current);
  });

  const derived = health.data.flatMap((provider) => {
    const issues = issuesByProvider.get(provider.provider) || [];
    const status = incidentStatus(provider, issues);
    if (!status) return [];
    return [{
      id: `provider:${provider.provider}`,
      provider: provider.provider,
      display_name: provider.display_name,
      status,
      detected_at: provider.last_webhook_at || null,
      affected_operation: issues[0]?.issueType || 'provider_health',
      impact: provider.reasons?.[0] || 'Provider health requires operator attention.',
      evidence: {
        health_status: provider.status,
        health_score: provider.score,
        unresolved_issues: issues.length,
        failed_webhooks: provider.failed_webhooks,
        recent_webhooks: provider.recent_webhooks
      },
      issue_ids: issues.map((issue) => issue.id),
      next_actions: provider.next_actions || []
    }];
  });
  await Promise.all(derived.map((incident) => repository.upsertActive(incident)));
  const persisted = await repository.list({ limit: 250 });
  const byProvider = new Map(persisted.map((incident) => [incident.provider, incident]));
  return derived.map((incident) => ({ ...incident, ...(byProvider.get(incident.provider) || {}) }));
}

const INCIDENT_TRANSITIONS = {
  DETECTED: new Set(['INVESTIGATING']),
  INVESTIGATING: new Set(['MITIGATED', 'RESOLVED']),
  MITIGATED: new Set(['RESOLVED']),
  RESOLVED: new Set(['CLOSED']),
  CLOSED: new Set()
};

async function transitionIncident({ incidentId, status, adminActorId, repository = providerIncidentRepository, audit = auditLogService }) {
  const current = await repository.findById(incidentId);
  if (!current) throw new AppError(404, 'PROVIDER_INCIDENT_NOT_FOUND', 'Provider incident not found.');
  if (!INCIDENT_TRANSITIONS[current.status]?.has(status)) {
    throw new AppError(409, 'PROVIDER_INCIDENT_INVALID_TRANSITION', `Cannot transition incident from ${current.status} to ${status}.`);
  }
  const updated = await repository.transition(incidentId, status);
  await audit.log({
    actorType: 'admin',
    actorId: adminActorId,
    action: 'provider_incident.transitioned',
    entityType: 'provider_incident',
    entityId: incidentId,
    metadata: { from: current.status, to: status, provider: current.provider }
  });
  return updated;
}

module.exports = {
  providerIncidentService: { listProviderIncidents, transitionIncident }
};
