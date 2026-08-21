'use strict';

/**
 * CryptoCommerceService — business-logic layer for Coinbase Commerce operations.
 */

const CryptoCommerceClient = require('./client');
const { AppError } = require('../../utils/errors');

class CryptoCommerceService {
  constructor({ config = {}, logger = console } = {}) {
    this.config = config;
    this.logger = logger;
  }

  _client() {
    return new CryptoCommerceClient({
      apiKey: this.config.apiKey || '',
      baseUrl: this.config.baseUrl,
      logger: this.logger
    });
  }

  _assertConfigured() {
    if (!this.config.apiKey) {
      throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
        'Crypto Commerce is not configured. Set CRYPTO_COMMERCE_API_KEY.', { provider: 'crypto' });
    }
  }

  /**
   * List charges (paginated).
   * @param {object} [opts]  { limit, starting_after, ending_before }
   */
  async listCharges(opts = {}) {
    try {
      return await this._client().listCharges(opts);
    } catch (err) {
      this.logger.error({ err }, 'crypto.listCharges failed');
      throw err;
    }
  }

  /**
   * Get a single charge by ID or code.
   * @param {string} chargeId
   */
  async getCharge(chargeId) {
    try {
      return await this._client().getCharge(chargeId);
    } catch (err) {
      this.logger.error({ err }, 'crypto.getCharge failed');
      throw err;
    }
  }

  /**
   * Create a new charge (crypto payment request).
   * @param {object} opts  { name, description, pricing_type, local_price: { amount, currency }, metadata }
   */
  async createPayment(opts = {}) {
    this._assertConfigured();
    const { name, pricing_type = 'fixed_price', local_price } = opts;
    if (!name) {
      throw new AppError(400, 'CRYPTO_COMMERCE_MISSING_NAME', 'name is required.', { provider: 'crypto' });
    }
    if (pricing_type === 'fixed_price' && (!local_price?.amount || !local_price?.currency)) {
      throw new AppError(400, 'CRYPTO_COMMERCE_MISSING_PRICE',
        'local_price.amount and local_price.currency are required for fixed_price charges.', { provider: 'crypto' });
    }
    try {
      return await this._client().createCharge(opts);
    } catch (err) {
      this.logger.error({ err }, 'crypto.createPayment failed');
      throw err;
    }
  }

  /** Cancel a pending charge. */
  async cancelCharge(chargeId) {
    this._assertConfigured();
    if (!chargeId) {
      throw new AppError(400, 'CRYPTO_COMMERCE_MISSING_CHARGE_ID', 'chargeId is required.', { provider: 'crypto' });
    }
    try {
      return await this._client().cancelCharge(chargeId);
    } catch (err) {
      this.logger.error({ err }, 'crypto.cancelCharge failed');
      throw err;
    }
  }

  /** Crypto has no traditional payout — surfaces a clear not-supported error. */
  async createPayout(_opts = {}) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      'Crypto Commerce does not support direct payouts. Use createPayment (charge) to receive crypto.',
      { provider: 'crypto' });
  }
}

module.exports = CryptoCommerceService;
