'use strict';

const { apiKeyService } = require('../services/apiKeyService');
const { apiKeyCreateSchema } = require('../schemas/apiKeySchemas');

async function listApiKeysController(request, response) {
  response.json({ keys: await apiKeyService.list({ userId: request.auth.userId, organizationId: request.auth.organizationId }) });
}

async function createApiKeyController(request, response) {
  const input = apiKeyCreateSchema.parse(request.body || {});
  response.status(201).json(await apiKeyService.create({
    ...input,
    userId: request.auth.userId,
    organizationId: request.auth.organizationId,
    actorId: request.auth.actorId
  }));
}

async function revokeApiKeyController(request, response) {
  response.json(await apiKeyService.revoke({
    userId: request.auth.userId,
    organizationId: request.auth.organizationId,
    actorId: request.auth.actorId,
    keyId: request.params.id
  }));
}

async function rotateApiKeyController(request, response) {
  response.json(await apiKeyService.rotate({
    userId: request.auth.userId,
    organizationId: request.auth.organizationId,
    actorId: request.auth.actorId,
    keyId: request.params.id
  }));
}

module.exports = {
  listApiKeysController,
  createApiKeyController,
  revokeApiKeyController,
  rotateApiKeyController
};
