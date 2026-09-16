'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('API key creation returns secret once and never returns its hash', async () => {
  let auditEntry;
  const key = await require('../services/apiKeyService').apiKeyService.create({
    userId: 'user-1',
    actorId: 'user-1',
    name: 'Production',
    scopes: ['payments:read'],
    repository: {
      async create(data) {
        return {
          id: data.id,
          name: data.name,
          keyPrefix: data.keyPrefix,
          secretHash: data.secretHash,
          scopes: data.scopes,
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z'
        };
      }
    },
    audit: {
      async log(entry) {
        auditEntry = entry;
      }
    }
  });

  assert.match(key.secret, /^tl_live_/);
  assert.equal(key.key.name, 'Production');
  assert.deepEqual(key.key.scopes, ['payments:read']);
  assert.equal(Object.hasOwn(key, 'secretHash'), false);
  assert.equal(Object.hasOwn(key.key, 'secretHash'), false);
  assert.ok(auditEntry);
  assert.equal(auditEntry.action, 'api_key.created');
});
