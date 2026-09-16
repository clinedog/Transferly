'use strict';

const { authSessionRepository } = require('../repositories/authSessionRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');

function publicSession(session, currentSessionId) {
  return {
    id: session.id,
    status: session.status,
    isCurrent: session.id === currentSessionId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    lastRefreshedAt: session.lastRefreshedAt,
    revokedAt: session.revokedAt
  };
}

async function list({ userId, currentSessionId, repository = authSessionRepository }) {
  const sessions = await repository.listForUser(userId);
  return sessions.map((session) => publicSession(session, currentSessionId));
}

async function revoke({ userId, actorId, sessionId, repository = authSessionRepository, audit = auditLogService }) {
  const revoked = await repository.revokeForUser(sessionId, userId, 'user_session_management');
  if (!revoked) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found or already revoked.');
  }
  await audit.log({
    actorType: 'user',
    actorId,
    action: 'session.revoked',
    entityType: 'auth_session',
    entityId: sessionId,
    metadata: { reason: 'user_session_management' }
  });
  return { id: sessionId, status: 'revoked' };
}

module.exports = { sessionManagementService: { list, revoke } };
