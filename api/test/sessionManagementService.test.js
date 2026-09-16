'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sessionManagementService } = require('../services/sessionManagementService');

test('session listing exposes safe metadata and marks the current session', async () => {
  const sessions = await sessionManagementService.list({
    userId: 'user-1',
    currentSessionId: 'session-2',
    repository: {
      async listForUser() {
        return [{
          id: 'session-2',
          status: 'active',
          currentTokenId: 'secret-token-id',
          telegramUserId: 'private-telegram-id',
          createdAt: '2026-01-01T00:00:00.000Z',
          expiresAt: '2026-01-02T00:00:00.000Z',
          lastRefreshedAt: null,
          revokedAt: null
        }];
      }
    }
  });

  assert.deepEqual(sessions, [{
    id: 'session-2',
    status: 'active',
    isCurrent: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-02T00:00:00.000Z',
    lastRefreshedAt: null,
    revokedAt: null
  }]);
  assert.equal(Object.hasOwn(sessions[0], 'currentTokenId'), false);
  assert.equal(Object.hasOwn(sessions[0], 'telegramUserId'), false);
});

test('session revocation is scoped to the authenticated user and audited', async () => {
  let auditEntry;
  const result = await sessionManagementService.revoke({
    userId: 'user-1',
    actorId: 'user-1',
    sessionId: 'session-2',
    repository: {
      async revokeForUser(id, userId, reason) {
        assert.equal(id, 'session-2');
        assert.equal(userId, 'user-1');
        assert.equal(reason, 'user_session_management');
        return true;
      }
    },
    audit: {
      async log(entry) {
        auditEntry = entry;
      }
    }
  });

  assert.deepEqual(result, { id: 'session-2', status: 'revoked' });
  assert.equal(auditEntry.action, 'session.revoked');
});
