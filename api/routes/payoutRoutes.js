const express = require('express');

const {
  createPayoutController,
  previewPayoutController,
  getPayoutTimelineController,
  getPayoutController,
  listPayoutsController,
  refreshPayoutController
} = require('../controllers/payoutController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');
const { requireApiKeyScope } = require('../middleware/requireApiKeyScope');
const { requireOrganizationPermission } = require('../middleware/requireOrganizationPermission');
const { financialRateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(requireAuthenticatedUser);
router.use(requireApiKeyScope('payouts'));
router.post('/', financialRateLimiter, requireIdempotencyKey, requireOrganizationPermission('CREATE_PAYOUT'), asyncHandler(createPayoutController));
router.post('/preview', requireOrganizationPermission('CREATE_PAYOUT'), asyncHandler(previewPayoutController));
router.get('/:id/timeline', asyncHandler(getPayoutTimelineController));
router.post('/:id/refresh', asyncHandler(refreshPayoutController));
router.get('/:id', asyncHandler(getPayoutController));
router.get('/', asyncHandler(listPayoutsController));

module.exports = {
  payoutRoutes: router
};
