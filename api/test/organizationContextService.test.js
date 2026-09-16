'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { organizationContextService } = require('../services/organizationContextService');

test('organization context keeps individual users scoped to their own workspace', () => {
  const context = organizationContextService.buildContext({
    user: { id: 'user-1', displayName: 'Ada', status: 'active', isAdmin: false },
    profile: { role: 'USER', name: 'Ada' }
  });

  assert.equal(context.mode, 'individual');
  assert.equal(context.organization.id, 'user-1');
  assert.equal(context.organization.role, 'USER');
  assert.deepEqual(context.organization.permissions, []);
  assert.equal(context.tenantIsolation.multiOrganizationMembership, false);
  assert.equal(context.tenantIsolation.enforcedBy, 'authenticated-user-scope');
});

test('organization context derives elevated permissions from server role claims', () => {
  const context = organizationContextService.buildContext({
    user: { id: 'owner-1', displayName: 'Owner', status: 'active' },
    profile: { role: 'OWNER', name: 'Owner' }
  });

  assert.equal(context.organization.role, 'OWNER');
  assert.ok(context.organization.permissions.includes('roles:manage'));
  assert.ok(context.organization.permissions.includes('system:manage'));
});
