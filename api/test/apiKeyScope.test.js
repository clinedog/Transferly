'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { requireApiKeyScope } = require('../middleware/requireApiKeyScope');

function invoke(auth, method, scope) {
  let error;
  requireApiKeyScope(scope)({ auth, method }, {}, (nextError) => { error = nextError; });
  return error;
}

test('API keys must carry the resource scope matching the HTTP operation', () => {
  assert.equal(invoke({ method: 'api_key', apiKeyScopes: ['invoices:read'] }, 'GET', 'invoices'), undefined);
  assert.equal(invoke({ method: 'api_key', apiKeyScopes: ['invoices:read'] }, 'POST', 'invoices').code, 'API_KEY_SCOPE_REQUIRED');
  assert.equal(invoke({ method: 'api_key', apiKeyScopes: ['invoices:write'] }, 'GET', 'invoices').code, 'API_KEY_SCOPE_REQUIRED');
});

test('JWT and admin authentication retain existing route behavior', () => {
  assert.equal(invoke({ method: 'jwt', apiKeyScopes: [] }, 'POST', 'payouts'), undefined);
  assert.equal(invoke({ method: 'admin_api_token' }, 'GET', 'providers'), undefined);
});
