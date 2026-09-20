const express = require('express');

const {
  createInvoiceController,
  previewInvoiceController,
  getInvoiceTimelineController,
  getInvoiceController,
  listInvoicesController,
  listPaymentLinksController,
  refreshInvoiceController,
  sendInvoiceReminderController,
  cancelInvoiceAutoRemindersController,
  generateInvoiceQrController,
  cancelInvoiceController
} = require('../controllers/invoiceController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');
const { requireApiKeyScope } = require('../middleware/requireApiKeyScope');
const { requireOrganizationPermission } = require('../middleware/requireOrganizationPermission');
const { financialRateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(requireAuthenticatedUser);
router.use(requireApiKeyScope('invoices'));
router.post('/', financialRateLimiter, requireIdempotencyKey, requireOrganizationPermission('CREATE_INVOICE'), asyncHandler(createInvoiceController));
router.post('/preview', requireOrganizationPermission('CREATE_INVOICE'), asyncHandler(previewInvoiceController));
router.get('/payment-links', asyncHandler(listPaymentLinksController));
router.get('/:id/timeline', asyncHandler(getInvoiceTimelineController));
router.post('/:id/refresh', requireIdempotencyKey, asyncHandler(refreshInvoiceController));
router.post('/:id/remind', requireIdempotencyKey, asyncHandler(sendInvoiceReminderController));
router.post('/:id/cancel-reminders', requireIdempotencyKey, asyncHandler(cancelInvoiceAutoRemindersController));
router.post('/:id/qr', requireIdempotencyKey, asyncHandler(generateInvoiceQrController));
router.post('/:id/cancel', requireIdempotencyKey, asyncHandler(cancelInvoiceController));
router.get('/:id', asyncHandler(getInvoiceController));
router.get('/', asyncHandler(listInvoicesController));

module.exports = {
  invoiceRoutes: router
};
