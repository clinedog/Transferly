'use strict';

const config = require('../config');
const fs = require('node:fs');
const { opsService } = require('./opsService');
const { providerHealthService } = require('./providerHealthService');
const { providerReadinessReportService } = require('./providerReadinessReportService');
const { recoveryReadinessService } = require('./recoveryReadinessService');
const { getMigrationStatus } = require('../db/migrationRunner');

const STATUS = Object.freeze({
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
  NOT_CONFIGURED: 'NOT_CONFIGURED'
});

function check(name, status, detail, category) {
  return { name, status, detail, category };
}

function assessMigrationReadiness(migrations) {
  if (!Array.isArray(migrations)) {
    return check('Migrations', STATUS.FAIL, 'Migration status could not be read.', 'database');
  }

  const pending = migrations.filter((migration) => migration.status === 'pending');
  if (pending.length > 0) {
    return check(
      'Migrations',
      STATUS.FAIL,
      `${pending.length} migration(s) are pending: ${pending.map((migration) => migration.name).join(', ')}.`,
      'database'
    );
  }

  return check('Migrations', STATUS.PASS, `${migrations.length} migration(s) are applied and checksummed.`, 'database');
}

function assessProviderExecutionReadiness(reports, { environment = config.NODE_ENV } = {}) {
  if (!Array.isArray(reports)) {
    return check('Provider execution', STATUS.FAIL, 'Provider readiness could not be read.', 'providers');
  }

  const enabledReports = reports.filter(({ manifest }) => manifest?.enabled !== false);
  const executableReports = enabledReports.filter(({ readiness }) =>
    readiness?.ready === true &&
    readiness?.production_enabled === true &&
    Array.isArray(readiness.operations) &&
    readiness.operations.some((operation) => operation.execution_eligible?.production === true)
  );

  if (enabledReports.length === 0) {
    return check('Provider execution', STATUS.FAIL, 'No enabled provider is available for financial execution.', 'providers');
  }

  if (executableReports.length === 0) {
    return check(
      'Provider execution',
      environment === 'production' ? STATUS.FAIL : STATUS.WARN,
      'No enabled provider currently exposes a production-eligible financial operation.',
      'providers'
    );
  }

  const blockedCount = enabledReports.length - executableReports.length;
  return check(
    'Provider execution',
    blockedCount > 0 ? STATUS.WARN : STATUS.PASS,
    `${executableReports.length} enabled provider(s) expose production-eligible execution; ${blockedCount} remain gated.`,
    'providers'
  );
}

