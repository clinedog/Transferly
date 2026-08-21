const express = require('express');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const {
  logoutController,
  refreshSessionController,
  telegramMiniAppLoginController
} = require('../controllers/authController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const router = express.Router();

const authRateLimiter = rateLimit({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (request, response) => {
    response.status(429).json({
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
      requestId: request.id
    });
  }
});

router.post('/telegram', authRateLimiter, asyncHandler(telegramMiniAppLoginController));
router.post('/telegram-mini-app', authRateLimiter, asyncHandler(telegramMiniAppLoginController));
router.post('/refresh', authRateLimiter, requireAuthenticatedUser, asyncHandler(refreshSessionController));
router.post('/logout', requireAuthenticatedUser, asyncHandler(logoutController));

module.exports = {
  authRoutes: router
};
