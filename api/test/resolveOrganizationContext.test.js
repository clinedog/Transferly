'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveOrganizationContext } = require('../middleware/resolveOrganizationContext');

test('does not resolve organization context when header is absent', async () => {
  let nextCalls = 0;
  await new Promise((resolve, reject) => {
    resolveOrganizationContext({ headers: {}, auth: null }, {}, (error) => {
      try {
        assert.equal(error, undefined);
        nextCalls += 1;
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    });
  });
  assert.equal(nextCalls, 1);
});

test('rejects organization context on API-key requests', async () => {
  await new Promise((resolve, reject) => {
    resolveOrganizationContext({
      headers: { 'x-organization-id': 'org_123' },
      auth: { userId: 'user_123', method: 'api_key' }
    }, {}, (error) => {
      try {
        assert.equal(error.code, 'ORGANIZATION_CONTEXT_MISMATCH');
        assert.equal(error.statusCode, 403);
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    });
  });
});

test('attaches the authorized organization context to the request', async () => {
  const request = {
    headers: { 'x-organization-id': 'org_123' },
    auth: { userId: 'user_123', method: 'jwt' }
  };
  const context = {
    organization: { id: 'org_123', role: 'VIEWER' },
    permissions: ['VIEW_TRANSACTIONS']
  };
  const originalResolveContext = require('../services/organizationService').organizationService.resolveContext;
  require('../services/organizationService').organizationService.resolveContext = async () => context;

  try {
    await new Promise((resolve, reject) => {
      resolveOrganizationContext(request, {}, (error) => {
        try {
          assert.equal(error, undefined);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      });
    });
    assert.equal(request.organizationContext, context);
    assert.equal(request.auth.organizationId, 'org_123');
    assert.deepEqual(request.auth.organizationPermissions, ['VIEW_TRANSACTIONS']);
  } finally {
    require('../services/organizationService').organizationService.resolveContext = originalResolveContext;
  }
});
