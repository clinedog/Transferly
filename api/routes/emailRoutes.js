const express = require('express');

const { sendEmailReceiptController } = require('../controllers/emailController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const router = express.Router();

router.use(requireAuthenticatedUser);
router.post('/send', asyncHandler(sendEmailReceiptController));

module.exports = {
  emailRoutes: router
};
