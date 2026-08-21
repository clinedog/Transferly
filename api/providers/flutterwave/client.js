'use strict';

/**
 * FlutterwaveClient — production-ready HTTP client for the Flutterwave v3 API.
 *
 * Handles:
 *  - Bearer auth (FLUTTERWAVE_SECRET_KEY)
 *  - Retries for 429 / 5xx with exponential back-off
 *  - Flutterwave envelope parsing ({ status, message, data })
 *  - Never logs the secret key or card / bank account details
 *
 * Docs: https://developer.flutterwave.com/docs
 */

const https = require('node:https');
const { AppError } = require('../../utils/errors');

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

class FlutterwaveClient {
  constructor({
    secretKey = '',
    baseUrl = 'https://api.flutterwave.com/v3',
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
        this.logger.warn({ attempt, status, delay }, 'flutterwave.client: retrying request');
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

          if (res.statusCode >= 400 || parsed?.status === 'error') {
            const message = parsed?.message || `Flutterwave responded with ${res.statusCode}`;
            return reject(new AppError(res.statusCode, 'FLUTTERWAVE_API_ERROR', message, { provider: 'flutterwave' }));
          }

          // Flutterwave wraps responses in { status: 'success', message, data }
          resolve(parsed?.data !== undefined ? parsed.data : parsed);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new AppError(408, 'FLUTTERWAVE_TIMEOUT', 'Flutterwave request timed out', { provider: 'flutterwave' }));
      });

      req.on('error', (err) => {
        reject(new AppError(503, 'FLUTTERWAVE_NETWORK_ERROR', err.message, { provider: 'flutterwave', code: err.code }));
      });

      if (body) req.write(body);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Provider operations
  // ---------------------------------------------------------------------------

  /**
   * GET /balances/{currency}
   * @param {string} [currency]  e.g. 'NGN', 'USD', 'GHS'
   */
  async getBalance(currency = 'NGN') {
    if (!this.secretKey) return null;
    return this.request(`/balances/${encodeURIComponent(currency)}`);
  }

  /** GET /balances — all currency balances */
  async getAllBalances() {
    if (!this.secretKey) return [];
    return this.request('/balances');
  }

  /**
   * GET /transactions
   * @param {object} [params]  { page, per_page, status, currency, from, to, customer_email, tx_ref }
   */
  async listTransactions(params = {}) {
    if (!this.secretKey) return { data: [], meta: { total: 0 } };
    const { page = 1, per_page = 25, status, currency, from, to, customer_email, tx_ref } = params;
    return this.request('/transactions', {
      query: { page, per_page, status, currency, from, to, customer_email, tx_ref }
    });
  }

  /** GET /transactions/{id} */
  async getTransaction(id) {
    return this.request(`/transactions/${encodeURIComponent(id)}`);
  }

  /**
   * POST /payments — initiate a payment charge
   * @param {object} params  { tx_ref, amount, currency, redirect_url, customer, meta }
   */
  async initiatePayment(params = {}) {
    return this.request('/payments', { method: 'POST', body: params });
  }

  /**
   * POST /transfers — initiate a transfer (payout)
   * @param {object} params  { account_bank, account_number, amount, currency, narration, reference }
   */
  async createTransfer(params = {}) {
    return this.request('/transfers', { method: 'POST', body: params });
  }
}

module.exports = FlutterwaveClient;
