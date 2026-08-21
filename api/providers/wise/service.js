'use strict';

/**
 * WiseService — business-logic layer for Wise Platform operations.
 */

const WiseClient = require('./client');
const { AppError } = require('../../utils/errors');

class WiseService {
  constructor({ config = {}, logger = console } = {}) {
    this.config = config;
    this.logger = logger;
  }

  _client() {
    return new WiseClient({
      apiToken: this.config.apiToken || '',
      profileId: this.config.profileId || '',
      baseUrl: this.config.baseUrl,
      logger: this.logger
    });
  }

  _assertConfigured() {
    if (!this.config.apiToken) {
      throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
        'Wise is not configured. Set WISE_API_TOKEN and WISE_PROFILE_ID.', { provider: 'wise' });
    }
  }

  // ---------------------------------------------------------------------------
  // Balance
  // ---------------------------------------------------------------------------

  /**
   * Retrieve all Wise profile balances.
   * @returns {Promise<Array>}
   */
  async getBalances() {
    try {
      return await this._client().getBalances();
    } catch (err) {
      if (err.statusCode === 501) return [];
      this.logger.error({ err }, 'wise.getBalances failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Transactions / Transfers
  // ---------------------------------------------------------------------------

  /**
   * List Wise transfers for the configured profile.
   * @param {object} [opts]  { limit, offset, status, sourceCurrency, targetCurrency }
   * @returns {Promise<object>}  { content: Array, totalElements: number }
   */
  async listTransfers(opts = {}) {
    try {
      return await this._client().listTransfers(opts);
    } catch (err) {
      this.logger.error({ err }, 'wise.listTransfers failed');
      throw err;
    }
  }

  /**
   * Get a single transfer by ID.
   * @param {string|number} transferId
   * @returns {Promise<object>}
   */
  async getTransfer(transferId) {
    try {
      return await this._client().getTransfer(transferId);
    } catch (err) {
      this.logger.error({ err }, 'wise.getTransfer failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payments (quote preview)
  // ---------------------------------------------------------------------------

  /**
   * Create a quote to preview FX rate and transfer cost.
   * @param {object} opts  { sourceCurrency, targetCurrency, targetAmount, payOut }
   * @returns {Promise<object>}
   */
  async createPayment(opts = {}) {
    this._assertConfigured();
    const { sourceCurrency, targetCurrency, targetAmount } = opts;
    if (!sourceCurrency || !targetCurrency) {
      throw new AppError(400, 'WISE_MISSING_CURRENCIES',
        'sourceCurrency and targetCurrency are required.', { provider: 'wise' });
    }
    if (!targetAmount || targetAmount <= 0) {
      throw new AppError(400, 'WISE_INVALID_AMOUNT', 'targetAmount must be positive.', { provider: 'wise' });
    }
    try {
      return await this._client().createQuote({ sourceCurrency, targetCurrency, targetAmount, payOut: opts.payOut });
    } catch (err) {
      this.logger.error({ err }, 'wise.createPayment (quote) failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payouts (transfer creation)
  // ---------------------------------------------------------------------------

  /**
   * Create a transfer (payout) on Wise.
   * @param {object} opts  { targetAccount, quoteUuid, customerTransactionId, details }
   * @returns {Promise<object>}
   */
  async createPayout(opts = {}) {
    this._assertConfigured();
    const { targetAccount, quoteUuid, customerTransactionId } = opts;
    if (!targetAccount || !quoteUuid || !customerTransactionId) {
      throw new AppError(400, 'WISE_MISSING_TRANSFER_FIELDS',
        'targetAccount, quoteUuid, and customerTransactionId are required.', { provider: 'wise' });
    }
    try {
      return await this._client().createTransfer(opts);
    } catch (err) {
      this.logger.error({ err }, 'wise.createPayout failed');
      throw err;
    }
  }
}

module.exports = WiseService;
