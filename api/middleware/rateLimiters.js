'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

function createRateLimiter({ max, windowMs, code, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (request, response) => {
      response.status(429).json({
        code,
        message,
        requestId: request.id
      });
    }
  });
}

const financialRateLimiter = createRateLimiter({
  max: config.FINANCIAL_RATE_LIMIT_MAX,
  windowMs: config.FINANCIAL_RATE_LIMIT_WINDOW_MS,
  code: 'FINANCIAL_RATE_LIMITED',
  message: 'Too many financial requests. Please try again later.'
});

const fundingRateLimiter = createRateLimiter({
  max: config.FUNDING_RATE_LIMIT_MAX,
  windowMs: config.FUNDING_RATE_LIMIT_WINDOW_MS,
  code: 'FUNDING_RATE_LIMITED',
  message: 'Too many funding requests. Please try again later.'
});

const adminRateLimiter = createRateLimiter({
  max: config.ADMIN_RATE_LIMIT_MAX,
  windowMs: config.ADMIN_RATE_LIMIT_WINDOW_MS,
  code: 'ADMIN_RATE_LIMITED',
  message: 'Too many administrative requests. Please try again later.'
});

const webhookRateLimiter = createRateLimiter({
  max: config.WEBHOOK_RATE_LIMIT_MAX,
  windowMs: config.WEBHOOK_RATE_LIMIT_WINDOW_MS,
  code: 'WEBHOOK_RATE_LIMITED',
  message: 'Too many webhook requests. Please try again later.'
});

module.exports = {
  createRateLimiter,
  financialRateLimiter,
  fundingRateLimiter,
  adminRateLimiter,
  webhookRateLimiter
};
