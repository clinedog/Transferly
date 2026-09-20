'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireOrganizationPermission } = require('../middleware/requireOrganizationPermission');

function runMiddleware(request, permission) {
  return new Promise((resolve) => {
    requireOrganizationPermission(permission)(request, {}, (error) => resolve(error));
  });
}

test('allows personal requests without organization context', async () => {
  assert.equal(await runMiddleware({ auth: { userId: 'user_123' } }, 'CREATE_PAYOUT'), undefined);
});

test('rejects organization requests without the required permission', async () => {
  const error = await runMiddleware({
    auth: {
      organizationId: 'org_123',
      organizationPermissions: ['VIEW_TRANSACTIONS']
    }
  }, 'CREATE_PAYOUT');

  assert.equal(error.code, 'ORGANIZATION_PERMISSION_REQUIRED');
  assert.equal(error.statusCode, 403);
});

test('allows organization requests with the required permission', async () => {
  assert.equal(await runMiddleware({
    organizationContext: { organization: { id: 'org_123' } },
    auth: {
      organizationPermissions: ['CREATE_INVOICE']
    }
  }, 'CREATE_INVOICE'), undefined);
});
