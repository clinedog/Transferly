const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');
const {
  createChallengeController,
  verifyChallengeController,
  listWalletLinksController,
  deleteWalletLinkController
} = require('../controllers/walletLinkController');

const router = express.Router();

router.post('/challenge', requireAuthenticatedUser, asyncHandler(createChallengeController));
router.post('/verify', requireAuthenticatedUser, asyncHandler(verifyChallengeController));
router.get('/', requireAuthenticatedUser, asyncHandler(listWalletLinksController));
router.delete('/:id', requireAuthenticatedUser, asyncHandler(deleteWalletLinkController));

module.exports = {
  walletLinkRoutes: router
};
