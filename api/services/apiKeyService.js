'use strict';

const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { apiKeyRepository } = require('../repositories/apiKeyRepository');
const { auditLogService } = require('./auditLogService');
const { AppError } = require('../utils/errors');

function hashSecret(secret) {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function generateSecret() {
  const secret = `tl_live_${randomBytes(32).toString('base64url')}`;
  return { secret, prefix: secret.slice(0, 16) };
}

function publicKey(apiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.keyPrefix,
    organizationId: apiKey.organizationId,
    scopes: apiKey.scopes,
    status: apiKey.status,
    lastUsedAt: apiKey.lastUsedAt,
    createdAt: apiKey.createdAt,
    revokedAt: apiKey.revokedAt
  };
}

async function create({ userId, actorId, organizationId = null, name, scopes, repository = apiKeyRepository, audit = auditLogService }) {
  const { secret, prefix } = generateSecret();
  const key = await repository.create({
    id: randomUUID(), userId, organizationId, name, scopes, keyPrefix: prefix, secretHash: hashSecret(secret)
  });
  await audit.log({
    actorType: 'user', actorId, action: 'api_key.created',
    entityType: 'api_key', entityId: key.id, metadata: { name, scopes, organizationId }
  });
  return { key: publicKey(key), secret };
}

async function list({ userId, organizationId = null, repository = apiKeyRepository }) {
  return (await repository.listForUser(userId, organizationId)).map(publicKey);
}

async function revoke({ userId, actorId, organizationId = null, keyId, repository = apiKeyRepository, audit = auditLogService }) {
  const current = await repository.findById(keyId);
  if (
    !current ||
    current.userId !== userId ||
    current.status !== 'active' ||
    (current.organizationId && current.organizationId !== organizationId)
  ) {
    throw new AppError(404, 'API_KEY_NOT_FOUND', 'API key not found or already revoked.');
  }
  const changed = await repository.revoke(keyId, userId, organizationId);
  if (!changed) throw new AppError(404, 'API_KEY_NOT_FOUND', 'API key not found or already revoked.');
  await audit.log({
    actorType: 'user', actorId, action: 'api_key.revoked',
    entityType: 'api_key', entityId: keyId, metadata: {}
  });
  return { id: keyId, status: 'revoked' };
}

async function authenticate(secret) {
  const key = await apiKeyRepository.findBySecretHash(hashSecret(secret));
  if (!key) return null;
  await apiKeyRepository.markUsed(key.id);
  return key;
}

async function rotate({ userId, actorId, organizationId = null, keyId, repository = apiKeyRepository, audit = auditLogService }) {
  const current = await repository.findById(keyId);
  if (!current || current.userId !== userId || current.organizationId !== organizationId || current.status !== 'active') {
    throw new AppError(404, 'API_KEY_NOT_FOUND', 'API key not found or already revoked.');
  }
  const { secret, prefix } = generateSecret();
  const replacement = await repository.create({
    id: randomUUID(),
    userId,
    organizationId,
    name: current.name,
    scopes: current.scopes,
    keyPrefix: prefix,
    secretHash: hashSecret(secret),
    rotatedFromId: current.id
  });
  const revoked = await repository.revoke(current.id, userId, organizationId);
  if (!revoked) throw new AppError(409, 'API_KEY_ROTATION_CONFLICT', 'API key changed during rotation.');
  await audit.log({
    actorType: 'user', actorId, action: 'api_key.rotated',
    entityType: 'api_key', entityId: replacement.id, metadata: { rotatedFromId: current.id }
  });
  return { key: publicKey(replacement), secret };
}

module.exports = { apiKeyService: { authenticate, create, list, revoke, rotate } };
