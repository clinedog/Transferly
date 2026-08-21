// Lightweight PayPal client scaffold
// Replace with production-ready client using retries, timeouts, idempotency, and OAuth token refresh

class PayPalClient {
  constructor({ clientId, clientSecret, env = 'sandbox', logger = console } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.env = env;
    this.baseUrl = env === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';
    this.logger = logger;
  }

  async fetch(path, opts = {}) {
    // Minimal stub — providers should implement HTTP client with fetch/axios, retries and backoff
    this.logger.debug('paypal.client.fetch', { path, opts });
    return { status: 200, data: null };
  }

  async getBalance() {
    const res = await this.fetch('/v1/reporting/balances');
    return res.data;
  }

  async listTransactions(_params = {}) {
    const res = await this.fetch('/v1/reporting/transactions');
    return res.data || { transactions: [] };
  }
}

module.exports = PayPalClient;
