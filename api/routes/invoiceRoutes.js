const express = require('express');

const {
  createInvoiceController,
  previewInvoiceController,
  getInvoiceTimelineController,
  getInvoiceController,
  listInvoicesController,
  refreshInvoiceController,
  sendInvoiceReminderController,
  cancelInvoiceAutoRemindersController,
  generateInvoiceQrController,
  cancelInvoiceController
} = require('../controllers/invoiceController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const router = express.Router();

router.use(requireAuthenticatedUser);
router.post('/', asyncHandler(createInvoiceController));
router.post('/preview', asyncHandler(previewInvoiceController));
router.get('/:id/timeline', asyncHandler(getInvoiceTimelineController));
router.post('/:id/refresh', asyncHandler(refreshInvoiceController));
router.post('/:id/remind', asyncHandler(sendInvoiceReminderController));
router.post('/:id/cancel-reminders', asyncHandler(cancelInvoiceAutoRemindersController));
router.post('/:id/qr', asyncHandler(generateInvoiceQrController));
router.post('/:id/cancel', asyncHandler(cancelInvoiceController));
router.get('/:id', asyncHandler(getInvoiceController));
router.get('/', asyncHandler(listInvoicesController));

module.exports = {
  invoiceRoutes: router
};
