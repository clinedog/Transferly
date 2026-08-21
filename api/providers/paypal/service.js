const PayPalClient = require('./client');

class PayPalService {
  constructor({ config = {}, logger = console } = {}) {
    this.config = config;
    this.logger = logger;
    this.client = new PayPalClient({ clientId: config.clientId, clientSecret: config.clientSecret, env: config.env, logger });
  }

  async getBalance() {
    try {
      return await this.client.getBalance();
    } catch (err) {
      this.logger.error({ err }, 'paypal.getBalance failed');
      throw err;
    }
  }

  async listTransactions(opts = {}) {
    return this.client.listTransactions(opts);
  }
}

module.exports = PayPalService;
