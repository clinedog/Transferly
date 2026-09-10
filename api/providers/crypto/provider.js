'use strict';

const BaseProvider = require('../base-provider');

class CryptoCommerceProvider extends BaseProvider {
  constructor({ config = {}, logger = console } = {}) {
    super({ id: 'crypto', name: 'Crypto Commerce', config, logger });
  }

  createClient() {
    const CryptoCommerceClient = require('./client');
    const cfg = this.getConfig();
    return new CryptoCommerceClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, logger: this.logger });
  }

  async fetchTransactions(opts = {}) {
    return this.createClient().listCharges(opts);
  }

  /**
   * Returns the provider capability set.
   * Maps to the adapter-defined capabilities for Crypto Commerce.
   *
   * @returns {object}
   */
  getCapabilities() {
    return {
      cardPayments: false,
      bankTransfer: false,
      mobileMoney: false,
      walletPayments: false,
      qrPayments: false,
      payouts: false,
      refunds: false,
      recurringPayments: false,
      multiCurrency: true,
      webhooks: true,
      supportedCountries: [],
      supportedCurrencies: []
    };
  }

  async getHealth() {
    const cfg = this.getConfig();
    return { provider: this.id, status: cfg.configured ? 'configured' : 'needs-env', configured: cfg.configured };
  }

  async handleWebhook(req, res) {
    // Must verify X-CC-Webhook-Signature header before processing
    this.logger.info({ provider: this.id }, 'crypto:webhook received');
    res.status(200).json({ ok: true, provider: this.id });
  }
}

module.exports = CryptoCommerceProvider;
