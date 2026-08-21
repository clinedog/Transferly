const express = require('express');

const { referralController } = require('../controllers/referralController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const router = express.Router();

router.use(requireAuthenticatedUser);
router.post('/', asyncHandler(referralController));

module.exports = {
  referralRoutes: router
};
