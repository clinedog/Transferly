'use strict';

const BaseProvider = require('../base-provider');

class PaystackProvider extends BaseProvider {
  constructor({ config = {}, logger = console } = {}) {
    super({ id: 'paystack', name: 'Paystack', config, logger });
  }

  createClient() {
    const PaystackClient = require('./client');
    const cfg = this.getConfig();
    return new PaystackClient({ secretKey: cfg.secretKey, baseUrl: cfg.baseUrl, logger: this.logger });
  }

  async fetchTransactions(opts = {}) {
    return this.createClient().listTransactions(opts);
  }

  async getHealth() {
    const cfg = this.getConfig();
    return { provider: this.id, status: cfg.configured ? 'configured' : 'needs-env', configured: cfg.configured };
  }

  async handleWebhook(req, res) {
    // Must verify X-Paystack-Signature header before processing
    this.logger.info({ provider: this.id }, 'paystack:webhook received');
    res.status(200).json({ ok: true, provider: this.id });
  }
}

module.exports = PaystackProvider;
