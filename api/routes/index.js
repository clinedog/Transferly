const { bootstrapRoutes, meRoutes, workspaceRoutes } = require('./bootstrapRoutes');
const { authRoutes } = require('./authRoutes');
const { assetRoutes } = require('./assetRoutes');
const { emailRoutes } = require('./emailRoutes');
const { invoiceRoutes } = require('./invoiceRoutes');
const { orderRoutes } = require('./orderRoutes');
const { payoutRoutes } = require('./payoutRoutes');
const { providerRoutes } = require('./providerRoutes');
const { adminRoutes } = require('./adminRoutes');
const { receiptRoutes } = require('./receiptRoutes');
const { referralRoutes } = require('./referralRoutes');
const { serviceRoutes } = require('./serviceRoutes');
const { telegramRoutes } = require('./telegramRoutes');
const { slipcraftUserRoutes } = require('./slipcraftUserRoutes');
const { webhookRoutes } = require('./webhookRoutes');
const { marketplaceRoutes } = require('./marketplaceRoutes');
const { walletLinkRoutes } = require('./walletLinkRoutes');
const { mountPerProviderRoutes } = require('../providers/shared/mountProviderRoutes');
const { logger } = require('../utils/logger');

const API_PREFIXES = Object.freeze(['/api', '/api/v1']);

function mountApiRoutes(app, prefix) {
  app.use(`${prefix}/bootstrap`, bootstrapRoutes);
  app.use(`${prefix}/me`, meRoutes);
  app.use(`${prefix}/workspace`, workspaceRoutes);
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/user`, slipcraftUserRoutes);
  app.use(`${prefix}/receipt`, receiptRoutes);
  app.use(`${prefix}/services`, serviceRoutes);
  app.use(`${prefix}/email`, emailRoutes);
  app.use(`${prefix}/referral`, referralRoutes);
  app.use(`${prefix}/telegram`, telegramRoutes);

  // Generic provider routes (dynamic /:provider/* — must come before per-provider mounts)
  app.use(`${prefix}/providers`, providerRoutes);

  app.use(`${prefix}/invoices`, invoiceRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/assets`, assetRoutes);
  app.use(`${prefix}/payouts`, payoutRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/marketplace`, marketplaceRoutes);
  app.use(`${prefix}/wallet-links`, walletLinkRoutes);
}

function registerRoutes(app) {
  for (const prefix of API_PREFIXES) {
    mountApiRoutes(app, prefix);
  }

  // Core webhook routes are mounted BEFORE per-provider webhooks so that existing
  // paypal/stripe/crypto handlers in webhookRoutes.js (which do real ledger work)
  // take precedence. Per-provider webhooks.js files handle providers not yet in
  // webhookRoutes.js (wise, paystack, flutterwave).
  app.use('/webhooks', webhookRoutes);

  // Per-provider extended routes and webhooks discovered from api/providers/<key>/routes.js
  // and api/providers/<key>/webhooks.js. Routes are auth-guarded; webhooks are not (signature-verified).
  const { mountedProviderRoutes, mountedWebhookRoutes } = mountPerProviderRoutes(app, {
    apiPrefixes: API_PREFIXES
  });
  if (mountedProviderRoutes.length || mountedWebhookRoutes.length) {
    logger.info({ mountedProviderRoutes, mountedWebhookRoutes }, 'per-provider routes mounted');
  }
}

module.exports = {
  API_PREFIXES,
  registerRoutes
};
