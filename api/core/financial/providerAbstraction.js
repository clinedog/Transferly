'use strict';

const { AppError } = require('../../utils/errors');

class PaymentProvider {
  constructor({ key, name, order = 100 }) {
    if (!key || !name) throw new Error('PaymentProvider requires key and name');
    this.key = key;
    this.name = name;
    this.order = order;
  }

  getKey() { return this.key; }
  getName() { return this.name; }
  getOrder() { return this.order; }

  getCapabilities() {
    throw new Error(this.key + ': getCapabilities() must be implemented');
  }

  hasCapability(capability) {
    return this.getCapabilities()[capability] === true;
  }

  supportsCountryAndCurrency(countryCode, currencyCode) {
    const caps = this.getCapabilities();
    if (caps.supportedCountries.length && !caps.supportedCountries.includes(countryCode)) return false;
    if (caps.supportedCurrencies.length && !caps.supportedCurrencies.includes(currencyCode)) return false;
    return true;
  }

  isConfigured() {
    throw new Error(this.key + ': isConfigured() must be implemented');
  }
  getConfigStatus() {
    throw new Error(this.key + ': getConfigStatus() must be implemented');
  }

  async init() {}
  async shutdown() {}

  async createPayment(_opts) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' createPayment() not implemented', { provider: this.key });
  }
  async getPayment(_ref, _ctx) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' getPayment() not implemented', { provider: this.key });
  }
  async cancelPayment(_ref, _ctx) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' cancelPayment() not implemented', { provider: this.key });
  }
  async verifyPayment(_ref, _ctx) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' verifyPayment() not implemented', { provider: this.key });
  }

  async createPayout(_opts) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' createPayout() not implemented', { provider: this.key });
  }
  async getPayout(_ref, _ctx) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' getPayout() not implemented', { provider: this.key });
  }
  async cancelPayout(_ref, _ctx) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' cancelPayout() not implemented', { provider: this.key });
  }

  async createRefund(_opts) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' createRefund() not implemented', { provider: this.key });
  }
  async getRefund(_ref, _ctx) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' getRefund() not implemented', { provider: this.key });
  }

  verifyWebhook(_headers, _body) {
    throw new Error(this.key + ': verifyWebhook() must be implemented');
  }
  parseWebhookEvent(_event) {
    throw new Error(this.key + ': parseWebhookEvent() must be implemented');
  }
  async handleWebhook(_req, res) {
    res.status(501).json({ error: 'Webhook handler not implemented', provider: this.key });
  }

  async getHealth() {
    return { status: 'unknown', latencyMs: null, successRate: null, lastChecked: Date.now(), issues: [] };
  }
  async getBalance(_currency) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      this.name + ' getBalance() not implemented', { provider: this.key });
  }

  validate(data, schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new AppError(400, 'PROVIDER_VALIDATION_ERROR',
        this.name + ' validation failed.', { provider: this.key, issues: result.error.issues });
    }
    return result.data;
  }
}

const DEFAULT_CAPABILITIES = {
  cardPayments: false, bankTransfer: false, mobileMoney: false, walletPayments: false,
  qrPayments: false, payouts: false, refunds: false, recurringPayments: false,
  multiCurrency: true, webhooks: false, supportedCountries: [], supportedCurrencies: []
};

module.exports = { PaymentProvider, DEFAULT_CAPABILITIES };
