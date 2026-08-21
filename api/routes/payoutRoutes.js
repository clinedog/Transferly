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

const router = express.Router();

router.use(requireAuthenticatedUser);
router.post('/', requireIdempotencyKey, asyncHandler(createPayoutController));
router.post('/preview', asyncHandler(previewPayoutController));
router.get('/:id/timeline', asyncHandler(getPayoutTimelineController));
router.post('/:id/refresh', asyncHandler(refreshPayoutController));
router.get('/:id', asyncHandler(getPayoutController));
router.get('/', asyncHandler(listPayoutsController));

module.exports = {
  payoutRoutes: router
};
