'use strict';

const { z } = require('zod');

const API_KEY_SCOPES = [
  'payments:read', 'payments:write', 'payouts:read', 'payouts:write',
  'refunds:read', 'refunds:write', 'invoices:read', 'invoices:write',
  'transactions:read', 'providers:read', 'providers:write', 'reports:read',
  'webhooks:read', 'webhooks:write', 'organization:read', 'organization:write'
];

const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).max(API_KEY_SCOPES.length)
}).strict();

module.exports = { API_KEY_SCOPES, apiKeyCreateSchema };
