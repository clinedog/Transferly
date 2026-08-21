const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');
const {
  listListingsController,
  createListingController,
  createTradeController
} = require('../controllers/marketplaceController');

const router = express.Router();

router.get('/listings', asyncHandler(listListingsController));
router.post('/listings', requireAuthenticatedUser, asyncHandler(createListingController));
router.post('/trades', requireAuthenticatedUser, asyncHandler(createTradeController));

module.exports = {
  marketplaceRoutes: router
};
