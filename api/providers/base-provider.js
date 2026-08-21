'use strict';

/**
 * BaseProvider — abstract base class for all Transferly payment provider modules.
 *
 * Every provider (PayPal, Stripe, Wise, …) extends this class and overrides
 * the abstract methods it needs. Non-abstract methods provide sensible defaults
 * backed by the shared ProviderConfig and ProviderSDK infrastructure.
 *
 * Usage:
 *   class StripeProvider extends BaseProvider {
 *     constructor(opts) { super({ id: 'stripe', name: 'Stripe', ...opts }); }
 *     createClient() { return new StripeClient(this.getConfig()); }
 *   }
 */

const { AppError } = require('../utils/errors');

class BaseProvider {
  /**
   * @param {object} opts
   * @param {string} opts.id      - Provider key matching the registry key (e.g. 'paypal')
   * @param {string} opts.name    - Human-readable display name
   * @param {object} [opts.config]  - Optional config override (defaults to providerConfig.js)
   * @param {object} [opts.logger]  - Logger instance (defaults to console)
   */
  constructor({ id, name, config = {}, logger = console }) {
    if (!id || !name) throw new Error('BaseProvider requires id and name');
    this.id = id;
    this.name = name;
    this._configOverride = config;
    this.logger = logger;
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Returns the structured provider config from the central ProviderConfig registry.
   * If a config override was passed to the constructor, it is merged on top.
   *
   * @returns {object} Provider config with a `configured` boolean and `missingKeys` array
   */
  getConfig() {
    // Lazy-require to avoid circular dependency at module load time
    const { getProviderConfig } = require('./shared/providerConfig');
    const base = getProviderConfig(this.id);
    if (Object.keys(this._configOverride).length === 0) return base;
    return Object.freeze({ ...base, ...this._configOverride });
  }

  /**
   * Returns true if all required environment variables for this provider are set.
   *
   * @returns {boolean}
   */
  isConfigured() {
    const { isProviderConfigured } = require('./shared/providerConfig');
    return isProviderConfigured(this.id);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Called once when the provider is initialised. Override to perform async setup
   * (e.g. token pre-fetch, connection verification).
   */
  async init() {
    this.logger.info(`${this.id}: init`);
  }

  /**
   * Called on graceful shutdown. Override to close connections, flush queues, etc.
   */
  async shutdown() {
    this.logger.info(`${this.id}: shutdown`);
  }

  // ---------------------------------------------------------------------------
  // Abstract — providers must implement
  // ---------------------------------------------------------------------------

  /**
   * Factory method that returns a provider API client instance.
   * The client is responsible for HTTP communication with the external provider.
   *
   * @returns {object} Provider-specific client instance
   */
  createClient() {
    throw new Error(`${this.id}: createClient() not implemented`);
  }

  // ---------------------------------------------------------------------------
  // Operations — providers override as needed
  // ---------------------------------------------------------------------------

  /**
   * Fetch a paginated list of transactions from the provider.
   *
   * @param {object} [opts] - Query options (page, limit, dateFrom, dateTo, …)
   * @returns {Promise<{items: Array, nextPage: *}>}
   */
  async fetchTransactions(_opts = {}) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      `${this.name} fetchTransactions() not implemented.`, { provider: this.id });
  }

  /**
   * Create a payment / invoice on the provider.
   *
   * @param {object} opts - Payment creation options
   * @returns {Promise<object>} Created payment resource
   */
  async createPayment(_opts = {}) {
    throw new AppError(501, 'PAYMENT_PROVIDER_OPERATION_NOT_IMPLEMENTED',
      `${this.name} createPayment() not implemented.`, { provider: this.id });
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  /**
   * Returns a health snapshot for this provider.
   * Override to perform a real liveness / readiness check.
   *
   * @returns {Promise<{status: string, provider: string, configured: boolean}>}
   */
  async getHealth() {
    return {
      provider: this.id,
      status: 'unknown',
      configured: this.isConfigured()
    };
  }

  // ---------------------------------------------------------------------------
  // Webhook
  // ---------------------------------------------------------------------------

  /**
   * Express-style webhook handler.
   * Override to implement signature verification, deduplication, and processing.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async handleWebhook(_req, res) {
    res.status(501).json({ error: 'Webhook handler not implemented', provider: this.id });
  }

  // ---------------------------------------------------------------------------
  // Validation helper
  // ---------------------------------------------------------------------------

  /**
   * Validate `data` against a Zod schema.
   * Throws an AppError with provider context on failure.
   *
   * @param {object} data   - Input data to validate
   * @param {import('zod').ZodSchema} schema - Zod schema
   * @returns {object} Parsed (validated + transformed) data
   */
  validate(data, schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new AppError(400, 'PROVIDER_VALIDATION_ERROR',
        `${this.name} validation failed.`,
        { provider: this.id, issues: result.error.issues });
    }
    return result.data;
  }
}

module.exports = BaseProvider;
