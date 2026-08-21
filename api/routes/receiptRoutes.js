const express = require('express');

const { generateReceiptController } = require('../controllers/receiptController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const router = express.Router();

router.use(requireAuthenticatedUser);
router.post('/generate', asyncHandler(generateReceiptController));

module.exports = {
  receiptRoutes: router
};
