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

  const resourcePath = (resource, tag) => ({
    get: {
      tags: [tag],
      summary: `List ${resource}`,
      parameters: [
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/PageSize' },
        { $ref: '#/components/parameters/OrganizationId' }
      ],
      responses: { 200: { $ref: '#/components/responses/Collection' }, ...errorResponses() }
    },
    post: {
      tags: [tag],
      summary: `Create ${resource.replace(/s$/, '')}`,
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
      requestBody: { $ref: '#/components/requestBodies/Resource' },
      responses: { 201: { $ref: '#/components/responses/Resource' }, ...errorResponses() }
    }
  });
  const detailPath = (resource, tag) => ({
    get: {
      tags: [tag],
      summary: `Get ${resource} by ID`,
      parameters: [{ $ref: '#/components/parameters/ResourceId' }],
      responses: { 200: { $ref: '#/components/responses/Resource' }, ...errorResponses() }
    }
  });
  const errorResponses = () => ({
    400: { $ref: '#/components/responses/BadRequest' },
    401: { $ref: '#/components/responses/Unauthorized' },
    403: { $ref: '#/components/responses/Forbidden' },
    404: { $ref: '#/components/responses/NotFound' },
    409: { $ref: '#/components/responses/Conflict' },
    429: { $ref: '#/components/responses/RateLimited' },
    500: { $ref: '#/components/responses/InternalError' }
  });
  Object.assign(paths, {
    '/api/v1/invoices': resourcePath('invoices', 'Invoices'),
    '/api/v1/invoices/{id}': detailPath('invoice', 'Invoices'),
    '/api/v1/invoices/payment-links': {
      get: {
        tags: ['Payment Links'],
        summary: 'List provider-backed hosted payment links',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          { $ref: '#/components/parameters/OrganizationId' }
        ],
        responses: { 200: { $ref: '#/components/responses/Collection' }, ...errorResponses() }
      }
    },
    '/api/v1/admin/finance/analytics.csv': {
      get: {
        tags: ['Admin Finance'],
        summary: 'Export authoritative finance analytics as CSV',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', '7d', '30d', '90d', 'custom'], default: '30d' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } }
        ],
        responses: {
          200: { description: 'CSV report', content: { 'text/csv': { schema: { type: 'string' } } } },
          ...errorResponses()
        }
      }
    },
    '/api/v1/admin/finance/analytics.pdf': {
      get: {
        tags: ['Admin Finance'],
        summary: 'Export authoritative finance analytics as PDF',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['today', '7d', '30d', '90d', 'custom'], default: '30d' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } }
        ],
        responses: {
          200: { description: 'PDF report', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          ...errorResponses()
        }
      }
    },
    '/api/v1/payouts': resourcePath('payouts', 'Payouts'),
    '/api/v1/payouts/{id}': detailPath('payout', 'Payouts'),
    '/api/v1/transactions': {
      get: {
        tags: ['Transactions'],
        summary: 'List authoritative ledger transactions',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          { $ref: '#/components/parameters/OrganizationId' }
        ],
        responses: { 200: { $ref: '#/components/responses/Collection' }, ...errorResponses() }
      }
    },
    '/api/v1/webhooks': {
      post: {
        tags: ['Webhooks'],
        summary: 'Receive a provider webhook',
        security: [],
        requestBody: { $ref: '#/components/requestBodies/Webhook' },
        responses: { 202: { $ref: '#/components/responses/Accepted' }, ...errorResponses() }
      }
    },
    '/api/v1/me/api-keys': {
      get: {
        tags: ['Developer'],
        summary: 'List the authenticated user API keys without secrets',
        security: [{ bearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/Collection' }, ...errorResponses() }
      },
      post: {
        tags: ['Developer'],
        summary: 'Create a scoped API key; the secret is returned once',
        security: [{ bearerAuth: [] }],
        requestBody: { $ref: '#/components/requestBodies/ApiKeyInput' },
        responses: { 201: { $ref: '#/components/responses/ApiKeyCreated' }, ...errorResponses() }
      }
    },
    '/api/v1/me/api-keys/{id}/rotate': {
      post: {
        tags: ['Developer'],
        summary: 'Rotate an API key and revoke its predecessor',
        security: [{ bearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/ApiKeyCreated' }, ...errorResponses() }
      }
    },
    '/api/v1/me/api-keys/{id}': {
      delete: {
        tags: ['Developer'],
        summary: 'Revoke an API key',
        security: [{ bearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/Resource' }, ...errorResponses() }
      }
    },
    '/api/v1/me/sessions': {
      get: {
        tags: ['Security'],
        summary: 'List authenticated user sessions without authentication secrets',
        security: [{ bearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/Collection' }, ...errorResponses() }
      }
    },
    '/api/v1/me/sessions/{id}': {
      delete: {
        tags: ['Security'],
        summary: 'Revoke an authenticated user session',
        security: [{ bearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/Resource' }, ...errorResponses() }
      }
    },
    '/api/v1/me/organizations': {
      get: {
        tags: ['Organizations'],
        summary: 'List organizations available to the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/Collection' }, ...errorResponses() }
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create an organization and assign the creator as owner',
        security: [{ bearerAuth: [] }],
        requestBody: { $ref: '#/components/requestBodies/OrganizationInput' },
        responses: { 201: { $ref: '#/components/responses/Resource' }, ...errorResponses() }
      }
    }
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
      },
      parameters: {
        ResourceId: { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        OrganizationId: { name: 'organization_id', in: 'query', schema: { type: 'string' } },
        Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        PageSize: { name: 'page_size', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
        IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 8, maxLength: 255 } }
      },
      requestBodies: {
        Resource: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResourceInput' } } }
        },
        Webhook: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookEvent' } } }
        },
        ApiKeyInput: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiKeyInput' } } }
        },
        OrganizationInput: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OrganizationInput' } } }
        }
      },
      responses: {
        Resource: { description: 'Authoritative resource response.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Resource' } } } },
        ApiKeyCreated: { description: 'API key metadata and one-time secret.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiKeyCreated' } } } },
        Collection: { description: 'Paginated resource collection.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Collection' } } } },
        Accepted: { description: 'Webhook accepted for idempotent processing.' },
        BadRequest: { description: 'Request validation failed.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        Unauthorized: { description: 'Authentication required.' },
        Forbidden: { description: 'Insufficient scope or organization permission.' },
        NotFound: { description: 'Resource not found.' },
        Conflict: { description: 'Idempotency or state conflict.' },
        RateLimited: { description: 'Rate limit exceeded.' },
        InternalError: { description: 'Unexpected server error.' }
      },
      schemas: {
        Resource: {
          type: 'object',
          required: ['id', 'status'],
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            organization_id: { type: 'string', nullable: true },
            provider_reference: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        ResourceInput: {
          type: 'object',
          additionalProperties: true,
          description: 'Resource-specific validated payload. Route schemas remain authoritative.'
        },
        ApiKeyInput: {
          type: 'object',
          required: ['name', 'scopes'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            scopes: { type: 'array', minItems: 1, items: { type: 'string' } }
          }
        },
        ApiKeyCreated: {
          type: 'object',
          required: ['key', 'secret'],
          properties: {
            key: { $ref: '#/components/schemas/Resource' },
            secret: { type: 'string', description: 'Returned only at creation or rotation.' }
          }
        },
        OrganizationInput: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: { name: { type: 'string', minLength: 1, maxLength: 120 } }
        },
        Collection: {
          type: 'object',
          required: ['data', 'pagination'],
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Resource' } },
            pagination: {
              type: 'object',
              required: ['page', 'page_size'],
              properties: {
                page: { type: 'integer' },
                page_size: { type: 'integer' },
                total: { type: 'integer', nullable: true }
              }
            }
          }
        },
        WebhookEvent: {
          type: 'object',
          required: ['event_id', 'event_type', 'payload'],
          properties: {
            event_id: { type: 'string' },
            event_type: { type: 'string' },
            payload: { type: 'object', additionalProperties: true }
          }
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            request_id: { type: 'string' }
          }
        }
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
