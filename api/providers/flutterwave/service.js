'use strict';

/**
 * FlutterwaveService — business-logic layer for Flutterwave operations.
 */

const FlutterwaveClient = require('./client');
const { AppError } = require('../../utils/errors');

class FlutterwaveService {
  constructor({ config = {}, logger = console } = {}) {
    this.config = config;
    this.logger = logger;
  }

  _client() {
    return new FlutterwaveClient({
      secretKey: this.config.secretKey || '',
      baseUrl: this.config.baseUrl,
      logger: this.logger
    });
  }

  _assertConfigured() {
    if (!this.config.secretKey) {
      throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
        'Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY.', { provider: 'flutterwave' });
    }
  }

  // ---------------------------------------------------------------------------
  // Balance
  // ---------------------------------------------------------------------------

  /**
   * Get balance for a single currency.
   * @param {string} [currency]  e.g. 'NGN', 'USD', 'GHS'
   * @returns {Promise<object|null>}
   */
  async getBalance(currency = 'NGN') {
    try {
      return await this._client().getBalance(currency);
    } catch (err) {
      if (err.statusCode === 501) return null;
      this.logger.error({ err }, 'flutterwave.getBalance failed');
      throw err;
    }
  }

  /**
   * Get all currency balances.
   * @returns {Promise<Array>}
   */
  async getAllBalances() {
    try {
      return await this._client().getAllBalances();
    } catch (err) {
      this.logger.error({ err }, 'flutterwave.getAllBalances failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  /**
   * List Flutterwave transactions.
   * @param {object} [opts]  { page, per_page, status, currency, from, to, customer_email, tx_ref }
   * @returns {Promise<object>}
   */
  async listTransactions(opts = {}) {
    try {
      return await this._client().listTransactions(opts);
    } catch (err) {
      this.logger.error({ err }, 'flutterwave.listTransactions failed');
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
      this.logger.error({ err }, 'flutterwave.getTransaction failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  /**
   * Initiate a payment charge (standard checkout).
   * @param {object} opts  { tx_ref, amount, currency, redirect_url, customer, meta }
   * @returns {Promise<object>}
   */
  async createPayment(opts = {}) {
    this._assertConfigured();
    const { tx_ref, amount, currency = 'NGN', redirect_url, customer } = opts;
    if (!tx_ref) {
      throw new AppError(400, 'FLUTTERWAVE_MISSING_TX_REF', 'tx_ref (unique transaction reference) is required.', { provider: 'flutterwave' });
    }
    if (!amount || amount <= 0) {
      throw new AppError(400, 'FLUTTERWAVE_INVALID_AMOUNT', 'amount must be positive.', { provider: 'flutterwave' });
    }
    if (!customer?.email) {
      throw new AppError(400, 'FLUTTERWAVE_MISSING_CUSTOMER', 'customer.email is required.', { provider: 'flutterwave' });
    }
    if (!redirect_url) {
      throw new AppError(400, 'FLUTTERWAVE_MISSING_REDIRECT', 'redirect_url is required.', { provider: 'flutterwave' });
    }
    try {
      return await this._client().initiatePayment({ tx_ref, amount, currency, redirect_url, customer, ...opts });
    } catch (err) {
      this.logger.error({ err }, 'flutterwave.createPayment failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payouts (transfers)
  // ---------------------------------------------------------------------------

  /**
   * Create a bank transfer (payout).
   * @param {object} opts  { account_bank, account_number, amount, currency, narration, reference }
   * @returns {Promise<object>}
   */
  async createPayout(opts = {}) {
    this._assertConfigured();
    const { account_bank, account_number, amount, currency = 'NGN' } = opts;
    if (!account_bank || !account_number) {
      throw new AppError(400, 'FLUTTERWAVE_MISSING_ACCOUNT', 'account_bank and account_number are required.', { provider: 'flutterwave' });
    }
    if (!amount || amount <= 0) {
      throw new AppError(400, 'FLUTTERWAVE_INVALID_AMOUNT', 'amount must be positive.', { provider: 'flutterwave' });
    }
    try {
      return await this._client().createTransfer({ account_bank, account_number, amount, currency, ...opts });
    } catch (err) {
      this.logger.error({ err }, 'flutterwave.createPayout failed');
      throw err;
    }
  }
}

module.exports = FlutterwaveService;
