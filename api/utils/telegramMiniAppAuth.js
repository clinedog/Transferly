const { createHmac, timingSafeEqual } = require('node:crypto');

const { AppError } = require('./errors');

function parseInitData(initData) {
  const rawInitData = String(initData || '').trim();
  if (!rawInitData) {
    throw new AppError(401, 'TELEGRAM_INIT_DATA_EMPTY', 'Telegram init data is empty.');
  }

  const params = new URLSearchParams(rawInitData);
  const hash = params.get('hash');

  if (!hash) {
    throw new AppError(401, 'TELEGRAM_INIT_DATA_HASH_REQUIRED', 'Telegram init data signature is required.');
  }

  const dataCheckPairs = [];
  const parsed = {};

  for (const [key, value] of params.entries()) {
    if (key === 'hash') {
      continue;
    }

    dataCheckPairs.push(`${key}=${value}`);
    parsed[key] = value;
  }

  dataCheckPairs.sort();

  if (!dataCheckPairs.length) {
    throw new AppError(401, 'TELEGRAM_INIT_DATA_EMPTY', 'Telegram init data is empty.');
  }

  let user = null;
  if (parsed.user) {
    try {
      user = JSON.parse(parsed.user);
    } catch (_error) {
      throw new AppError(401, 'TELEGRAM_INIT_DATA_USER_INVALID', 'Telegram user payload is invalid.');
    }
  }

  return {
    hash,
    dataCheckString: dataCheckPairs.join('\n'),
    authDate: parsed.auth_date ? Number(parsed.auth_date) : null,
    startParam: parsed.start_param || '',
    chatInstance: parsed.chat_instance || '',
    chatType: parsed.chat_type || '',
    user
  };
}

function verifySignature({ hash, dataCheckString, botToken }) {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(String(hash), 'hex');

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError(401, 'TELEGRAM_INIT_DATA_INVALID', 'Telegram init data signature is invalid.');
  }
}

function verifyAuthDate(
  authDate,
  expiresInSeconds,
  nowSeconds = Math.floor(Date.now() / 1000),
  futureSkewSeconds = 30
) {
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new AppError(
      503,
      'TELEGRAM_INIT_DATA_EXPIRY_INVALID',
      'Telegram Mini App authentication expiry is not configured safely.'
    );
  }

  if (!Number.isInteger(authDate) || authDate <= 0) {
    throw new AppError(401, 'TELEGRAM_AUTH_DATE_INVALID', 'Telegram init data auth date is invalid.');
  }

  if (authDate > nowSeconds + futureSkewSeconds) {
    throw new AppError(401, 'TELEGRAM_AUTH_DATE_INVALID', 'Telegram init data auth date is invalid.');
  }

  if (nowSeconds - authDate > expiresInSeconds) {
    throw new AppError(401, 'TELEGRAM_INIT_DATA_EXPIRED', 'Telegram init data has expired.');
  }
}

function validateTelegramMiniAppInitData(initData, { botToken, expiresInSeconds, futureSkewSeconds } = {}) {
  if (!botToken) {
    throw new AppError(503, 'TELEGRAM_MINI_APP_AUTH_DISABLED', 'Telegram Mini App authentication is not configured.');
  }

  const parsed = parseInitData(initData);
  verifySignature({
    hash: parsed.hash,
    dataCheckString: parsed.dataCheckString,
    botToken
  });
  verifyAuthDate(parsed.authDate, expiresInSeconds, undefined, futureSkewSeconds);

  if (!parsed.user || !parsed.user.id) {
    throw new AppError(401, 'TELEGRAM_USER_REQUIRED', 'Telegram init data does not include a user.');
  }

  return parsed;
}

module.exports = {
  validateTelegramMiniAppInitData
};
