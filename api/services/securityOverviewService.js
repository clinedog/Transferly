'use strict';

const config = require('../config');
const { authSessionRepository } = require('../repositories/authSessionRepository');
const { auditLogService } = require('./auditLogService');
const { providerReadinessReportService } = require('./providerReadinessReportService');

const SECURITY_ACTIONS = ['login', 'logout', 'session', 'role', 'provider'];

function securityStatus({ missingProviderCredentials, auditCount }) {
  if (missingProviderCredentials > 0) return 'NEEDS_ATTENTION';
  if (auditCount === 0) return 'NEEDS_ATTENTION';
  return 'HEALTHY';
}

async function getOverview({
  configSource = config,
  sessionRepository = authSessionRepository,
  auditService = auditLogService,
  readinessReportService = providerReadinessReportService
} = {}) {
  const [sessions, auditLogs, providers] = await Promise.all([
    sessionRepository.getSecuritySummary(),
    auditService.list({ limit: 100 }),
    readinessReportService.listProviderReadinessReport()
  ]);
  const securityEvents = auditLogs.filter((entry) => SECURITY_ACTIONS.some((action) => entry.action.includes(action)));
  const missingProviderCredentials = providers.filter(({ readiness }) => readiness.configuration?.configured === false).length;
  return {
    generatedAt: new Date().toISOString(),
    status: securityStatus({ missingProviderCredentials, auditCount: securityEvents.length }),
    controls: {
      adminTokenConfigured: Boolean(configSource.ADMIN_API_TOKEN),
      jwtConfigured: Boolean(configSource.JWT_SECRET),
      authRateLimit: { windowMs: configSource.AUTH_RATE_LIMIT_WINDOW_MS, max: configSource.AUTH_RATE_LIMIT_MAX },
      apiRateLimit: { windowMs: configSource.API_RATE_LIMIT_WINDOW_MS, max: configSource.API_RATE_LIMIT_MAX },
      webhookVerification: Boolean(configSource.PAYPAL_WEBHOOK_ID)
    },
    sessions: {
      active: sessions.active || 0,
      revoked: sessions.revoked || 0,
      expired: sessions.expired || 0
    },
    providerCredentialPosture: {
      providersReviewed: providers.length,
      missingCredentials: missingProviderCredentials
    },
    recentSecurityEvents: securityEvents.slice(0, 25).map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorType: entry.actorType,
      createdAt: entry.createdAt,
      entityType: entry.entityType
    }))
  };
}

module.exports = { securityOverviewService: { getOverview } };
