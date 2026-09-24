'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { notificationPreferencesService } = require('../services/notificationPreferencesService');

test('notification preferences merge categories and emit a non-sensitive audit event', async () => {
  let auditEntry;
  const result = await notificationPreferencesService.updatePreferences({
    userId: 'user-1',
    categories: { funding: false },
    repository: {
      async upsertForUser(userId, preferences) {
        assert.equal(userId, 'user-1');
        assert.deepEqual(preferences, { channels: undefined, categories: { funding: false } });
        return {
          channels: { in_app: true, telegram: true, email: false, webhook: false },
          categories: { funding: false, operations: true, security: true },
          updatedAt: '2026-09-23T00:00:00.000Z'
        };
      }
    },
    audit: { async log(entry) { auditEntry = entry; } }
  });

  assert.equal(result.categories.funding, false);
  assert.equal(auditEntry.action, 'notification_preferences.updated');
  assert.deepEqual(auditEntry.metadata.categories, result.categories);
  assert.equal(auditEntry.metadata.userId, undefined);
});

test('notification preference reads stay scoped to the authenticated user', async () => {
  let receivedUserId;
  await notificationPreferencesService.getPreferences({
    userId: 'user-2',
    repository: { async getForUser(userId) { receivedUserId = userId; return { categories: {} }; } }
  });
  assert.equal(receivedUserId, 'user-2');
});
