'use strict';

/**
 * StripeClient — production-ready HTTP client for the Stripe REST API.
 *
 * Handles:
 *  - Bearer auth (STRIPE_SECRET_KEY via Authorization header)
 *  - Stripe-Version header
 *  - Automatic retries with exponential back-off for 429 / 5xx
 *  - Stripe-Request-Id forwarded in error context
 *  - Never logs the secret key or raw card / payout data
 */

const https = require('node:https');
const { AppError } = require('../../utils/errors');

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

class StripeClient {
  /**
   * @param {object} opts
   * @param {string} opts.secretKey     Stripe secret key (sk_live_… or sk_test_…)
   * @param {string} [opts.apiVersion]  Stripe-Version header value
   * @param {string} [opts.baseUrl]     Override for the base URL (testing)
   * @param {object} [opts.logger]      Pino-compatible logger
   */
  constructor({
    secretKey = '',
    apiVersion = '2026-02-25.clover',
    baseUrl = 'https://api.stripe.com',
    logger = console
  } = {}) {
    this.secretKey = secretKey;
    this.apiVersion = apiVersion;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.logger = logger;
  }

  // ---------------------------------------------------------------------------
  // Core HTTP
  // ---------------------------------------------------------------------------

  /**
   * Execute an authenticated request to the Stripe API.
   *
   * @param {string} path     e.g. '/v1/balance'
   * @param {object} [opts]   { method, query, body }
   * @returns {Promise<object>} Parsed JSON response body
   */
  async request(path, { method = 'GET', query = {}, body = null } = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const headers = {
      Authorization: `Bearer ${this.secretKey}`,
      'Stripe-Version': this.apiVersion,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Transferly/1.0'
    };

    const bodyStr = body ? new URLSearchParams(body).toString() : null;
    if (bodyStr) headers['Content-Length'] = String(Buffer.byteLength(bodyStr));

    return this._executeWithRetry(url, method, headers, bodyStr, 0);
  }

  async _executeWithRetry(url, method, headers, body, attempt) {
    try {
      return await this._executeRequest(url, method, headers, body);
    } catch (err) {
      const status = err.statusCode || 0;
      if (attempt < MAX_RETRIES && (RETRYABLE_STATUS_CODES.has(status) || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
        const delay = BASE_RETRY_DELAY_MS * 2 ** attempt;
        this.logger.warn({ attempt, status, delay }, 'stripe.client: retrying request');
        await new Promise((r) => setTimeout(r, delay));
        return this._executeWithRetry(url, method, headers, body, attempt + 1);
      }
      throw err;
    }
  }

  _executeRequest(url, method, headers, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: REQUEST_TIMEOUT_MS
      };

      const req = https.request(opts, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            parsed = {};
          }

          if (res.statusCode >= 400) {
            const code = parsed?.error?.code || 'STRIPE_API_ERROR';
            const message = parsed?.error?.message || `Stripe responded with ${res.statusCode}`;
            const err = new AppError(res.statusCode, code, message, {
              provider: 'stripe',
              stripeRequestId: res.headers['request-id'] || '',
              type: parsed?.error?.type
            });
            return reject(err);
          }

          resolve(parsed);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new AppError(408, 'STRIPE_TIMEOUT', 'Stripe request timed out', { provider: 'stripe' }));
      });

      req.on('error', (err) => {
        reject(new AppError(503, 'STRIPE_NETWORK_ERROR', err.message, { provider: 'stripe', code: err.code }));
      });

      if (body) req.write(body);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Provider operations
  // ---------------------------------------------------------------------------

  /**
   * Retrieve account balance.
   * @returns {Promise<object>}
   */
  async getBalance() {
    if (!this.secretKey) return null;
    return this.request('/v1/balance');
  }

  /**
   * List payment intents.
   * @param {object} [params]  { limit, starting_after, customer, currency }
   * @returns {Promise<object>} Stripe list object { data, has_more, url }
   */
  async listPaymentIntents(params = {}) {
    if (!this.secretKey) return { data: [], has_more: false };
    const { limit = 25, starting_after, customer, currency, status } = params;
    return this.request('/v1/payment_intents', {
      query: { limit, starting_after, customer, currency, status }
    });
  }

  /**
   * Create a payment intent.
   * @param {object} params  { amount, currency, description, metadata }
   * @returns {Promise<object>}
   */
  async createPaymentIntent(params = {}) {
    return this.request('/v1/payment_intents', {
      method: 'POST',
      body: params
    });
  }

  /**
   * List invoices.
   * @param {object} [params]  { limit, customer, status, starting_after }
   * @returns {Promise<object>}
   */
  async listInvoices(params = {}) {
    if (!this.secretKey) return { data: [], has_more: false };
    const { limit = 25, starting_after, customer, status } = params;
    return this.request('/v1/invoices', {
      query: { limit, starting_after, customer, status }
    });
  }

  /**
   * Create a transfer to a connected account.
   * @param {object} params  { amount, currency, destination, description }
   * @returns {Promise<object>}
   */
  async createTransfer(params = {}) {
    return this.request('/v1/transfers', {
      method: 'POST',
      body: params
    });
  }

  /**
   * Retrieve a balance transaction.
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getBalanceTransaction(id) {
    return this.request(`/v1/balance_transactions/${encodeURIComponent(id)}`);
  }
}

module.exports = StripeClient;
