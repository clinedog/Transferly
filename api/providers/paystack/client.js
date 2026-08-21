'use strict';

/**
 * PaystackClient — production-ready HTTP client for the Paystack API.
 *
 * Handles:
 *  - Bearer token auth (PAYSTACK_SECRET_KEY)
 *  - Retries for 429 / 5xx with exponential back-off
 *  - Structured error parsing from Paystack's envelope format
 *  - Never logs secret key or card / bank account details
 *
 * Docs: https://paystack.com/docs/api/
 */

const https = require('node:https');
const { AppError } = require('../../utils/errors');

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

class PaystackClient {
  constructor({
    secretKey = '',
    baseUrl = 'https://api.paystack.co',
    logger = console
  } = {}) {
    this.secretKey = secretKey;
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
      Authorization: `Bearer ${this.secretKey}`,
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
        this.logger.warn({ attempt, status, delay }, 'paystack.client: retrying request');
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

          if (res.statusCode >= 400 || parsed?.status === false) {
            const message = parsed?.message || `Paystack responded with ${res.statusCode}`;
            return reject(new AppError(res.statusCode, 'PAYSTACK_API_ERROR', message, { provider: 'paystack' }));
          }

          // Paystack wraps successful responses in { status: true, message, data }
          resolve(parsed?.data !== undefined ? parsed.data : parsed);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new AppError(408, 'PAYSTACK_TIMEOUT', 'Paystack request timed out', { provider: 'paystack' }));
      });

      req.on('error', (err) => {
        reject(new AppError(503, 'PAYSTACK_NETWORK_ERROR', err.message, { provider: 'paystack', code: err.code }));
      });

      if (body) req.write(body);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Provider operations
  // ---------------------------------------------------------------------------

  /** GET /balance — returns array of per-currency balances */
  async getBalance() {
    if (!this.secretKey) return null;
    return this.request('/balance');
  }

  /**
   * GET /transaction
   * @param {object} [params]  { perPage, page, status, customer, currency, from, to }
   */
  async listTransactions(params = {}) {
    if (!this.secretKey) return { data: [], meta: { total: 0 } };
    const { perPage = 25, page = 1, status, customer, currency, from, to } = params;
    return this.request('/transaction', {
      query: { perPage, page, status, customer, currency, from, to }
    });
  }

  /** GET /transaction/{id} */
  async getTransaction(id) {
    return this.request(`/transaction/${encodeURIComponent(id)}`);
  }

  /**
   * POST /transaction/initialize — create a payment (returns authorization_url)
   * @param {object} params  { email, amount (kobo), currency, reference, metadata }
   */
  async initializeTransaction(params = {}) {
    return this.request('/transaction/initialize', { method: 'POST', body: params });
  }

  /**
   * POST /transfer — initiate a transfer (payout)
   * @param {object} params  { source, amount, recipient, reason, currency, reference }
   */
  async initiateTransfer(params = {}) {
    return this.request('/transfer', { method: 'POST', body: params });
  }
}

module.exports = PaystackClient;
