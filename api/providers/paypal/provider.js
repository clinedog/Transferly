'use strict';

const BaseProvider = require('../base-provider');

/**
 * PayPalProvider — wraps the PayPal client + service behind the BaseProvider interface.
 *
 * Production operations (invoice creation, payout submission, webhook handling) are
 * handled by the existing paypalInvoiceService / paypalPayoutService / webhookService.
 * This class provides the standardised getHealth() and createClient() surface that the
 * ProviderModuleRegistry and ProviderSDK expect.
 */
class PayPalProvider extends BaseProvider {
  constructor({ config = {}, logger = console } = {}) {
    super({ id: 'paypal', name: 'PayPal', config, logger });
  }

  /**
   * Returns a lightweight PayPal API client configured from the central ProviderConfig.
   *
   * @returns {import('./client')} PayPalClient instance
   */
  createClient() {
    const PayPalClient = require('./client');
    const cfg = this.getConfig();
    return new PayPalClient({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      env: cfg.environment,
      logger: this.logger
    });
  }

  /**
   * Fetch transactions via the PayPal reporting API.
   *
   * @param {object} [opts] - Query options forwarded to the client
   * @returns {Promise<{transactions: Array}>}
   */
  async fetchTransactions(opts = {}) {
    const client = this.createClient();
    return client.listTransactions(opts);
  }

  /**
   * Returns a health snapshot.
   * Configured = credentials present; status reflects environment mode.
   *
   * @returns {Promise<{status: string, provider: string, configured: boolean, environment: string}>}
   */
  async getHealth() {
    const cfg = this.getConfig();
    return {
      provider: this.id,
      status: cfg.configured ? 'configured' : 'needs-env',
      configured: cfg.configured,
      environment: cfg.environment
    };
  }

  /**
   * Webhook handler stub.
   * Production webhook processing is handled by api/webhooks/paypalWebhookHandlers.js.
   * This stub exists so the BaseProvider interface is satisfied by the per-provider
   * routes.js webhook endpoint.
   */
  async handleWebhook(req, res) {
    this.logger.info({ provider: this.id, headers: req.headers }, 'paypal:webhook received');
    res.status(200).json({ ok: true, provider: this.id });
  }
}

module.exports = PayPalProvider;
