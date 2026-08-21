'use strict';

/**
 * StripeService — business-logic layer for Stripe operations.
 *
 * Wraps StripeClient with structured error handling, config resolution,
 * and normalized response shapes aligned with the Transferly provider contract.
 */

const StripeClient = require('./client');
const { AppError } = require('../../utils/errors');

class StripeService {
  constructor({ config = {}, logger = console } = {}) {
    this.config = config;
    this.logger = logger;
  }

  _client() {
    return new StripeClient({
      secretKey: this.config.secretKey || '',
      apiVersion: this.config.apiVersion,
      baseUrl: this.config.baseUrl,
      logger: this.logger
    });
  }

  _assertConfigured() {
    if (!this.config.secretKey) {
      throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
        'Stripe is not configured. Set STRIPE_SECRET_KEY.', { provider: 'stripe' });
    }
  }

  // ---------------------------------------------------------------------------
  // Balance
  // ---------------------------------------------------------------------------

  /**
   * Retrieve Stripe account balance.
   * @returns {Promise<object|null>}
   */
  async getBalance() {
    try {
      return await this._client().getBalance();
    } catch (err) {
      if (err.statusCode === 501) return null;
      this.logger.error({ err }, 'stripe.getBalance failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  /**
   * List payment intents (primary "transaction" surface for Stripe Connect).
   * @param {object} [opts]  { limit, starting_after, customer, currency, status }
   * @returns {Promise<object>}  { data: Array, has_more: boolean }
   */
  async listPayments(opts = {}) {
    try {
      return await this._client().listPaymentIntents(opts);
    } catch (err) {
      this.logger.error({ err }, 'stripe.listPayments failed');
      throw err;
    }
  }

  /**
   * List Stripe invoices.
   * @param {object} [opts]  { limit, customer, status, starting_after }
   * @returns {Promise<object>}
   */
  async listInvoices(opts = {}) {
    try {
      return await this._client().listInvoices(opts);
    } catch (err) {
      this.logger.error({ err }, 'stripe.listInvoices failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  /**
   * Create a payment intent.
   * @param {object} opts  { amount (cents), currency, description, metadata }
   * @returns {Promise<object>}
   */
  async createPayment(opts = {}) {
    this._assertConfigured();
    const { amount, currency = 'usd', description, metadata } = opts;
    if (!amount || amount <= 0) {
      throw new AppError(400, 'STRIPE_INVALID_AMOUNT', 'Amount must be a positive integer (cents).', { provider: 'stripe' });
    }
    try {
      return await this._client().createPaymentIntent({ amount, currency, description, metadata });
    } catch (err) {
      this.logger.error({ err }, 'stripe.createPayment failed');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payouts (transfers to connected accounts)
  // ---------------------------------------------------------------------------

  /**
   * Create a transfer to a connected account.
   * @param {object} opts  { amount, currency, destination, description, metadata }
   * @returns {Promise<object>}
   */
  async createPayout(opts = {}) {
    this._assertConfigured();
    const { amount, currency = 'usd', destination, description, metadata } = opts;
    if (!amount || amount <= 0) {
      throw new AppError(400, 'STRIPE_INVALID_AMOUNT', 'Amount must be a positive integer (cents).', { provider: 'stripe' });
    }
    if (!destination) {
      throw new AppError(400, 'STRIPE_MISSING_DESTINATION', 'destination (connected account ID) is required.', { provider: 'stripe' });
    }
    try {
      return await this._client().createTransfer({ amount, currency, destination, description, metadata });
    } catch (err) {
      this.logger.error({ err }, 'stripe.createPayout failed');
      throw err;
    }
  }
}

module.exports = StripeService;
