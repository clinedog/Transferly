'use strict';

/**
 * PaystackService — business-logic layer for Paystack operations.
 */

const PaystackClient = require('./client');
const { AppError } = require('../../utils/errors');

class PaystackService {
  constructor({ config = {}, logger = console } = {}) {
    this.config = config;
    this.logger = logger;
  }

  _client() {
    return new PaystackClient({
      secretKey: this.config.secretKey || '',
      baseUrl: this.config.baseUrl,
      logger: this.logger
    });
  }

  _assertConfigured() {
    if (!this.config.secretKey) {
      throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
        'Paystack is not configured. Set PAYSTACK_SECRET_KEY.', { provider: 'paystack' });
    }
  }

  // ---------------------------------------------------------------------------
  // Balance
  // ---------------------------------------------------------------------------

  /**
   * Retrieve Paystack balance (array of per-currency balances).
   * @returns {Promise<Array|null>}
   */
  async getBalance() {
    try {
      return await this._client().getBalance();
    } catch (err) {
      if (err.statusCode === 501) return null;
      this.logger.error({ err }, 'paystack.getBalance failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  /**
   * List Paystack transactions.
   * @param {object} [opts]  { perPage, page, status, customer, currency, from, to }
   * @returns {Promise<object>}
   */
  async listTransactions(opts = {}) {
    try {
      return await this._client().listTransactions(opts);
    } catch (err) {
      this.logger.error({ err }, 'paystack.listTransactions failed');
      throw err;
    }
  }

  /**
   * Get a single transaction by ID.
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  async getTransaction(id) {
    try {
      return await this._client().getTransaction(id);
    } catch (err) {
      this.logger.error({ err }, 'paystack.getTransaction failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  /**
   * Initialize a transaction (returns authorization_url for hosted checkout).
   * @param {object} opts  { email, amount (kobo), currency, reference, metadata }
   * @returns {Promise<object>}
   */
  async createPayment(opts = {}) {
    this._assertConfigured();
    const { email, amount, currency = 'NGN' } = opts;
    if (!email) {
      throw new AppError(400, 'PAYSTACK_MISSING_EMAIL', 'email is required.', { provider: 'paystack' });
    }
    if (!amount || amount <= 0) {
      throw new AppError(400, 'PAYSTACK_INVALID_AMOUNT', 'amount must be a positive integer (kobo).', { provider: 'paystack' });
    }
    try {
      return await this._client().initializeTransaction({ email, amount, currency, ...opts });
    } catch (err) {
      this.logger.error({ err }, 'paystack.createPayment failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payouts (transfers)
  // ---------------------------------------------------------------------------

  /**
   * Initiate a transfer (payout) via Paystack.
   * @param {object} opts  { source, amount, recipient, reason, currency, reference }
   * @returns {Promise<object>}
   */
  async createPayout(opts = {}) {
    this._assertConfigured();
    const { source = 'balance', amount, recipient, currency = 'NGN' } = opts;
    if (!amount || amount <= 0) {
      throw new AppError(400, 'PAYSTACK_INVALID_AMOUNT', 'amount must be a positive integer (kobo).', { provider: 'paystack' });
    }
    if (!recipient) {
      throw new AppError(400, 'PAYSTACK_MISSING_RECIPIENT', 'recipient transfer code is required.', { provider: 'paystack' });
    }
    try {
      return await this._client().initiateTransfer({ source, amount, recipient, currency, ...opts });
    } catch (err) {
      this.logger.error({ err }, 'paystack.createPayout failed');
      throw err;
    }
  }
}

module.exports = PaystackService;
