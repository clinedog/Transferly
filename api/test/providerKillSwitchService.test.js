'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { providerKillSwitchService } = require('../services/providerKillSwitchService');

test('provider kill switch blocks the provider regardless of corridor', () => {
  assert.match(
    providerKillSwitchService.getBlockedReason({
      provider: 'PayPal',
      country: 'NG',
      currency: 'NGN',
      policy: { providers: 'paypal', corridors: '' }
    }),
    /provider paypal/i
  );
});

test('corridor kill switch supports exact and wildcard scopes', () => {
  assert.equal(
    providerKillSwitchService.isBlocked({
      provider: 'paypal',
      country: 'NG',
      currency: 'NGN',
      policy: { providers: '', corridors: 'paypal:ng:ngn' }
    }),
    true
  );
  assert.equal(
    providerKillSwitchService.isBlocked({
      provider: 'paypal',
      country: 'GH',
      currency: 'NGN',
      policy: { providers: '', corridors: 'paypal:*:ngn' }
    }),
    true
  );
  assert.equal(
    providerKillSwitchService.isBlocked({
      provider: 'paypal',
      country: 'GH',
      currency: 'USD',
      policy: { providers: '', corridors: 'paypal:ng:*' }
    }),
    false
  );
});
