'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { PAYMENT_STATES, PAYOUT_STATES, TERMINAL_PAYMENT, TERMINAL_PAYOUT, assertPaymentTransition, assertPayoutTransition, isValidPaymentTransition, isValidPayoutTransition } = require('../core/financial/providerStateMachine');
describe('Provider Payment State Machine', () => {
  test('CREATED can transition to PROCESSING, CANCELLED, FAILED, EXPIRED', () => {
    assert.doesNotThrow(() => assertPaymentTransition(PAYMENT_STATES.CREATED, PAYMENT_STATES.PROCESSING));
    assert.doesNotThrow(() => assertPaymentTransition(PAYMENT_STATES.CREATED, PAYMENT_STATES.CANCELLED));
    assert.doesNotThrow(() => assertPaymentTransition(PAYMENT_STATES.CREATED, PAYMENT_STATES.FAILED));
    assert.doesNotThrow(() => assertPaymentTransition(PAYMENT_STATES.CREATED, PAYMENT_STATES.EXPIRED));
  });
  test('SUCCEEDED is terminal', () => {
    assert.throws(() => assertPaymentTransition(PAYMENT_STATES.SUCCEEDED, PAYMENT_STATES.PROCESSING), /Invalid payment transition/);
  });
  test('UNKNOWN must go through RECONCILING first', () => {
    assert.throws(() => assertPaymentTransition(PAYMENT_STATES.UNKNOWN, PAYMENT_STATES.PROCESSING), /Invalid payment transition/);
    assert.doesNotThrow(() => assertPaymentTransition(PAYMENT_STATES.UNKNOWN, PAYMENT_STATES.RECONCILING));
  });
  test('TERMINAL_PAYMENT contains correct states', () => {
    assert.ok(TERMINAL_PAYMENT.includes(PAYMENT_STATES.SUCCEEDED));
    assert.ok(TERMINAL_PAYMENT.includes(PAYMENT_STATES.EXPIRED));
  });
});
describe('Provider Payout State Machine', () => {
  test('REQUESTED transitions correctly', () => {
    assert.doesNotThrow(() => assertPayoutTransition(PAYOUT_STATES.REQUESTED, PAYOUT_STATES.RISK_CHECK));
    assert.doesNotThrow(() => assertPayoutTransition(PAYOUT_STATES.REQUESTED, PAYOUT_STATES.REJECTED));
  });
  test('REJECTED is terminal', () => {
    assert.throws(() => assertPayoutTransition(PAYOUT_STATES.REJECTED, PAYOUT_STATES.APPROVED));
  });
  test('SUCCEEDED is terminal', () => {
    assert.throws(() => assertPayoutTransition(PAYOUT_STATES.SUCCEEDED, PAYOUT_STATES.FAILED));
  });
  test('UNKNOWN must go through RECONCILING first', () => {
    assert.throws(() => assertPayoutTransition(PAYOUT_STATES.UNKNOWN, PAYOUT_STATES.PROCESSING));
    assert.doesNotThrow(() => assertPayoutTransition(PAYOUT_STATES.UNKNOWN, PAYOUT_STATES.RECONCILING));
  });
  test('TERMINAL_PAYOUT contains correct states', () => {
    assert.ok(TERMINAL_PAYOUT.includes(PAYOUT_STATES.SUCCEEDED));
    assert.ok(TERMINAL_PAYOUT.includes(PAYOUT_STATES.REJECTED));
  });
});
describe('isValidPaymentTransition', () => {
  test('returns true for valid transitions', () => {
    assert.strictEqual(isValidPaymentTransition(PAYMENT_STATES.CREATED, PAYMENT_STATES.PROCESSING), true);
  });
  test('returns false for invalid transitions', () => {
    assert.strictEqual(isValidPaymentTransition(PAYMENT_STATES.SUCCEEDED, PAYMENT_STATES.FAILED), false);
  });
});
describe('isValidPayoutTransition', () => {
  test('returns true for valid transitions', () => {
    assert.strictEqual(isValidPayoutTransition(PAYOUT_STATES.REQUESTED, PAYOUT_STATES.RISK_CHECK), true);
  });
});
