'use strict';

/**
 * Centralized provider configuration.
 *
 * Each provider has a typed config shape derived from api/config.js environment
 * values. This is the single place that maps raw env vars into structured,
 * provider-scoped config objects that clients, services, and adapters consume.
 *
 * Usage:
 *   const { getProviderConfig, isProviderConfigured } = require('./providerConfig');
 *   const cfg = getProviderConfig('stripe');
 *   if (!cfg.configured) throw new Error('Stripe not configured');
 */

const config = require('../../config');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNonEmpty(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function buildConfigEntry(key, fields, values) {
  const missingKeys = Object.keys(fields).filter((field) => !isNonEmpty(values[field]));
  return Object.freeze({
    key,
    configured: missingKeys.length === 0,
    missingKeys,
    ...values
  });
}

// ---------------------------------------------------------------------------
// Per-provider config shapes
// ---------------------------------------------------------------------------

function buildPayPalConfig() {
  return buildConfigEntry('paypal', { clientId: true, clientSecret: true, webhookId: true }, {
    clientId: config.PAYPAL_CLIENT_ID || '',
    clientSecret: config.PAYPAL_CLIENT_SECRET || '',
    webhookId: config.PAYPAL_WEBHOOK_ID || '',
    environment: config.PAYPAL_ENVIRONMENT || 'sandbox',
    baseUrl: config.PAYPAL_ENVIRONMENT === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com'
  });
}

function buildStripeConfig() {
  return buildConfigEntry('stripe', { secretKey: true }, {
    secretKey: config.STRIPE_SECRET_KEY || '',
    webhookSecret: config.STRIPE_WEBHOOK_SECRET || '',
    connectClientId: config.STRIPE_CONNECT_CLIENT_ID || '',
    connectedAccountId: config.STRIPE_CONNECTED_ACCOUNT_ID || '',
    payoutsEnabled: Boolean(config.STRIPE_PAYOUTS_ENABLED),
    payoutMode: config.STRIPE_PAYOUT_MODE || 'transfer_to_connected_account',
    apiVersion: config.STRIPE_API_VERSION || '2026-02-25.clover',
    baseUrl: config.STRIPE_API_BASE_URL || 'https://api.stripe.com'
  });
}

function buildWiseConfig() {
  return buildConfigEntry('wise', { apiToken: true, profileId: true }, {
    apiToken: config.WISE_API_TOKEN || '',
    profileId: config.WISE_PROFILE_ID || '',
    webhookPublicKey: config.WISE_WEBHOOK_PUBLIC_KEY || '',
    baseUrl: 'https://api.transferwise.com'
  });
}

function buildPaystackConfig() {
  return buildConfigEntry('paystack', { secretKey: true }, {
    secretKey: config.PAYSTACK_SECRET_KEY || '',
    webhookSecret: config.PAYSTACK_WEBHOOK_SECRET || '',
    baseUrl: 'https://api.paystack.co'
  });
}

function buildFlutterwaveConfig() {
  return buildConfigEntry('flutterwave', { secretKey: true }, {
    secretKey: config.FLUTTERWAVE_SECRET_KEY || '',
    webhookSecret: config.FLUTTERWAVE_WEBHOOK_SECRET || '',
    baseUrl: 'https://api.flutterwave.com'
  });
}

function buildCryptoConfig() {
  return buildConfigEntry('crypto', { apiKey: true }, {
    apiKey: config.CRYPTO_COMMERCE_API_KEY || '',
    webhookSecret: config.CRYPTO_COMMERCE_WEBHOOK_SECRET || '',
    baseUrl: config.CRYPTO_COMMERCE_API_BASE_URL || 'https://api.commerce.coinbase.com'
  });
}

function buildBinanceConfig() {
  return buildConfigEntry('binance', { apiKey: true, apiSecret: true }, {
    apiKey: config.BINANCE_API_KEY || '',
    apiSecret: config.BINANCE_API_SECRET || '',
    baseUrl: config.BINANCE_API_BASE_URL || 'https://api.binance.com'
  });
}

function buildCashAppConfig() {
  return buildConfigEntry('cashapp', { apiKey: true }, {
    apiKey: config.CASH_APP_API_KEY || '',
    environment: config.CASH_APP_ENVIRONMENT || 'sandbox'
  });
}

// ---------------------------------------------------------------------------
// Config registry
// ---------------------------------------------------------------------------

const CONFIG_BUILDERS = Object.freeze({
  paypal: buildPayPalConfig,
  stripe: buildStripeConfig,
  wise: buildWiseConfig,
  paystack: buildPaystackConfig,
  flutterwave: buildFlutterwaveConfig,
  crypto: buildCryptoConfig,
  binance: buildBinanceConfig,
  cashapp: buildCashAppConfig
});

/**
 * Returns the structured config for a provider.
 *
 * @param {string} key - Provider key (e.g. 'paypal', 'stripe')
 * @returns {object} Provider config with a `configured` boolean and `missingKeys` array
 * @throws {Error} if the provider key is unknown
 */
function getProviderConfig(key) {
  const normalized = String(key || '').toLowerCase().trim();
  const builder = CONFIG_BUILDERS[normalized];
  if (!builder) {
    throw new Error(`Unknown provider key: "${key}". Known providers: ${Object.keys(CONFIG_BUILDERS).join(', ')}`);
  }
  return builder();
}

/**
 * Returns true if all required env vars for the provider are non-empty.
 *
 * @param {string} key - Provider key
 * @returns {boolean}
 */
function isProviderConfigured(key) {
  try {
    return getProviderConfig(key).configured;
  } catch {
    return false;
  }
}

/**
 * Returns a summary of all provider configurations (without secret values).
 *
 * @returns {Array<{key: string, configured: boolean, missingKeys: string[]}>}
 */
function listProviderConfigs() {
  return Object.keys(CONFIG_BUILDERS).map((key) => {
    const cfg = getProviderConfig(key);
    return { key, configured: cfg.configured, missingKeys: cfg.missingKeys };
  });
}

module.exports = {
  getProviderConfig,
  isProviderConfigured,
  listProviderConfigs
};
