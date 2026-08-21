'use strict';

/**
 * CryptoCommerceClient — production-ready HTTP client for the Coinbase Commerce API.
 *
 * Handles:
 *  - X-CC-Api-Key header auth (CRYPTO_COMMERCE_API_KEY)
 *  - Retries for 429 / 5xx with exponential back-off
 *  - Coinbase Commerce envelope parsing
 *  - Never logs API keys, wallet addresses, or private keys
 *
 * Docs: https://docs.cloud.coinbase.com/commerce/reference/
 */

const https = require('node:https');
const { AppError } = require('../../utils/errors');

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const API_VERSION = '2018-03-22';

class CryptoCommerceClient {
  constructor({
    apiKey = '',
    baseUrl = 'https://api.commerce.coinbase.com',
    logger = console
  } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.logger = logger;
  }

  // ---------------------------------------------------------------------------
  // Core HTTP
  // ---------------------------------------------------------------------------

  async request(path, { method = 'GET', query = {}, body = null } = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const headers = {
      'X-CC-Api-Key': this.apiKey,
      'X-CC-Version': API_VERSION,
      'Content-Type': 'application/json',
      'User-Agent': 'Transferly/1.0'
    };

    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = String(Buffer.byteLength(bodyStr));

    return this._executeWithRetry(url, method, headers, bodyStr, 0);
  }

  async _executeWithRetry(url, method, headers, body, attempt) {
    try {
      return await this._executeRequest(url, method, headers, body);
    } catch (err) {
      const status = err.statusCode || 0;
      if (attempt < MAX_RETRIES && (RETRYABLE_STATUS_CODES.has(status) || err.code === 'ECONNRESET')) {
        const delay = BASE_RETRY_DELAY_MS * 2 ** attempt;
        this.logger.warn({ attempt, status, delay }, 'crypto.client: retrying request');
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
            const error = parsed?.error || {};
            const message = error.message || `Coinbase Commerce responded with ${res.statusCode}`;
            const code = error.type || 'CRYPTO_COMMERCE_API_ERROR';
            return reject(new AppError(res.statusCode, code, message, { provider: 'crypto' }));
          }

          // Commerce wraps responses in { data: ... } or { data: [...] }
          resolve(parsed?.data !== undefined ? parsed : parsed);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new AppError(408, 'CRYPTO_COMMERCE_TIMEOUT', 'Coinbase Commerce request timed out', { provider: 'crypto' }));
      });

      req.on('error', (err) => {
        reject(new AppError(503, 'CRYPTO_COMMERCE_NETWORK_ERROR', err.message, { provider: 'crypto', code: err.code }));
      });

      if (body) req.write(body);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Provider operations
  // ---------------------------------------------------------------------------

  /**
   * GET /charges — list all charges (paginated)
   * @param {object} [params]  { limit, starting_after, ending_before }
   */
  async listCharges(params = {}) {
    if (!this.apiKey) return { data: [], pagination: {} };
    const { limit = 25, starting_after, ending_before } = params;
    return this.request('/charges', {
      query: { limit, starting_after, ending_before }
    });
  }

  /** GET /charges/{chargeId} */
  async getCharge(chargeId) {
    return this.request(`/charges/${encodeURIComponent(chargeId)}`);
  }

  /**
   * POST /charges — create a new charge
   * @param {object} params  { name, description, pricing_type, local_price: { amount, currency }, metadata }
   */
  async createCharge(params = {}) {
    return this.request('/charges', { method: 'POST', body: params });
  }

  /** POST /charges/{chargeId}/cancel */
  async cancelCharge(chargeId) {
    return this.request(`/charges/${encodeURIComponent(chargeId)}/cancel`, { method: 'POST' });
  }

  /**
   * GET /events — list webhook events
   * @param {object} [params]  { limit, starting_after }
   */
  async listEvents(params = {}) {
    if (!this.apiKey) return { data: [] };
    const { limit = 25, starting_after } = params;
    return this.request('/events', { query: { limit, starting_after } });
  }
}

module.exports = CryptoCommerceClient;
