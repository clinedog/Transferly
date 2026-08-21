'use strict';

const BaseProvider = require('../base-provider');

/**
 * StripeProvider — wraps the Stripe client + service behind the BaseProvider interface.
 */
class StripeProvider extends BaseProvider {
  constructor({ config = {}, logger = console } = {}) {
    super({ id: 'stripe', name: 'Stripe Connect', config, logger });
  }

  /**
   * Returns a Stripe API client configured from the central ProviderConfig.
   *
   * @returns {import('./client')} StripeClient instance
   */
  createClient() {
    const StripeClient = require('./client');
    const cfg = this.getConfig();
    return new StripeClient({
      secretKey: cfg.secretKey,
      apiVersion: cfg.apiVersion,
      baseUrl: cfg.baseUrl,
      logger: this.logger
    });
  }

  /**
   * Fetch payment intents from Stripe.
   *
   * @param {object} [opts] - Query options forwarded to the client
   * @returns {Promise<{data: Array}>}
   */
  async fetchTransactions(opts = {}) {
    const client = this.createClient();
    return client.listPaymentIntents(opts);
  }

  /**
   * Returns a health snapshot.
   *
   * @returns {Promise<{status: string, provider: string, configured: boolean}>}
   */
  async getHealth() {
    const cfg = this.getConfig();
    return {
      provider: this.id,
      status: cfg.configured ? 'configured' : 'needs-env',
      configured: cfg.configured
    };
  }

  /**
   * Webhook handler stub.
   * Providers must verify Stripe-Signature before any processing.
   */
  async handleWebhook(req, res) {
    this.logger.info({ provider: this.id, eventType: req.body?.type }, 'stripe:webhook received');
    res.status(200).json({ ok: true, provider: this.id });
  }
}

module.exports = StripeProvider;
