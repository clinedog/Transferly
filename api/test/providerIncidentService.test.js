'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { providerIncidentService } = require('../services/providerIncidentService');

test('provider incidents allow only ordered lifecycle transitions and audit them', async () => {
  let auditEntry;
  const updated = await providerIncidentService.transitionIncident({
    incidentId: 'incident-1',
    status: 'MITIGATED',
    adminActorId: 'admin-1',
    repository: {
      async findById() {
        return { id: 'incident-1', provider: 'paypal', status: 'INVESTIGATING' };
      },
      async transition(id, status) {
        return { id, provider: 'paypal', status };
      }
    },
    audit: {
      async log(entry) {
        auditEntry = entry;
      }
    }
  });

  assert.deepEqual(updated, { id: 'incident-1', provider: 'paypal', status: 'MITIGATED' });
  assert.equal(auditEntry.action, 'provider_incident.transitioned');
});

test('provider incidents reject invalid lifecycle transitions', async () => {
  await assert.rejects(
    providerIncidentService.transitionIncident({
      incidentId: 'incident-1',
      status: 'CLOSED',
      adminActorId: 'admin-1',
      repository: { async findById() { return { id: 'incident-1', status: 'DETECTED' }; } }
    }),
    (error) => error.code === 'PROVIDER_INCIDENT_INVALID_TRANSITION'
  );
});

test('provider incidents support explicit acknowledgement before investigation', async () => {
  const transitions = [];
  const updated = await providerIncidentService.transitionIncident({
    incidentId: 'incident-ack',
    status: 'ACKNOWLEDGED',
    adminActorId: 'admin-1',
    repository: {
      async findById() {
        return { id: 'incident-ack', provider: 'paypal', status: 'DETECTED' };
      },
      async transition(id, status) {
        transitions.push([id, status]);
        return { id, provider: 'paypal', status };
      }
    },
    audit: { async log() {} }
  });

  assert.deepEqual(updated, { id: 'incident-ack', provider: 'paypal', status: 'ACKNOWLEDGED' });
  assert.deepEqual(transitions, [['incident-ack', 'ACKNOWLEDGED']]);
});
