'use strict';

/**
 * Mount per-provider Express routers discovered from the provider directory.
 *
 * Each provider may optionally expose:
 *   api/providers/<key>/routes.js    → mounted at /api/providers/<key> and /api/v1/providers/<key>
 *   api/providers/<key>/webhooks.js  → mounted at /webhooks/<key>
 *
 * This function returns the routers so the caller (routes/index.js) can mount
 * them in the correct order relative to global middleware.
 *
 * Per-provider routes are wrapped with requireAuthenticatedUser.
 * Per-provider webhooks are NOT wrapped with auth (signature-verified instead).
 */

const fs = require('node:fs');
const path = require('node:path');

const config = require('../../config');
const { requireAuthenticatedUser } = require('../../middleware/authenticateRequest');
const { providerModuleRegistry } = require('../moduleRegistry');

/**
 * Provider keys whose webhooks are already fully handled by webhookRoutes.js
 * (paypalWebhookHandlers, stripeWebhookHandlers, cryptoWebhookHandlers).
 * Per-provider webhooks.js files are NOT mounted for these keys to avoid
 * double-handling and route shadowing.
 */
const WEBHOOK_HANDLED_BY_CORE = new Set(['paypal', 'stripe', 'crypto']);

const PROVIDERS_DIR = path.resolve(__dirname, '..');
const ACTIVE_PRODUCTION_PROVIDERS = new Set(['paypal']);

/**
 * @returns {{ providerRouters: Array<{prefix: string, router: import('express').Router}>,
 *             webhookRouters: Array<{prefix: string, router: import('express').Router}> }}
 */
function buildPerProviderRouters({ apiPrefixes = ['/api'] } = {}) {
  const providerRouters = [];
  const webhookRouters = [];

  for (const mod of providerModuleRegistry.list({ includeDisabled: false })) {
    const key = mod.key;
    if (config.PAYPAL_ONLY_PRODUCTION_MVP && !ACTIVE_PRODUCTION_PROVIDERS.has(key)) {
      continue;
    }

    const routesPath = path.join(PROVIDERS_DIR, key, 'routes.js');
    if (fs.existsSync(routesPath)) {
      // Lazy-require so errors in individual providers don't block startup
      try {
        const router = require(routesPath);
        for (const apiPrefix of apiPrefixes) {
          providerRouters.push({
            prefix: `${apiPrefix}/providers/${key}`,
            router: wrapWithAuth(router)
          });
        }
      } catch (err) {
        // Log but don't throw — a broken provider shouldn't kill the whole app
        console.warn(`[mountProviderRoutes] Failed to load routes for provider "${key}":`, err.message);
      }
    }

    const webhooksPath = path.join(PROVIDERS_DIR, key, 'webhooks.js');
    if (fs.existsSync(webhooksPath) && !WEBHOOK_HANDLED_BY_CORE.has(key)) {
      try {
        const router = require(webhooksPath);
        webhookRouters.push({
          prefix: `/webhooks/${key}`,
          router
        });
      } catch (err) {
        console.warn(`[mountProviderRoutes] Failed to load webhooks for provider "${key}":`, err.message);
      }
    }
  }

  return { providerRouters, webhookRouters };
}

/**
 * Wraps a router with requireAuthenticatedUser.
 * If the router already has auth applied this is a no-op in terms of security
 * (double-checking is safe), but keeps the contract consistent.
 *
 * @param {import('express').Router} router
 * @returns {import('express').Router}
 */
function wrapWithAuth(router) {
  const express = require('express');
  const wrapped = express.Router();
  wrapped.use(requireAuthenticatedUser);
  wrapped.use(router);
  return wrapped;
}

/**
 * Register all per-provider routes and webhooks on the Express app.
 *
 * @param {import('express').Application} app
 */
function mountPerProviderRoutes(app, options = {}) {
  const { providerRouters, webhookRouters } = buildPerProviderRouters(options);

  for (const { prefix, router } of providerRouters) {
    app.use(prefix, router);
  }

  for (const { prefix, router } of webhookRouters) {
    app.use(prefix, router);
  }

  return {
    mountedProviderRoutes: providerRouters.map((r) => r.prefix),
    mountedWebhookRoutes: webhookRouters.map((r) => r.prefix)
  };
}

module.exports = { mountPerProviderRoutes, buildPerProviderRouters };
