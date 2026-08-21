const pino = require('pino');

const config = require('../config');

const REDACT_PATHS = Object.freeze([
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.x-api-signature',
  'req.headers.x-telegram-init-data',
  'req.headers.x-telegram-bot-api-secret-token',
  'headers.authorization',
  'headers.cookie',
  'headers.x-api-signature',
  'headers.x-telegram-init-data',
  'headers.x-telegram-bot-api-secret-token',
  'authorization',
  'cookie',
  'token',
  'access_token',
  'refresh_token',
  'initData',
  'telegramInitData',
  'clientSecret',
  'client_secret',
  'webhookSecret',
  'webhook_secret',
  'apiKey',
  'api_key',
  'signature',
  '*.authorization',
  '*.cookie',
  '*.token',
  '*.access_token',
  '*.refresh_token',
  '*.initData',
  '*.telegramInitData',
  '*.clientSecret',
  '*.client_secret',
  '*.webhookSecret',
  '*.webhook_secret',
  '*.apiKey',
  '*.api_key',
  '*.signature'
]);

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [...REDACT_PATHS],
    censor: '[redacted]'
  }
});

module.exports = {
  REDACT_PATHS,
  logger
};
