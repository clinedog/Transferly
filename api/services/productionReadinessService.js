'use strict';

const config = require('../config');
const { opsService } = require('./opsService');
const { providerHealthService } = require('./providerHealthService');
const { providerReadinessReportService } = require('./providerReadinessReportService');
const { recoveryReadinessService } = require('./recoveryReadinessService');

const STATUS = Object.freeze({
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
  NOT_CONFIGURED: 'NOT_CONFIGURED'
});

function check(name, status, detail, category) {
  return { name, status, detail, category };
}

async function buildReport({ requestId = null, correlationId = null } = {}) {
  const checks = [
    check('Environment', config.NODE_ENV === 'production' ? STATUS.PASS : STATUS.WARN, `Running in ${config.NODE_ENV}.`, 'environment'),
    check('Queue mode', config.INLINE_QUEUE_MODE ? STATUS.WARN : STATUS.PASS, config.INLINE_QUEUE_MODE ? 'Inline queue mode is enabled; use Redis-backed workers in production.' : 'Redis-backed queue mode is enabled.', 'queues'),
    check('Rate limiting', config.API_RATE_LIMIT_MAX > 0 && config.AUTH_RATE_LIMIT_MAX > 0 ? STATUS.PASS : STATUS.FAIL, 'API and authentication rate limits are configured.', 'security')
  ];
  const recovery = recoveryReadinessService.buildRecoveryReadiness();
  checks.push(check('Backups and recovery', recovery.status === 'READY' ? STATUS.PASS : recovery.status === 'FAIL' ? STATUS.FAIL : STATUS.WARN, recovery.status === 'READY' ? 'Backup location and restore verification evidence are configured.' : recovery.nextActions[0], 'recovery'));

  const [diagnostics, providers] = await Promise.all([
    opsService.getOperationalDiagnostics({ requestId, correlationId }),
    Promise.all([
      providerHealthService.getProviderHealthReport(),
      providerReadinessReportService.listProviderReadinessReport()
    ])
  ]);

  checks.push(
    check('Queues', diagnostics.queues.status === 'available' && diagnostics.queues.failedJobs === 0 ? STATUS.PASS : STATUS.WARN, diagnostics.queues.status === 'available' ? `${diagnostics.queues.failedJobs} failed jobs, ${diagnostics.queues.deadLetterWaiting} dead-letter jobs waiting.` : 'Queue diagnostics unavailable.', 'queues'),
    check('Outbox', diagnostics.outbox.status === 'available' && Number(diagnostics.outbox.counts?.failed || 0) === 0 ? STATUS.PASS : STATUS.WARN, diagnostics.outbox.status === 'available' ? `${Number(diagnostics.outbox.counts?.failed || 0)} terminal outbox failures.` : 'Outbox diagnostics unavailable.', 'reliability')
  );

  const [healthReport, readinessReport] = providers;
  const unhealthyProviders = healthReport.data.filter((provider) => ['degraded', 'critical'].includes(provider.status));
  const unreadyProviders = readinessReport.filter(({ readiness }) => readiness.status === 'not_configured' || readiness.ready === false);
  const providerStatus = unreadyProviders.length === readinessReport.length && readinessReport.length > 0
    ? STATUS.NOT_CONFIGURED
    : unhealthyProviders.length || unreadyProviders.length
      ? STATUS.WARN
      : STATUS.PASS;
  checks.push(
    check('Providers', providerStatus, `${unhealthyProviders.length} unhealthy and ${unreadyProviders.length} not-ready provider(s).`, 'providers'),
    check('Reconciliation', diagnostics.degradedReasons.includes('outbox_terminal_failures_present') ? STATUS.WARN : STATUS.PASS, 'Reconciliation and outbox signals are included in operational diagnostics.', 'financial')
  );

  const failures = checks.filter((item) => item.status === STATUS.FAIL);
  const warnings = checks.filter((item) => [STATUS.WARN, STATUS.NOT_CONFIGURED].includes(item.status));
  return {
    generatedAt: new Date().toISOString(),
    status: failures.length ? 'NOT_READY' : warnings.length ? 'READY_WITH_WARNINGS' : 'READY',
    checks,
    summary: { pass: checks.filter((item) => item.status === STATUS.PASS).length, warn: warnings.length, fail: failures.length },
    providerHealth: healthReport.data,
    providerReadiness: readinessReport
    ,recovery
  };
}

module.exports = {
  productionReadinessService: { buildReport },
  STATUS
};
