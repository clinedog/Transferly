const express = require('express');

const {
  handleCryptoWebhookController,
  handlePayPalWebhookController,
  handleStripeWebhookController
} = require('../controllers/webhookController');
const { handlePaymentProviderWebhookController } = require('../controllers/paymentWebhookController');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/paypal', asyncHandler(handlePayPalWebhookController));
router.post('/stripe', asyncHandler(handleStripeWebhookController));
router.post('/crypto', asyncHandler(handleCryptoWebhookController));
router.post('/payments/:provider', asyncHandler(handlePaymentProviderWebhookController));

module.exports = {
  webhookRoutes: router
};
