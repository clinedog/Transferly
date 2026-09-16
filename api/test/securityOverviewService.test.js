'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { securityOverviewService } = require('../services/securityOverviewService');

const config = {
  ADMIN_API_TOKEN: 'admin-token',
  JWT_SECRET: 'jwt-secret',
  AUTH_RATE_LIMIT_WINDOW_MS: 60000,
  AUTH_RATE_LIMIT_MAX: 10,
  API_RATE_LIMIT_WINDOW_MS: 60000,
  API_RATE_LIMIT_MAX: 100,
  PAYPAL_WEBHOOK_ID: 'webhook-id'
};

function dependencies({ securityEvents = [], providers = [] } = {}) {
  return {
    configSource: config,
    sessionRepository: {
      async getSecuritySummary() {
        return { active: 2, revoked: 1, expired: 3 };
      }
    },
    auditService: {
      async list() {
        return [
          ...securityEvents,
          { id: 'audit-non-security', action: 'invoice.created', actorType: 'system', createdAt: '2026-01-01T00:00:00.000Z', entityType: 'invoice' }
        ];
      }
    },
    readinessReportService: {
      async listProviderReadinessReport() {
        return providers;
      }
    }
  };
}

test('security overview reports healthy posture when controls and evidence are present', async () => {
  const overview = await securityOverviewService.getOverview(dependencies({
    securityEvents: [
      { id: 'audit-login', action: 'auth.login', actorType: 'user', createdAt: '2026-01-01T00:00:00.000Z', entityType: 'session' }
    ],
    providers: [
      { readiness: { configuration: { configured: true } } }
    ]
  }));

  assert.equal(overview.status, 'HEALTHY');
  assert.deepEqual(overview.sessions, { active: 2, revoked: 1, expired: 3 });
  assert.equal(overview.providerCredentialPosture.missingCredentials, 0);
  assert.equal(overview.recentSecurityEvents.length, 1);
  assert.equal(overview.controls.webhookVerification, true);
});

test('security overview requires attention when credentials or security evidence are missing', async () => {
  const overview = await securityOverviewService.getOverview(dependencies({
    providers: [
      { readiness: { configuration: { configured: false } } }
    ]
  }));

  assert.equal(overview.status, 'NEEDS_ATTENTION');
  assert.equal(overview.providerCredentialPosture.missingCredentials, 1);
  assert.deepEqual(overview.recentSecurityEvents, []);
});
