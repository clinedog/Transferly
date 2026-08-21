const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { describe, test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'telegram-auth-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'telegram-auth-webhook';

const { validateTelegramMiniAppInitData } = require('../utils/telegramMiniAppAuth');

const botToken = '1234567890:test-mini-app-token';

function createInitData({ user, authDate, token = botToken }) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  if (user !== undefined) {
    params.set('user', JSON.stringify(user));
  }

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);

  return params.toString();
}

function assertTelegramError(fn, code, status) {
  assert.throws(
    fn,
    (error) => {
      assert.equal(error.code, code);
      assert.equal(error.statusCode, status);
      return true;
    }
  );
}

function currentAuthDate() {
  return Math.floor(Date.now() / 1000);
}

describe('Telegram Mini App init data validation', () => {
  test('rejects empty init data before signature validation', () => {
    assertTelegramError(
      () =>
        validateTelegramMiniAppInitData('', {
          botToken,
          expiresInSeconds: 3600
        }),
      'TELEGRAM_INIT_DATA_EMPTY',
      401
    );
  });

  test('accepts signed init data inside the configured expiry window', () => {
    const parsed = validateTelegramMiniAppInitData(
      createInitData({
        authDate: currentAuthDate(),
        user: {
          id: 12345,
          first_name: 'Transferly'
        }
      }),
      {
        botToken,
        expiresInSeconds: 3600
      }
    );

    assert.equal(parsed.user.id, 12345);
  });

  test('rejects expired init data instead of falling back to guest mode', () => {
    assertTelegramError(
      () =>
        validateTelegramMiniAppInitData(
          createInitData({
            authDate: currentAuthDate() - 3601,
            user: {
              id: 12345
            }
          }),
          {
            botToken,
            expiresInSeconds: 3600
          }
        ),
      'TELEGRAM_INIT_DATA_EXPIRED',
      401
    );
  });

  test('rejects future auth dates and missing Telegram users', () => {
    assertTelegramError(
      () =>
        validateTelegramMiniAppInitData(
          createInitData({
            authDate: currentAuthDate() + 31,
            user: {
              id: 12345
            }
          }),
          {
            botToken,
            expiresInSeconds: 3600
          }
        ),
      'TELEGRAM_AUTH_DATE_INVALID',
      401
    );

    const acceptedWithExplicitGrace = validateTelegramMiniAppInitData(
      createInitData({
        authDate: currentAuthDate() + 31,
        user: {
          id: 12345
        }
      }),
      {
        botToken,
        expiresInSeconds: 3600,
        futureSkewSeconds: 60
      }
    );
    assert.equal(acceptedWithExplicitGrace.user.id, 12345);

    assertTelegramError(
      () =>
        validateTelegramMiniAppInitData(createInitData({ authDate: currentAuthDate() }), {
          botToken,
          expiresInSeconds: 3600
        }),
      'TELEGRAM_USER_REQUIRED',
      401
    );
  });

  test('rejects unsafe expiry configuration before accepting signed data', () => {
    assertTelegramError(
      () =>
        validateTelegramMiniAppInitData(
          createInitData({
            authDate: currentAuthDate(),
            user: {
              id: 12345
            }
          }),
          {
            botToken,
            expiresInSeconds: 0
          }
        ),
      'TELEGRAM_INIT_DATA_EXPIRY_INVALID',
      503
    );
  });
});
