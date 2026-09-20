const express = require('express');

const {
  adjustAdminUserPointsController,
  addInvoiceNoteController,
  addPayoutNoteController,
  acknowledgePaymentOpsIssueController,
  assignAdminFundingRequestController,
  approveAdminFundingRequestController,
  approvePayoutController,
  cancelUnclaimedPayoutController,
  cancelTopUpOrderController,
  completeTopUpOrderController,
  createAdminFaqController,
  listInvoiceReminderConfigurationsController,
  updateInvoiceReminderConfigurationController,
  suspendInvoiceReminderConfigurationController,
  resumeInvoiceReminderConfigurationController,
  createAdminInvoiceTemplateController,
  createStripeConnectedAccountController,
  createStripeConnectedAccountOnboardingLinkController,
  createAdminTestimonialController,
  deleteAdminFaqController,
  deleteAdminInvoiceTemplateController,
  deleteAdminTestimonialController,
  getAdminFinanceOverviewController,
  getAdminAnalyticsController,
  exportAdminAnalyticsController,
  exportAdminAnalyticsPdfController,
  listAdminAuditLogsController,
  getAdminFundingEvidenceController,
  getAdminFundingRequestController,
  getAdminUserFinanceProfileController,
  getAdminUserRiskProfileController,
  getRiskCaseController,
  getRiskOverviewController,
  getPaymentProviderBalanceController,
  getPaymentProviderInvoiceFeaturesController,
  getPaymentProviderController,
  getAdminUserPointReconciliationController,
  getWebhookEventController,
  ignoreWebhookEventController,
  getQueueOverviewController,
  getOperationalDiagnosticsController,
  listAdminFundingRequestsController,
  listAdminFinanceReconciliationAlertsController,
  listAdminFinanceTransactionsController,
  listAdminPaymentTransactionsController,
  listAdminInvoiceTemplatesController,
  listAdminInvoicesController,
  listAdminUsersController,
  listRiskCasesController,
  listTopUpOrdersController,
  listDeadLetterJobsController,
  listOutboxEventsController,
  listPaymentOpsIssuesController,
  listPaymentProviderHealthController,
  listPaymentProviderReadinessController,
  getProductionReadinessController,
  listProviderIncidentsController,
  transitionProviderIncidentController,
  listAutomationHistoryController,
  listAutomationRulesController,
  createAutomationRuleController,
  updateAutomationRuleStatusController,
  dryRunAutomationRuleController,
  listAutomationExecutionsController,
  getSecurityOverviewController,
  listPaymentProviderInvoiceFeaturesController,
  listPaymentProvidersController,
  listStripeConnectedAccountsController,
  reopenPaymentOpsIssueController,
  runPaymentReconciliationController,
  rejectAdminFundingRequestController,
  rejectPayoutController,
  recoverDeadLetterJobController,
  replayOutboxEventController,
  reconcileAdminUserPointsController,
  requestAdminFundingMoreInfoController,
  refreshAdminInvoiceController,
  refreshStripeConnectedAccountController,
  resolvePaymentOpsIssueController,
  releaseInvoiceFundsController,
  markAdminFundingRequestUnderReviewController,
  markInvoiceReviewRequiredController,
  listAdminPayoutsController,
  listRiskFlagsController,
  listRiskSignalsController,
  listWebhookEventsController,
  replayWebhookEventController,
  updateAdminConfigController,
  updateAdminFaqController,
  updateAdminInvoiceTemplateController,
  updateAdminTestimonialController,
  voidAdminInvoiceController,
  getReconciliationTimelineController,
  getReconciliationMismatchesController,
  holdPayoutController,
  unholdPayoutController,
  assignRiskFlagController,
  escalateRiskFlagController,
  addRiskFlagNoteController,
  updateRiskCaseStatusController,
  markRiskCaseFalsePositiveController
} = require('../controllers/adminController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAdminActor } = require('../middleware/requireAdminActor');
const { requireIdempotencyKey } = require('../middleware/requireIdempotencyKey');
const { adminRateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(adminRateLimiter);

router.get('/users', requireAdminActor, asyncHandler(listAdminUsersController));
router.get('/finance/overview', requireAdminActor, asyncHandler(getAdminFinanceOverviewController));
router.get('/finance/analytics', requireAdminActor, asyncHandler(getAdminAnalyticsController));
router.get('/finance/analytics.csv', requireAdminActor, asyncHandler(exportAdminAnalyticsController));
router.get('/finance/analytics.pdf', requireAdminActor, asyncHandler(exportAdminAnalyticsPdfController));
router.get('/audit-logs', requireAdminActor, asyncHandler(listAdminAuditLogsController));
router.get('/finance/transactions', requireAdminActor, asyncHandler(listAdminFinanceTransactionsController));
router.get('/finance/reconciliation-alerts', requireAdminActor, asyncHandler(listAdminFinanceReconciliationAlertsController));
router.get('/finance/users/:id', requireAdminActor, asyncHandler(getAdminUserFinanceProfileController));
router.get('/payments/unmatched', requireAdminActor, asyncHandler(listAdminPaymentTransactionsController));
router.get('/risk/overview', requireAdminActor, asyncHandler(getRiskOverviewController));
router.get('/risk/cases', requireAdminActor, asyncHandler(listRiskCasesController));
router.get('/risk/signals', requireAdminActor, asyncHandler(listRiskSignalsController));
router.get('/risk/users/:id', requireAdminActor, asyncHandler(getAdminUserRiskProfileController));
router.get('/risk/cases/:id', requireAdminActor, asyncHandler(getRiskCaseController));
router.post('/risk/cases/:id/status', requireAdminActor, requireIdempotencyKey, asyncHandler(updateRiskCaseStatusController));
router.post('/risk/cases/:id/false-positive', requireAdminActor, requireIdempotencyKey, asyncHandler(markRiskCaseFalsePositiveController));
router.get(
  '/users/:id/points/reconciliation',
  requireAdminActor,
  asyncHandler(getAdminUserPointReconciliationController)
);
router.post(
  '/users/:id/points/reconciliation',
  requireAdminActor,
  requireIdempotencyKey,
  asyncHandler(reconcileAdminUserPointsController)
);
router.post(
  '/users/:id/points',
  requireAdminActor,
  requireIdempotencyKey,
  asyncHandler(adjustAdminUserPointsController)
);
router.get('/top-up-orders', requireAdminActor, asyncHandler(listTopUpOrdersController));
router.post('/top-up-orders/:id/complete', requireAdminActor, requireIdempotencyKey, asyncHandler(completeTopUpOrderController));
router.post('/top-up-orders/:id/cancel', requireAdminActor, requireIdempotencyKey, asyncHandler(cancelTopUpOrderController));
router.get('/points-funding', requireAdminActor, asyncHandler(listAdminFundingRequestsController));
router.get('/points-funding/:id/evidence', requireAdminActor, asyncHandler(getAdminFundingEvidenceController));
router.get('/points-funding/:id', requireAdminActor, asyncHandler(getAdminFundingRequestController));
router.post('/points-funding/:id/assign', requireAdminActor, requireIdempotencyKey, asyncHandler(assignAdminFundingRequestController));
router.post('/points-funding/:id/under-review', requireAdminActor, requireIdempotencyKey, asyncHandler(markAdminFundingRequestUnderReviewController));
router.post('/points-funding/:id/approve', requireAdminActor, requireIdempotencyKey, asyncHandler(approveAdminFundingRequestController));
router.post('/points-funding/:id/reject', requireAdminActor, requireIdempotencyKey, asyncHandler(rejectAdminFundingRequestController));
router.post('/points-funding/:id/request-info', requireAdminActor, requireIdempotencyKey, asyncHandler(requestAdminFundingMoreInfoController));
router.get('/invoice-reminders', requireAdminActor, asyncHandler(listInvoiceReminderConfigurationsController));
router.put('/invoice-reminders/:id', requireAdminActor, asyncHandler(updateInvoiceReminderConfigurationController));
router.post('/invoice-reminders/:id/suspend', requireAdminActor, asyncHandler(suspendInvoiceReminderConfigurationController));
router.post('/invoice-reminders/:id/resume', requireAdminActor, asyncHandler(resumeInvoiceReminderConfigurationController));
router.get('/invoice-templates', requireAdminActor, asyncHandler(listAdminInvoiceTemplatesController));
router.post('/invoice-templates', requireAdminActor, asyncHandler(createAdminInvoiceTemplateController));
router.patch('/invoice-templates/:id', requireAdminActor, asyncHandler(updateAdminInvoiceTemplateController));
router.delete('/invoice-templates/:id', requireAdminActor, asyncHandler(deleteAdminInvoiceTemplateController));
router.get('/invoices', requireAdminActor, asyncHandler(listAdminInvoicesController));
router.get('/payouts', requireAdminActor, asyncHandler(listAdminPayoutsController));
router.get('/payment-providers', requireAdminActor, asyncHandler(listPaymentProvidersController));
router.get(
  '/payment-providers/stripe/connected-accounts',
  requireAdminActor,
  asyncHandler(listStripeConnectedAccountsController)
);
router.post(
  '/payment-providers/stripe/connected-accounts',
  requireAdminActor,
  requireIdempotencyKey,
  asyncHandler(createStripeConnectedAccountController)
);
router.post(
  '/payment-providers/stripe/connected-accounts/:id/refresh',
  requireAdminActor,
  requireIdempotencyKey,
  asyncHandler(refreshStripeConnectedAccountController)
);
router.post(
  '/payment-providers/stripe/connected-accounts/:id/onboarding-link',
  requireAdminActor,
  requireIdempotencyKey,
  asyncHandler(createStripeConnectedAccountOnboardingLinkController)
);
router.get(
  '/payment-providers/invoice-features',
  requireAdminActor,
  asyncHandler(listPaymentProviderInvoiceFeaturesController)
);
router.get('/payment-providers/health', requireAdminActor, asyncHandler(listPaymentProviderHealthController));
router.get('/payment-providers/readiness', requireAdminActor, asyncHandler(listPaymentProviderReadinessController));
router.get('/production-readiness', requireAdminActor, asyncHandler(getProductionReadinessController));
router.get('/provider-incidents', requireAdminActor, asyncHandler(listProviderIncidentsController));
router.patch('/provider-incidents/:id', requireAdminActor, requireIdempotencyKey, asyncHandler(transitionProviderIncidentController));
router.get('/automation-history', requireAdminActor, asyncHandler(listAutomationHistoryController));
router.get('/automation-rules', requireAdminActor, asyncHandler(listAutomationRulesController));
router.post('/automation-rules', requireAdminActor, asyncHandler(createAutomationRuleController));
router.patch('/automation-rules/:id/status', requireAdminActor, asyncHandler(updateAutomationRuleStatusController));
router.post('/automation-rules/:id/dry-run', requireAdminActor, asyncHandler(dryRunAutomationRuleController));
router.get('/automation-executions', requireAdminActor, asyncHandler(listAutomationExecutionsController));
router.get('/security-overview', requireAdminActor, asyncHandler(getSecurityOverviewController));
router.get(
  '/payment-providers/:provider/invoice-features',
  requireAdminActor,
  asyncHandler(getPaymentProviderInvoiceFeaturesController)
);
router.get(
  '/payment-providers/:provider/balance',
  requireAdminActor,
  asyncHandler(getPaymentProviderBalanceController)
);
router.get('/payment-providers/:provider', requireAdminActor, asyncHandler(getPaymentProviderController));
router.get('/payment-issues', requireAdminActor, asyncHandler(listPaymentOpsIssuesController));
router.post('/payment-issues/:id/acknowledge', requireAdminActor, requireIdempotencyKey, asyncHandler(acknowledgePaymentOpsIssueController));
router.post('/payment-issues/:id/resolve', requireAdminActor, requireIdempotencyKey, asyncHandler(resolvePaymentOpsIssueController));
router.post('/payment-issues/:id/reopen', requireAdminActor, requireIdempotencyKey, asyncHandler(reopenPaymentOpsIssueController));
router.post('/payouts/:id/approve', requireAdminActor, requireIdempotencyKey, asyncHandler(approvePayoutController));
router.post('/payouts/:id/cancel-unclaimed', requireAdminActor, requireIdempotencyKey, asyncHandler(cancelUnclaimedPayoutController));
router.post('/payouts/:id/reject', requireAdminActor, requireIdempotencyKey, asyncHandler(rejectPayoutController));
router.post('/payouts/:id/notes', requireAdminActor, asyncHandler(addPayoutNoteController));
router.get('/risk-flags', requireAdminActor, asyncHandler(listRiskFlagsController));
router.post('/risk-flags/:id/assign', requireAdminActor, asyncHandler(assignRiskFlagController));
router.post('/risk-flags/:id/escalate', requireAdminActor, asyncHandler(escalateRiskFlagController));
router.post('/risk-flags/:id/notes', requireAdminActor, asyncHandler(addRiskFlagNoteController));
router.post('/risk-flags/:id/assign', requireAdminActor, asyncHandler(assignRiskFlagController));
router.post('/risk-flags/:id/escalate', requireAdminActor, asyncHandler(escalateRiskFlagController));
router.post('/risk-flags/:id/notes', requireAdminActor, asyncHandler(addRiskFlagNoteController));
router.get('/webhooks', requireAdminActor, asyncHandler(listWebhookEventsController));
router.get('/webhooks/:id', requireAdminActor, asyncHandler(getWebhookEventController));
router.post('/webhooks/:id/replay', requireAdminActor, requireIdempotencyKey, asyncHandler(replayWebhookEventController));
router.post('/webhooks/:id/ignore', requireAdminActor, requireIdempotencyKey, asyncHandler(ignoreWebhookEventController));
router.get('/queues', requireAdminActor, asyncHandler(getQueueOverviewController));
router.get('/diagnostics', requireAdminActor, asyncHandler(getOperationalDiagnosticsController));
router.get('/dead-letters', requireAdminActor, asyncHandler(listDeadLetterJobsController));
router.post('/dead-letters/:id/recover', requireAdminActor, requireIdempotencyKey, asyncHandler(recoverDeadLetterJobController));
router.post('/dead-letters/:id/retry', requireAdminActor, requireIdempotencyKey, asyncHandler(recoverDeadLetterJobController));
router.get('/outbox-events', requireAdminActor, asyncHandler(listOutboxEventsController));
router.post('/outbox-events/:id/replay', requireAdminActor, requireIdempotencyKey, asyncHandler(replayOutboxEventController));
router.post('/reconciliation/run', requireAdminActor, requireIdempotencyKey, asyncHandler(runPaymentReconciliationController));
router.get('/reconciliation/timeline', requireAdminActor, asyncHandler(getReconciliationTimelineController));
router.get('/reconciliation/mismatches', requireAdminActor, asyncHandler(getReconciliationMismatchesController));
router.post('/payouts/:id/hold', requireAdminActor, requireIdempotencyKey, asyncHandler(holdPayoutController));
router.post('/payouts/:id/unhold', requireAdminActor, requireIdempotencyKey, asyncHandler(unholdPayoutController));
router.patch('/config', requireAdminActor, asyncHandler(updateAdminConfigController));
router.post('/faqs', requireAdminActor, asyncHandler(createAdminFaqController));
router.patch('/faqs/:id', requireAdminActor, asyncHandler(updateAdminFaqController));
router.delete('/faqs/:id', requireAdminActor, asyncHandler(deleteAdminFaqController));
router.post('/testimonials', requireAdminActor, asyncHandler(createAdminTestimonialController));
router.patch('/testimonials/:id', requireAdminActor, asyncHandler(updateAdminTestimonialController));
router.delete('/testimonials/:id', requireAdminActor, asyncHandler(deleteAdminTestimonialController));
router.post('/invoices/:id/release', requireAdminActor, requireIdempotencyKey, asyncHandler(releaseInvoiceFundsController));
router.post('/invoices/:id/refresh', requireAdminActor, asyncHandler(refreshAdminInvoiceController));
router.post('/invoices/:id/void', requireAdminActor, requireIdempotencyKey, asyncHandler(voidAdminInvoiceController));
router.post('/invoices/:id/review-required', requireAdminActor, requireIdempotencyKey, asyncHandler(markInvoiceReviewRequiredController));
router.post('/invoices/:id/notes', requireAdminActor, asyncHandler(addInvoiceNoteController));

module.exports = {
  adminRoutes: router
};
