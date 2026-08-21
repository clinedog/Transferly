const assert = require('node:assert/strict');
const { test } = require('node:test');

const { telegramMiniAppLoginSchema } = require('../schemas/authSchemas');

test('Telegram Mini App login schema rejects client-supplied identity claims', () => {
  assert.throws(
    () => telegramMiniAppLoginSchema.parse({
      initData: 'auth_date=1&user={}&hash=abc',
      startParam: 'dashboard',
      userId: 'attacker-user',
      role: 'OWNER',
      isAdmin: true,
      isOwner: true
    }),
    (error) => {
      assert.equal(error.issues?.[0]?.code, 'unrecognized_keys');
      return true;
    }
  );
});

test('Telegram Mini App login schema accepts only init data and optional start param', () => {
  assert.deepEqual(
    telegramMiniAppLoginSchema.parse({
      initData: 'auth_date=1&user={}&hash=abc',
      startParam: 'dashboard'
    }),
    {
      initData: 'auth_date=1&user={}&hash=abc',
      startParam: 'dashboard'
    }
  );
});