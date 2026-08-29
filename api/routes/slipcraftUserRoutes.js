const express = require('express');

const {
  createCurrentUserTopUpOrderController,
  createCurrentUserFundingRequestController,
  deleteCurrentUserAccountController,
  getCurrentUserFundingEvidenceController,
  getFundingConfigController,
  getUserPointsController,
  listCurrentUserFundingRequestsController,
  listCurrentUserTopUpOrdersController,
  submitCurrentUserFundingEvidenceController,
  uploadCurrentUserFundingEvidenceController,
  updateCurrentUserTopUpOrderStatusController,
  updateCurrentUserProfileController
} = require('../controllers/slipcraftUserController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');
const {
  listCurrentUserNotificationsController,
  markCurrentUserNotificationReadController
} = require('../controllers/notificationController');

const router = express.Router();

router.patch('/me/profile', requireAuthenticatedUser, asyncHandler(updateCurrentUserProfileController));
router.get('/me/points/funding/config', requireAuthenticatedUser, asyncHandler(getFundingConfigController));
router.get('/me/points/funding/requests', requireAuthenticatedUser, asyncHandler(listCurrentUserFundingRequestsController));
router.post('/me/points/funding/requests', requireAuthenticatedUser, requireIdempotencyKey, asyncHandler(createCurrentUserFundingRequestController));
router.post('/me/points/funding/requests/:id/evidence', requireAuthenticatedUser, requireIdempotencyKey, asyncHandler(submitCurrentUserFundingEvidenceController));
router.post('/me/points/funding/requests/:id/evidence/upload', requireAuthenticatedUser, requireIdempotencyKey, asyncHandler(uploadCurrentUserFundingEvidenceController));
router.get('/me/points/funding/requests/:id/evidence', requireAuthenticatedUser, asyncHandler(getCurrentUserFundingEvidenceController));
router.get('/me/notifications', requireAuthenticatedUser, asyncHandler(listCurrentUserNotificationsController));
router.post('/me/notifications/:id/read', requireAuthenticatedUser, asyncHandler(markCurrentUserNotificationReadController));
router.get('/me/top-up-orders', requireAuthenticatedUser, asyncHandler(listCurrentUserTopUpOrdersController));
router.post('/me/top-up-orders', requireAuthenticatedUser, asyncHandler(createCurrentUserTopUpOrderController));
router.patch('/me/top-up-orders/:id/status', requireAuthenticatedUser, asyncHandler(updateCurrentUserTopUpOrderStatusController));
router.delete('/me', requireAuthenticatedUser, asyncHandler(deleteCurrentUserAccountController));
router.get('/:id/points', requireAuthenticatedUser, asyncHandler(getUserPointsController));

module.exports = {
  slipcraftUserRoutes: router
};
