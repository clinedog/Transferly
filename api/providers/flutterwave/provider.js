'use strict';

const BaseProvider = require('../base-provider');

class FlutterwaveProvider extends BaseProvider {
  constructor({ config = {}, logger = console } = {}) {
    super({ id: 'flutterwave', name: 'Flutterwave', config, logger });
  }

  createClient() {
    const FlutterwaveClient = require('./client');
    const cfg = this.getConfig();
    return new FlutterwaveClient({ secretKey: cfg.secretKey, baseUrl: cfg.baseUrl, logger: this.logger });
  }

  async fetchTransactions(opts = {}) {
    return this.createClient().listTransactions(opts);
  }

  async getHealth() {
    const cfg = this.getConfig();
    return { provider: this.id, status: cfg.configured ? 'configured' : 'needs-env', configured: cfg.configured };
  }

  async handleWebhook(req, res) {
    // Must verify verif-hash header before processing
    this.logger.info({ provider: this.id }, 'flutterwave:webhook received');
    res.status(200).json({ ok: true, provider: this.id });
  }
}

module.exports = FlutterwaveProvider;
