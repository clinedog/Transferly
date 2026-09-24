'use strict';

const { randomUUID } = require('node:crypto');
const { AppError } = require('../../utils/errors');

function positiveOrZero(value, field) {
  const amount = Number(value || 0);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new AppError(422, 'FINANCIAL_QUOTE_AMOUNT_INVALID', `${field} must be a non-negative safe integer.`);
  }
  return amount;
}

function buildFinancialQuote(input = {}, { now = new Date(), idFactory = randomUUID } = {}) {
  const amountCents = positiveOrZero(input.amountCents, 'amountCents');
  const providerFeeCents = positiveOrZero(input.providerFeeCents, 'providerFeeCents');
  const serviceFeeCents = positiveOrZero(input.serviceFeeCents, 'serviceFeeCents');
  const pointsRequired = positiveOrZero(input.pointsRequired, 'pointsRequired');
  const currency = String(input.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new AppError(422, 'FINANCIAL_QUOTE_CURRENCY_INVALID', 'Quote currency must be a three-letter ISO code.');
  }

  const issuedAt = new Date(now);
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(issuedAt.getTime() + Number(input.ttlMs || 300000));
  if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) ||
      expiresAt.getTime() <= issuedAt.getTime()) {
    throw new AppError(422, 'FINANCIAL_QUOTE_EXPIRY_INVALID', 'Quote expiry must be after its issue time.');
  }

  return Object.freeze({
    quoteId: String(input.quoteId || idFactory()),
    transactionType: String(input.transactionType || '').trim().toLowerCase() || null,
    provider: String(input.provider || '').trim().toLowerCase() || null,
    idempotencyKey: String(input.idempotencyKey || '').trim() || null,
    amountCents,
    currency,
    providerFeeCents,
    serviceFeeCents,
    pointsRequired,
    totalCents: amountCents + providerFeeCents + serviceFeeCents,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    estimatedSettlement: input.estimatedSettlement || null,
    riskDecision: input.riskDecision || null,
    cancellationPolicy: input.cancellationPolicy || null,
    refundPolicy: input.refundPolicy || null
  });
}

function assertQuoteActive(quote, { now = new Date() } = {}) {
  if (!quote?.expiresAt || new Date(quote.expiresAt).getTime() <= new Date(now).getTime()) {
    throw new AppError(409, 'FINANCIAL_QUOTE_EXPIRED', 'The financial quote has expired and must be refreshed.');
  }
  return quote;
}

module.exports = {
  buildFinancialQuote,
  assertQuoteActive
};
