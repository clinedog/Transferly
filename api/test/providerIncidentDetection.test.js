'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { providerIncidentService } = require('../services/providerIncidentService');

test('provider incident detection ignores one-off webhook failures and issues', async () => {
  const incidents = await providerIncidentService.listProviderIncidents({
    healthService: {
      async getProviderHealthReport() {
        return { data: [{
          provider: 'paypal',
          display_name: 'PayPal',
          status: 'watch',
          failed_webhooks: 1,
          recent_webhooks: 4,
          reasons: [],
          next_actions: []
        }] };
      }
    },
    issueService: {
      async listIssues({ status }) {
        return status === 'OPEN'
          ? [{ id: 'issue-1', metadata: { provider: 'paypal' }, severity: 'LOW' }]
          : [];
      }
    },
    repository: {
      async upsertActive() {},
      async list() { return []; }
    },
    thresholds: {
      PROVIDER_INCIDENT_FAILED_WEBHOOK_THRESHOLD: 3,
      PROVIDER_INCIDENT_OPEN_ISSUE_THRESHOLD: 2
    }
  });

  assert.deepEqual(incidents, []);
});

test('provider incident detection creates an incident after configurable thresholds', async () => {
  const created = [];
  const incidents = await providerIncidentService.listProviderIncidents({
    healthService: {
      async getProviderHealthReport() {
        return { data: [{
          provider: 'paypal',
          display_name: 'PayPal',
          status: 'degraded',
          failed_webhooks: 3,
          recent_webhooks: 5,
          reasons: ['Repeated webhook failures.'],
          next_actions: ['Replay safe failures.']
        }] };
      }
    },
    issueService: {
      async listIssues() {
        return [];
      }
    },
    repository: {
      async upsertActive(incident) {
        created.push(incident);
      },
      async list() { return created; }
    },
    thresholds: {
      PROVIDER_INCIDENT_FAILED_WEBHOOK_THRESHOLD: 3,
      PROVIDER_INCIDENT_OPEN_ISSUE_THRESHOLD: 2
    }
  });

  assert.equal(incidents[0].status, 'DETECTED');
  assert.equal(incidents[0].evidence.failed_webhooks, 3);
  assert.equal(created[0].runbookKey, 'provider-paypal-incident');
  assert.equal(created[0].runbookUrl, '/miniapp/ops?runbook=provider-paypal-incident');
  assert.equal(created[0].ownerRole, 'operations');
});
