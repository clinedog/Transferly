'use strict';

/*
 * Configuration for the Telegram bot
 */

require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const { parseTelegramUserIds } = require('./utils/telegramAuthorization');
const required = ['ADMIN_TELEGRAM_ID', 'ADMIN_TELEGRAM_USERNAME', 'API_URL', 'BOT_TOKEN'];
const configuredMiniAppUrl = process.env.MINI_APP_URL || process.env.WEB_APP_URL || process.env.FRONTEND_URL;
if (isProduction && !configuredMiniAppUrl) {
  required.push('MINI_APP_URL');
}
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Bot environment is missing required variables:');
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error('Edit bot/.env and supply the values. You can scaffold the file with `npm run setup --prefix bot` from the repo root.');
  process.exit(1);
}

const apiSecret = process.env.API_SECRET;
const adminApiToken = process.env.ADMIN_API_TOKEN || apiSecret;
const apiHmacSecret = process.env.API_HMAC_SECRET || '';
if (!adminApiToken) {
  console.error('❌ Bot environment is missing API credentials. Set API_SECRET or ADMIN_API_TOKEN.');
  process.exit(1);
}
if (isProduction && !apiHmacSecret) {
  console.error('❌ Bot environment is missing API_HMAC_SECRET for signed bot-to-API requests.');
  process.exit(1);
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

try {
  // eslint-disable-next-line no-new
  new URL(process.env.API_URL);
} catch (error) {
  fail(`Invalid API_URL: ${process.env.API_URL || 'undefined'} (${error.message})`);
}

function optionalUrl(value, key, options = {}) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (options.requireHttps && parsed.protocol !== 'https:') {
      fail(`Invalid ${key}: ${trimmed} (HTTPS is required in production)`);
    }
    return parsed.toString();
  } catch (error) {
    fail(`Invalid ${key}: ${trimmed} (${error.message})`);
  }
}

function optionalInteger(value, fallback, key) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail(`Invalid ${key}: ${raw}`);
  }
  return parsed;
}

function webhookPath(value) {
  const path = String(value || '/telegram/webhook').trim();
  if (!path.startsWith('/')) {
    fail(`Invalid BOT_WEBHOOK_PATH: ${path}. It must start with "/".`);
  }
  if (/\s/.test(path)) {
    fail(`Invalid BOT_WEBHOOK_PATH: ${path}. Whitespace is not allowed.`);
  }
  return path;
}

function webhookSecret(value) {
  const secret = String(value || '').trim();
  if (!secret) return '';
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    fail('Invalid BOT_WEBHOOK_SECRET. Use 1-256 characters from A-Z, a-z, 0-9, "_" or "-".');
  }
  return secret;
}

function updateMode(value) {
  const mode = String(value || 'polling').trim().toLowerCase();
  if (!['polling', 'webhook'].includes(mode)) {
    fail(`Invalid BOT_UPDATE_MODE: ${mode}. Use "polling" or "webhook".`);
  }
  return mode;
}

function optionalBoolean(value, fallback) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function allowedUpdates(value) {
  const knownUpdates = new Set([
    'message',
    'edited_message',
    'channel_post',
    'edited_channel_post',
    'business_connection',
    'business_message',
    'edited_business_message',
    'deleted_business_messages',
    'message_reaction',
    'message_reaction_count',
    'inline_query',
    'chosen_inline_result',
    'callback_query',
    'shipping_query',
    'pre_checkout_query',
    'poll',
    'poll_answer',
    'my_chat_member',
    'chat_member',
    'chat_join_request',
    'chat_boost',
    'removed_chat_boost',
  ]);
  const raw = String(value || '').trim();
  if (!raw) return ['message', 'callback_query'];
  const updates = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = updates.filter((item) => !knownUpdates.has(item));
  if (invalid.length > 0) {
    fail(`Invalid BOT_ALLOWED_UPDATES value(s): ${invalid.join(', ')}`);
  }
  return updates;
}

function optionalHostList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function validateMiniAppHost(url, allowedHosts) {
  if (!url || allowedHosts.length === 0) return;
  const host = new URL(url).host.toLowerCase();
  if (!allowedHosts.includes(host)) {
    fail(`MINI_APP_URL host "${host}" is not present in BOT_ALLOWED_MINI_APP_HOSTS.`);
  }
}

