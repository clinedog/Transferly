'use strict';

/**
 * WiseClient — production-ready HTTP client for the Wise (TransferWise) Platform API.
 *
 * Handles:
 *  - Bearer token auth (WISE_API_TOKEN)
 *  - Profile-scoped endpoints
 *  - Retries for 429 / 5xx with back-off
 *  - Never logs the API token or IBAN / account details
 *
 * Docs: https://docs.wise.com/api-docs/
 */

const https = require('node:https');
const { AppError } = require('../../utils/errors');

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

class WiseClient {
  constructor({
    apiToken = '',
    profileId = '',
    baseUrl = 'https://api.transferwise.com',
    logger = console
  } = {}) {
    this.apiToken = apiToken;
    this.profileId = profileId;
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
      Authorization: `Bearer ${this.apiToken}`,
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
        this.logger.warn({ attempt, status, delay }, 'wise.client: retrying request');
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
            const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
            const message = errors[0]?.message || parsed?.message || `Wise responded with ${res.statusCode}`;
            const code = errors[0]?.code || 'WISE_API_ERROR';
            return reject(new AppError(res.statusCode, code, message, { provider: 'wise' }));
          }

          resolve(parsed);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new AppError(408, 'WISE_TIMEOUT', 'Wise request timed out', { provider: 'wise' }));
      });

      req.on('error', (err) => {
        reject(new AppError(503, 'WISE_NETWORK_ERROR', err.message, { provider: 'wise', code: err.code }));
      });

      if (body) req.write(body);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Provider operations
  // ---------------------------------------------------------------------------

  /** GET /v4/profiles/{profileId}/balances?types=STANDARD */
  async getBalances() {
    if (!this.apiToken || !this.profileId) return [];
    return this.request(`/v4/profiles/${encodeURIComponent(this.profileId)}/balances`, {
      query: { types: 'STANDARD' }
    });
  }

  /**
   * GET /v1/transfers?profile={profileId}
   * @param {object} [params]  { limit, offset, status, sourceCurrency, targetCurrency }
   */
  async listTransfers(params = {}) {
    if (!this.apiToken || !this.profileId) return { content: [], totalElements: 0 };
    const { limit = 25, offset = 0, status, sourceCurrency, targetCurrency } = params;
    return this.request('/v1/transfers', {
      query: { profile: this.profileId, limit, offset, status, sourceCurrency, targetCurrency }
    });
  }

  /** GET /v1/transfers/{transferId} */
  async getTransfer(transferId) {
    return this.request(`/v1/transfers/${encodeURIComponent(transferId)}`);
  }

  /**
   * POST /v3/profiles/{profileId}/quotes  — preview FX rate + cost
   * @param {object} params  { sourceCurrency, targetCurrency, targetAmount, payOut }
   */
  async createQuote(params = {}) {
    return this.request(`/v3/profiles/${encodeURIComponent(this.profileId)}/quotes`, {
      method: 'POST',
      body: params
    });
  }

  /**
   * POST /v1/transfers
   * @param {object} params  { targetAccount, quoteUuid, customerTransactionId, details }
   */
  async createTransfer(params = {}) {
    return this.request('/v1/transfers', { method: 'POST', body: params });
  }
}

module.exports = WiseClient;