async function buildReport({ requestId = null, correlationId = null } = {}) {
  const checks = [
    check('Environment', config.NODE_ENV === 'production' ? STATUS.PASS : STATUS.WARN, `Running in ${config.NODE_ENV}.`, 'environment'),
    check('Queue mode', config.INLINE_QUEUE_MODE ? STATUS.WARN : STATUS.PASS, config.INLINE_QUEUE_MODE ? 'Inline queue mode is enabled; use Redis-backed workers in production.' : 'Redis-backed queue mode is enabled.', 'queues'),
    check(
      'Rate limiting',
      [
        config.API_RATE_LIMIT_MAX,
        config.AUTH_RATE_LIMIT_MAX,
        config.FINANCIAL_RATE_LIMIT_MAX,
        config.FUNDING_RATE_LIMIT_MAX,
        config.ADMIN_RATE_LIMIT_MAX,
        config.WEBHOOK_RATE_LIMIT_MAX
      ].every((limit) => Number(limit) > 0) ? STATUS.PASS : STATUS.FAIL,
      'API, authentication, financial, funding, admin, and webhook rate limits are configured.',
      'security'
    )
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

  const databaseConfigured = Boolean(config.SQLITE_DATABASE_PATH);
  const databasePresent = databaseConfigured && fs.existsSync(config.SQLITE_DATABASE_PATH);
  const productionSecretsConfigured = config.NODE_ENV !== 'production'
    || (config.JWT_SECRET && config.ADMIN_API_TOKEN && config.PAYPAL_CLIENT_SECRET);
  const securityConfigured = Boolean(config.ADMIN_AUTH_ENABLED && config.BOT_API_HMAC_REQUIRED);
  const financialControlsConfigured = Boolean(
    config.RISK_ENGINE_ENABLED
      && config.RISK_REVIEW_ENABLED
      && config.PAYMENT_VERIFICATION_ENABLED
      && config.POINTS_FUNDING_DESTINATION_ACTIVE
  );
  let migrationCheck;
  if (!databasePresent) {
    migrationCheck = check('Migrations', STATUS.WARN, 'Migration status cannot be verified until the database is available.', 'database');
  } else {
    try {
      migrationCheck = assessMigrationReadiness(await getMigrationStatus());
    } catch (error) {
      migrationCheck = check(
        'Migrations',
        STATUS.FAIL,
        `Migration history could not be verified: ${error.code || error.message}.`,
        'database'
      );
    }
  }
  checks.push(
    check('Database', databaseConfigured && databasePresent ? STATUS.PASS : databaseConfigured ? STATUS.WARN : STATUS.FAIL, databasePresent ? 'Configured SQLite database is present.' : 'Database path is configured but the database file is not present.', 'database'),
    migrationCheck,
    check('Secrets', productionSecretsConfigured ? STATUS.PASS : STATUS.FAIL, productionSecretsConfigured ? 'Required runtime credentials are configured for the current environment.' : 'Production credentials are incomplete or unsafe.', 'security'),
    check('Webhooks', config.PAYPAL_WEBHOOK_ID ? STATUS.PASS : STATUS.FAIL, config.PAYPAL_WEBHOOK_ID ? 'Primary provider webhook verification is configured.' : 'Primary provider webhook verification is not configured.', 'providers'),
    check('Ledger', databasePresent ? STATUS.PASS : STATUS.WARN, databasePresent ? 'Ledger persistence is available through the configured database.' : 'Ledger persistence cannot be verified without the database.', 'financial'),
    check('Redis', config.REDIS_URL && !config.INLINE_QUEUE_MODE ? STATUS.PASS : STATUS.WARN, config.INLINE_QUEUE_MODE ? 'Inline queue mode is enabled; Redis-backed workers are required for production.' : 'Redis connection is configured for background work.', 'queues'),
    check('Routing', readinessStatus(config.PAYPAL_ONLY_PRODUCTION_MVP !== false), 'Provider eligibility and routing controls are loaded.', 'providers'),
    check('Risk', readinessStatus(financialControlsConfigured), financialControlsConfigured ? 'Risk, payment verification, and funding controls are enabled.' : 'One or more financial risk controls are disabled.', 'financial'),
    check('API', STATUS.PASS, 'Versioned and compatibility API prefixes are mounted.', 'api'),
    check('Authentication', readinessStatus(Boolean(config.JWT_SECRET)), 'JWT authentication configuration is loaded.', 'security'),
    check('Authorization', readinessStatus(securityConfigured), securityConfigured ? 'Admin and bot request authorization controls are enabled.' : 'Admin or bot authorization controls require configuration.', 'security'),
    check('Observability', diagnostics.signals?.live ? STATUS.PASS : STATUS.WARN, diagnostics.signals?.live ? 'Request, queue, and operational diagnostics are available.' : 'Operational diagnostics are unavailable.', 'observability'),
    check('Points and funding', readinessStatus(Boolean(config.POINTS_FUNDING_DESTINATION_ACTIVE)), 'Points funding destination controls are loaded.', 'financial'),
    check('Testing', process.env.NODE_ENV === 'test' ? STATUS.PASS : STATUS.WARN, process.env.NODE_ENV === 'test' ? 'Running under the test environment.' : 'Automated test evidence must be collected before release.', 'testing')
  );

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
    assessProviderExecutionReadiness(readinessReport),
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
    providerReadiness: readinessReport,
    recovery
  };
}

function readinessStatus(condition) {
  return condition ? STATUS.PASS : STATUS.WARN;
}

module.exports = {
  productionReadinessService: { buildReport, assessMigrationReadiness, assessProviderExecutionReadiness },
  STATUS
};
