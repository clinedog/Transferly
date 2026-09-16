'use strict';

const { API_PREFIXES } = require('./routes');

const ROUTE_GROUPS = Object.freeze([
  'bootstrap',
  'me',
  'workspace',
  'auth',
  'user',
  'receipt',
  'services',
  'email',
  'referral',
  'telegram',
  'providers',
  'invoices',
  'orders',
  'assets',
  'payouts',
  'admin',
  'marketplace',
  'wallet-links'
]);

function buildOpenApiDocument({ baseUrl } = {}) {
  const paths = {};
  API_PREFIXES.forEach((prefix) => {
    ROUTE_GROUPS.forEach((group) => {
      paths[`${prefix}/${group}`] = {
        'x-transferly-route-group': group,
        'x-transferly-route-source': 'mounted Express router; inspect route validators for method and schema details'
      };
    });
  });

  return {
    openapi: '3.0.3',
    info: {
      title: 'Transferly API',
      version: process.env.RELEASE_VERSION || '1.0.0',
      description: 'Authoritative route inventory for the mounted Transferly API. Detailed request schemas remain owned by the route validators.'
    },
    servers: baseUrl ? [{ url: baseUrl }] : [],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        adminBearerAuth: { type: 'http', scheme: 'bearer', description: 'Required for /admin routes.' }
      }
    },
    'x-transferly-api-versioning': {
      current: '/api/v1',
      compatibility: '/api remains supported as a compatibility alias.'
    },
    'x-transferly-financial-safety': {
      idempotency: 'Financial mutations require the existing Idempotency-Key contract where enforced by the route.',
      sourceOfTruth: 'The internal ledger remains authoritative; provider status alone is not financial truth.'
    }
  };
}

module.exports = { buildOpenApiDocument };
