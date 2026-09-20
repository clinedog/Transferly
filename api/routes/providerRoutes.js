const express = require('express');
const config = require('../config');

const {
  createProviderInvoiceController,
  createProviderPayoutController,
  getProviderActivityController,
  getProviderBalanceController,
  getProviderController,
  getProviderCurrencyExchangeController,
  getProviderDashboardController,
  getProviderDeveloperController,
  getProviderDisputesController,
  getProviderHealthController,
  getProviderLaneController,
  getProviderOverviewController,
  getProviderOrdersController,
  getProviderPaymentsController,
  getProviderReadinessController,
  getProviderRoutingController,
  getProviderSettingsController,
  getProviderStatusController,
  getProviderSubscriptionsController,
  getProviderTokensController,
  getProviderTransactionsController,
  getProviderWebhooksController,
  getProviderWorkspaceController,
  getProviderWalletController,
  listProviderReadinessController,
  listProviderInvoicesController,
  listProviderLanesController,
  listProviderPayoutsController,
  preflightProviderActionController,
  listProvidersController,
  previewProviderInvoiceController,
  previewProviderPayoutController
} = require('../controllers/providerController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');
const { requireApiKeyScope } = require('../middleware/requireApiKeyScope');
const { AppError } = require('../utils/errors');

const router = express.Router();

router.use(requireAuthenticatedUser);
router.use(requireApiKeyScope('providers'));
router.get('/', asyncHandler(listProvidersController));
router.get('/readiness', asyncHandler(listProviderReadinessController));
router.get('/routing', asyncHandler(getProviderRoutingController));
router.param('provider', (request, _response, next, provider) => {
  if (config.PAYPAL_ONLY_PRODUCTION_MVP && String(provider || '').trim().toLowerCase() !== 'paypal') {
    next(new AppError(404, 'PROVIDER_COMING_SOON', 'This provider is coming soon and is not enabled for the current release.'));
    return;
  }
  next();
});
router.get('/:provider', asyncHandler(getProviderController));
router.get('/:provider/readiness', asyncHandler(getProviderReadinessController));
router.get('/:provider/health', asyncHandler(getProviderHealthController));
router.get('/:provider/status', asyncHandler(getProviderStatusController));
router.get('/:provider/overview', asyncHandler(getProviderOverviewController));
router.get('/:provider/dashboard', asyncHandler(getProviderDashboardController));
router.get('/:provider/actions/:operation/preflight', asyncHandler(preflightProviderActionController));
router.get('/:provider/lanes', asyncHandler(listProviderLanesController));
router.get('/:provider/lanes/:laneId', asyncHandler(getProviderLaneController));
router.get('/:provider/invoices', asyncHandler(listProviderInvoicesController));
router.post('/:provider/invoices/preview', asyncHandler(previewProviderInvoiceController));
router.post('/:provider/invoices', requireIdempotencyKey, asyncHandler(createProviderInvoiceController));
router.get('/:provider/payouts', asyncHandler(listProviderPayoutsController));
router.post('/:provider/payouts/preview', asyncHandler(previewProviderPayoutController));
router.post(
  '/:provider/payouts',
  requireIdempotencyKey,
  asyncHandler(createProviderPayoutController)
);
router.get('/:provider/payments', asyncHandler(getProviderPaymentsController));
router.get('/:provider/orders', asyncHandler(getProviderOrdersController));
router.get('/:provider/transactions', asyncHandler(getProviderTransactionsController));
router.get('/:provider/webhooks', asyncHandler(getProviderWebhooksController));
router.get('/:provider/disputes', asyncHandler(getProviderDisputesController));
router.get('/:provider/subscriptions', asyncHandler(getProviderSubscriptionsController));
router.get('/:provider/tokens', asyncHandler(getProviderTokensController));
router.get('/:provider/currency-exchange', asyncHandler(getProviderCurrencyExchangeController));
router.get('/:provider/developer', asyncHandler(getProviderDeveloperController));
router.get('/:provider/settings', asyncHandler(getProviderSettingsController));
router.get('/:provider/balance', asyncHandler(getProviderBalanceController));
router.get('/:provider/wallet', asyncHandler(getProviderWalletController));
router.get('/:provider/workspace', asyncHandler(getProviderWorkspaceController));
router.get('/:provider/activity', asyncHandler(getProviderActivityController));

module.exports = {
  providerRoutes: router
};
