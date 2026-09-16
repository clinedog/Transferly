'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { apiKeyService } = require('../services/apiKeyService');

test('API keys retain organization binding through creation and rotation', async () => {
  const records = new Map();
  const repository = {
    async create(data) {
      const record = {
        id: data.id,
        userId: data.userId,
        organizationId: data.organizationId,
        name: data.name,
        keyPrefix: data.keyPrefix,
        scopes: data.scopes,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      records.set(record.id, record);
      return record;
    },
    async findById(id) {
      return records.get(id);
    },
    async revoke(id, userId, organizationId) {
      const record = records.get(id);
      if (!record || record.userId !== userId || record.organizationId !== organizationId) return false;
      record.status = 'revoked';
      return true;
    }
  };
  const audit = { async log() {} };

  const created = await apiKeyService.create({
    userId: 'user-1',
    actorId: 'user-1',
    organizationId: 'org-1',
    name: 'Org key',
    scopes: ['transactions:read'],
    repository,
    audit
  });
  assert.equal(created.key.organizationId, 'org-1');

  const rotated = await apiKeyService.rotate({
    userId: 'user-1',
    actorId: 'user-1',
    organizationId: 'org-1',
    keyId: created.key.id,
    repository,
    audit
  });
  assert.equal(rotated.key.organizationId, 'org-1');
  assert.equal(records.get(created.key.id).status, 'revoked');
});