const updateDeliveryMode = updateMode(process.env.BOT_UPDATE_MODE);
const configuredWebhookSecret = webhookSecret(process.env.BOT_WEBHOOK_SECRET);
if (isProduction && updateDeliveryMode === 'webhook' && !configuredWebhookSecret) {
  fail('BOT_WEBHOOK_SECRET is required for production webhook mode.');
}
if (isProduction && !/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(process.env.BOT_TOKEN || '')) {
  fail('BOT_TOKEN does not look like a valid Telegram bot token.');
}
if (isProduction && updateDeliveryMode === 'webhook' && configuredWebhookSecret.length < 32) {
  fail('BOT_WEBHOOK_SECRET must be at least 32 characters in production webhook mode.');
}
const miniAppUrl = optionalUrl(configuredMiniAppUrl, 'MINI_APP_URL', { requireHttps: isProduction });
const allowedMiniAppHosts = optionalHostList(process.env.BOT_ALLOWED_MINI_APP_HOSTS);
validateMiniAppHost(miniAppUrl, allowedMiniAppHosts);
const configuredOwnerIds = parseTelegramUserIds(
  process.env.TRANSFERLY_OWNER_TELEGRAM_USER_IDS,
  process.env.OWNER_TELEGRAM_ID
);
const configuredAdminIds = parseTelegramUserIds(
  process.env.TRANSFERLY_ADMIN_TELEGRAM_USER_IDS,
  process.env.ADMIN_TELEGRAM_ID
);

// Check for required environment variables

module.exports = {
  nodeEnv,
  isProduction,
  admin: {
    userId: process.env.ADMIN_TELEGRAM_ID,
    ownerId: process.env.OWNER_TELEGRAM_ID || process.env.ADMIN_TELEGRAM_ID,
    ownerExplicit: Boolean(process.env.OWNER_TELEGRAM_ID),
    username: process.env.ADMIN_TELEGRAM_USERNAME,
    apiToken: adminApiToken,
    ownerIds: configuredOwnerIds,
    adminIds: configuredAdminIds
  },
  apiUrl: process.env.API_URL,
  miniAppUrl,
  botToken: process.env.BOT_TOKEN,
  scriptsApiUrl: process.env.API_URL,
  apiAuth: {
    hmacSecret: apiHmacSecret,
  },
  updates: {
    mode: updateDeliveryMode,
    webhookUrl: optionalUrl(process.env.BOT_WEBHOOK_URL, 'BOT_WEBHOOK_URL', {
      requireHttps: isProduction && updateDeliveryMode === 'webhook',
    }),
    webhookPath: webhookPath(process.env.BOT_WEBHOOK_PATH),
    webhookSecret: configuredWebhookSecret,
    port: optionalInteger(process.env.BOT_PORT || process.env.PORT, 8080, 'BOT_PORT'),
    allowedUpdates: allowedUpdates(process.env.BOT_ALLOWED_UPDATES),
    dropPendingUpdates: optionalBoolean(process.env.BOT_DROP_PENDING_UPDATES, false),
  },
  runtime: {
    requireApiReady: optionalBoolean(process.env.BOT_REQUIRE_API_READY, false),
    configureMenuButton: optionalBoolean(process.env.BOT_CONFIGURE_MENU_BUTTON, true),
    runSubscriptionAlertSweep: optionalBoolean(process.env.BOT_RUN_SUBSCRIPTION_ALERT_SWEEP, false),
    runSessionCleanup: optionalBoolean(process.env.BOT_RUN_SESSION_CLEANUP, true),
    updateDedupeTtlMs: optionalInteger(process.env.BOT_UPDATE_DEDUPE_TTL_MS, 10 * 60 * 1000, 'BOT_UPDATE_DEDUPE_TTL_MS'),
    updateDedupeMaxEntries: optionalInteger(process.env.BOT_UPDATE_DEDUPE_MAX_ENTRIES, 5000, 'BOT_UPDATE_DEDUPE_MAX_ENTRIES'),
  },
  security: {
    allowedMiniAppHosts,
  },
};
