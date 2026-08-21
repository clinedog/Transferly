'use strict';

const BaseProvider = require('../base-provider');

class WiseProvider extends BaseProvider {
  constructor({ config = {}, logger = console } = {}) {
    super({ id: 'wise', name: 'Wise Platform', config, logger });
  }

  createClient() {
    const WiseClient = require('./client');
    const cfg = this.getConfig();
    return new WiseClient({
      apiToken: cfg.apiToken,
      profileId: cfg.profileId,
      baseUrl: cfg.baseUrl,
      logger: this.logger
    });
  }

  async fetchTransactions(opts = {}) {
    const client = this.createClient();
    return client.listTransfers(opts);
  }

  async getHealth() {
    const cfg = this.getConfig();
    return { provider: this.id, status: cfg.configured ? 'configured' : 'needs-env', configured: cfg.configured };
  }

  async handleWebhook(req, res) {
    // Must verify X-Signature-SHA256 header before processing
    this.logger.info({ provider: this.id }, 'wise:webhook received');
    res.status(200).json({ ok: true, provider: this.id });
  }
}

module.exports = WiseProvider;
