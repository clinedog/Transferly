const {
  dispatchOutboxEvent,
  dispatchPaymentReconciliation,
  dispatchPayoutProcessing
} = require('../jobs/dispatchers');
const {
  adminAdjustUserPointsSchema,
  adminFundingApprovalSchema,
  adminFundingAssignSchema,
  adminFundingInfoRequestSchema,
  adminFundingRejectSchema,
  adminFundingRequestParamsSchema,
  adminReconcileUserPointsSchema,
  adminConfigUpdateSchema,
  adminFaqCreateSchema,
  adminFaqParamsSchema,
  adminFaqUpdateSchema,
  adminInvoiceTemplateCreateSchema,
  adminRecordNoteSchema,
  adminInvoiceReminderParamsSchema,
  adminInvoiceReminderUpdateSchema,
  adminInvoiceTemplateParamsSchema,
  adminInvoiceTemplateUpdateSchema,
  adminTestimonialCreateSchema,
  adminTestimonialParamsSchema,
  adminTestimonialUpdateSchema,
  adminUserIdParamsSchema,
  adminFinanceAlertsQuerySchema,
  adminFinanceTransactionsQuerySchema,
  adminPaymentTransactionsQuerySchema,
  listPaymentOpsIssuesQuerySchema,
  listInvoiceReminderConfigurationsQuerySchema,
  listAdminInvoicesQuerySchema,
  listAdminFundingRequestsQuerySchema,
  listAdminPayoutsQuerySchema,
  listTopUpOrdersQuerySchema,
  listDeadLetterJobsQuerySchema,
  deadLetterJobParamsSchema,
  deadLetterRecoverySchema,
  listOutboxEventsQuerySchema,
  outboxEventParamsSchema,
  outboxReplaySchema,
  listRiskFlagsQuerySchema,
  listWebhookEventsQuerySchema,
  paymentOpsIssueActionSchema,
  paymentOpsIssueParamsSchema,
  releaseInvoiceFundsSchema,
  markInvoiceReviewRequiredSchema,
  runPaymentReconciliationSchema,
  stripeAccountLinkCreateSchema,
  stripeConnectedAccountCreateSchema,
  stripeConnectedAccountListQuerySchema,
  stripeConnectedAccountParamsSchema,
  topUpOrderAdminActionSchema,
  topUpOrderParamsSchema,
  webhookEventActionSchema,
  webhookEventParamsSchema,
  payoutHoldSchema,
  reconciliationTimelineQuerySchema,
  reconciliationMismatchQuerySchema,
  riskFlagAssignSchema,
  riskFlagEscalateSchema,
  riskFlagNoteSchema,
  listRiskCasesQuerySchema,
  listRiskSignalsQuerySchema,
  riskCaseParamsSchema,
  riskCaseStatusUpdateSchema,
  riskCaseFalsePositiveSchema
} = require('../schemas/adminSchemas');
const {
  presentAdminPayout,
  presentAdminInvoice,
  presentAdminUser,
  presentDeadLetterJob,
  presentFundRelease,
  presentInvoiceReminderConfiguration,
  presentInvoiceTemplate,
  presentOutboxEvent,
  presentPaymentOpsIssue,
  presentProviderHealthReport,
  presentQueueOverview,
  presentRiskCase,
  presentRiskFlag,
  presentRiskProfile,
  presentRiskSignal,
  presentWebhookEvent,
  presentWebhookEventDetail
} = require('../presenters/adminPresenter');
const { invoiceRepository } = require('../repositories/invoiceRepository');
const { payoutRepository } = require('../repositories/payoutRepository');
const { riskFlagRepository } = require('../repositories/riskFlagRepository');
const { webhookEventRepository } = require('../repositories/webhookEventRepository');
const { payoutParamsSchema, rejectPayoutSchema } = require('../schemas/payoutSchemas');
const { adminContentService } = require('../services/adminContentService');
const { adminWebhookService } = require('../services/adminWebhookService');
const { auditLogService } = require('../services/auditLogService');
const { opsService } = require('../services/opsService');
const { createOutboxRecoveryService } = require('../services/outboxRecoveryService');
const { paymentProviderRegistry } = require('../services/paymentProviderRegistry');
const { paypalInvoiceService } = require('../services/paypalInvoiceService');
const { providerBalanceService } = require('../services/providerBalanceService');
const { providerInvoiceService } = require('../services/providerInvoiceService');
const { invoiceTemplateService } = require('../services/invoiceTemplateService');
const { paymentOpsIssueService } = require('../services/paymentOpsIssueService');
const { financeOpsService } = require('../services/financeOpsService');
const { pointsFundingService } = require('../services/pointsFundingService');
const { providerHealthService } = require('../services/providerHealthService');
const { providerReadinessReportService } = require('../services/providerReadinessReportService');
const { paypalPayoutService } = require('../services/paypalPayoutService');
const { providerPayoutService } = require('../services/providerPayoutService');
const { slipcraftUserService } = require('../services/slipcraftUserService');
const { stripeConnectedAccountService } = require('../services/stripeConnectedAccountService');
const { topUpOrderService } = require('../services/topUpOrderService');
const { reconciliationTimelineService } = require('../services/reconciliationTimelineService');
const { riskEngineService } = require('../services/riskEngineService');
const { AUDIT_ACTOR_TYPE } = require('../utils/constants');

const outboxRecoveryService = createOutboxRecoveryService({
  dispatchEvent: dispatchOutboxEvent
});

async function approvePayoutController(request, response) {
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  const approval =
    String(payout?.metadata?.provider || '').toLowerCase() === 'stripe'
      ? await providerPayoutService.approvePayout(payout.id, request.adminActorId)
      : await paypalPayoutService.approvePayout(request.params.id, request.adminActorId);
  const result = await dispatchPayoutProcessing(
    approval.payout_id,
    'process-approved-payout'
  );
  response.json(result);
}

async function rejectPayoutController(request, response) {
  const body = rejectPayoutSchema.parse(request.body || {});
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  const result =
    String(payout?.metadata?.provider || '').toLowerCase() === 'stripe'
      ? await providerPayoutService.rejectPayout(payout.id, request.adminActorId, body.reason)
      : await paypalPayoutService.rejectPayout(request.params.id, request.adminActorId, body.reason);
  response.json(result);
}

async function cancelUnclaimedPayoutController(request, response) {
  const params = payoutParamsSchema.parse(request.params || {});
  const result = await paypalPayoutService.cancelUnclaimedPayout({
    payoutId: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });
  response.json(result);
}

async function releaseInvoiceFundsController(request, response) {
  const body = releaseInvoiceFundsSchema.parse(request.body || {});
  const result = await paypalInvoiceService.releaseInvoiceFunds({
    invoiceId: request.params.id,
    amount: body.amount,
    reason: body.reason,
    idempotencyKey: request.idempotencyKey,
    adminActorId: request.adminActorId,
    requestId: request.id
  });

  response.json(presentFundRelease(result));
}

async function refreshAdminInvoiceController(request, response) {
  const result = await providerInvoiceService.refreshInvoice({
    invoiceId: request.params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json(result);
}

async function voidAdminInvoiceController(request, response) {
  const result = await providerInvoiceService.cancelInvoice({
    invoiceId: request.params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    requestId: request.id
  });

  response.json(result);
}

async function markInvoiceReviewRequiredController(request, response) {
  const body = markInvoiceReviewRequiredSchema.parse(request.body || {});
  const result = await providerInvoiceService.markInvoiceReviewRequired({
    invoiceId: request.params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    reason: body.reason
  });

  response.json(result);
}

async function listAdminPayoutsController(request, response) {
  const query = listAdminPayoutsQuerySchema.parse(request.query || {});
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const [payouts, total] = await Promise.all([
    payoutRepository.findMany(filters),
    payoutRepository.countMany(filters)
  ]);
  response.json({
    data: payouts.map(presentAdminPayout),
    pagination: {
      page: query.page,
      page_size: pageSize,
      total,
      has_next_page: query.page * pageSize < total
    }
  });
}

async function listAdminInvoicesController(request, response) {
  const query = listAdminInvoicesQuerySchema.parse(request.query || {});
  const pageSize = query.pageSize || query.limit || 50;
  const filters = {
    ...query,
    pageSize,
    offset: (query.page - 1) * pageSize
  };
  const [invoices, total] = await Promise.all([
    invoiceRepository.findMany(filters),
    invoiceRepository.countMany(filters)
  ]);
  response.json({
    data: invoices.map(presentAdminInvoice),
    pagination: {
      page: query.page,
      page_size: pageSize,
      total,
      has_next_page: query.page * pageSize < total
    }
  });
}

async function listPaymentProvidersController(_request, response) {
  response.json({
    data: paymentProviderRegistry.listProviders()
  });
}

async function listPaymentProviderHealthController(_request, response) {
  const report = await providerHealthService.getProviderHealthReport();
  response.json(presentProviderHealthReport(report));
}

async function listPaymentProviderReadinessController(_request, response) {
  response.json({
    data: await providerReadinessReportService.listProviderReadinessReport()
  });
}

async function getPaymentProviderController(request, response) {
  response.json({
    provider: paymentProviderRegistry.getProviderStatus(request.params.provider)
  });
}

async function getPaymentProviderBalanceController(request, response) {
  const balance = await providerBalanceService.getProviderBalance({
    provider: request.params.provider,
    connectedAccountId: request.query?.connectedAccountId,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });
  response.json({
    balance
  });
}

async function listPaymentProviderInvoiceFeaturesController(_request, response) {
  response.json({
    data: paymentProviderRegistry.listInvoiceFeatures()
  });
}

async function getPaymentProviderInvoiceFeaturesController(request, response) {
  response.json({
    provider: paymentProviderRegistry.getProviderInvoiceFeatures(request.params.provider)
  });
}

async function listStripeConnectedAccountsController(request, response) {
  const query = stripeConnectedAccountListQuerySchema.parse(request.query || {});
  response.json({
    data: await stripeConnectedAccountService.listConnectedAccounts(query)
  });
}

async function createStripeConnectedAccountController(request, response) {
  const body = stripeConnectedAccountCreateSchema.parse(request.body || {});
  const account = await stripeConnectedAccountService.createConnectedAccount({
    ...body,
    adminActorId: request.adminActorId
  });
  response.status(201).json({ account });
}

async function refreshStripeConnectedAccountController(request, response) {
  const params = stripeConnectedAccountParamsSchema.parse(request.params || {});
  const account = await stripeConnectedAccountService.refreshConnectedAccount({
    id: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });
  response.json({ account });
}

async function createStripeConnectedAccountOnboardingLinkController(request, response) {
  const params = stripeConnectedAccountParamsSchema.parse(request.params || {});
  const body = stripeAccountLinkCreateSchema.parse(request.body || {});
  const result = await stripeConnectedAccountService.createOnboardingLink({
    id: params.id,
    ...body,
    adminActorId: request.adminActorId
  });
  response.status(201).json(result);
}

async function addInvoiceNoteController(request, response) {
  const invoice = await invoiceRepository.findByIdentifier(request.params.id);
  if (!invoice) {
    response.status(404).json({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice not found.'
    });
    return;
  }

  const body = adminRecordNoteSchema.parse(request.body || {});
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'invoice.note_added',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      note: body.note
    }
  });
  response.status(201).json({ note: body.note });
}

async function addPayoutNoteController(request, response) {
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  if (!payout) {
    response.status(404).json({
      code: 'PAYOUT_NOT_FOUND',
      message: 'Payout not found.'
    });
    return;
  }

  const body = adminRecordNoteSchema.parse(request.body || {});
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'payout.note_added',
    entityType: 'payout',
    entityId: payout.id,
    metadata: {
      note: body.note
    }
  });
  response.status(201).json({ note: body.note });
}

async function listRiskFlagsController(request, response) {
  const query = listRiskFlagsQuerySchema.parse(request.query || {});
  const flags = await riskFlagRepository.findMany(query);
  response.json({
    data: flags.map(presentRiskFlag)
  });
}

async function listWebhookEventsController(request, response) {
  const query = listWebhookEventsQuerySchema.parse(request.query || {});
  const events = await webhookEventRepository.findMany(query);
  response.json({
    data: events.map(presentWebhookEvent)
  });
}

async function getWebhookEventController(request, response) {
  const params = webhookEventParamsSchema.parse(request.params || {});
  const event = await adminWebhookService.getWebhookEvent(params.id);
  response.json({
    event: presentWebhookEventDetail(event)
  });
}

async function replayWebhookEventController(request, response) {
  const params = webhookEventParamsSchema.parse(request.params || {});
  const body = webhookEventActionSchema.parse(request.body || {});
  const event = await adminWebhookService.replayWebhookEvent({
    webhookEventId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({
    event: presentWebhookEventDetail(event)
  });
}

async function ignoreWebhookEventController(request, response) {
  const params = webhookEventParamsSchema.parse(request.params || {});
  const body = webhookEventActionSchema.parse(request.body || {});
  const event = await adminWebhookService.ignoreWebhookEvent({
    webhookEventId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({
    event: presentWebhookEventDetail(event)
  });
}

async function listPaymentOpsIssuesController(request, response) {
  const query = listPaymentOpsIssuesQuerySchema.parse(request.query || {});
  const issues = await paymentOpsIssueService.listIssues(query);
  response.json({
    data: issues.map(presentPaymentOpsIssue)
  });
}

async function acknowledgePaymentOpsIssueController(request, response) {
  const params = paymentOpsIssueParamsSchema.parse(request.params || {});
  const body = paymentOpsIssueActionSchema.parse(request.body || {});
  const issue = await paymentOpsIssueService.acknowledgeIssue({
    issueId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({ issue: presentPaymentOpsIssue(issue) });
}

async function resolvePaymentOpsIssueController(request, response) {
  const params = paymentOpsIssueParamsSchema.parse(request.params || {});
  const body = paymentOpsIssueActionSchema.parse(request.body || {});
  const issue = await paymentOpsIssueService.resolveIssue({
    issueId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({ issue: presentPaymentOpsIssue(issue) });
}

async function reopenPaymentOpsIssueController(request, response) {
  const params = paymentOpsIssueParamsSchema.parse(request.params || {});
  const body = paymentOpsIssueActionSchema.parse(request.body || {});
  const issue = await paymentOpsIssueService.reopenIssue({
    issueId: params.id,
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({ issue: presentPaymentOpsIssue(issue) });
}

async function getQueueOverviewController(_request, response) {
  const overview = await opsService.getQueueOverview();
  response.json(presentQueueOverview(overview));
}

async function getOperationalDiagnosticsController(request, response) {
  const diagnostics = await opsService.getOperationalDiagnostics({
    requestId: request.id,
    correlationId: request.correlationId
  });
  response.json(diagnostics);
}

async function listDeadLetterJobsController(request, response) {
  const query = listDeadLetterJobsQuerySchema.parse(request.query || {});
  const jobs = await opsService.listDeadLetterJobs(query.limit);
  response.json({
    data: jobs.map(presentDeadLetterJob)
  });
}

async function recoverDeadLetterJobController(request, response) {
  const params = deadLetterJobParamsSchema.parse(request.params || {});
  const body = deadLetterRecoverySchema.parse(request.body || {});
  const result = await opsService.recoverDeadLetterJob(params.id, {
    adminActorId: request.adminActorId,
    note: body.note
  });
  response.json({
    dead_letter: presentDeadLetterJob(result.dead_letter),
    recovery: result.recovery
  });
}

async function listOutboxEventsController(request, response) {
  const query = listOutboxEventsQuerySchema.parse(request.query || {});
  const events = await outboxRecoveryService.listEvents(query);
  response.json({ data: events.map(presentOutboxEvent) });
}

async function replayOutboxEventController(request, response) {
  const params = outboxEventParamsSchema.parse(request.params || {});
  const body = outboxReplaySchema.parse(request.body || {});
  const result = await outboxRecoveryService.replayFailedEvent({
    eventId: params.id,
    adminActorId: request.adminActorId,
    reason: body.reason
  });
  response.json({
    event: presentOutboxEvent(result.event),
    dispatch_pending: result.dispatchPending
  });
}

async function runPaymentReconciliationController(request, response) {
  const input = runPaymentReconciliationSchema.parse(request.body || {});
  const result = await dispatchPaymentReconciliation(input);
  response.json(result);
}

async function listAdminUsersController(_request, response) {
  const users = await slipcraftUserService.listUsers();
  response.json({
    data: users.map(presentAdminUser)
  });
}

async function getAdminFinanceOverviewController(_request, response) {
  response.json({ overview: await financeOpsService.getOverview() });
}

async function listAdminFinanceTransactionsController(request, response) {
  const query = adminFinanceTransactionsQuerySchema.parse(request.query || {});
  response.json(await financeOpsService.listTransactions(query));
}

async function getAdminUserFinanceProfileController(request, response) {
  const params = adminUserIdParamsSchema.parse(request.params || {});
  response.json({ finance_profile: await financeOpsService.getUserFinanceProfile(params.id) });
}

async function listAdminFinanceReconciliationAlertsController(request, response) {
  const query = adminFinanceAlertsQuerySchema.parse(request.query || {});
  response.json(await financeOpsService.listReconciliationAlerts(query));
}

async function listAdminPaymentTransactionsController(request, response) {
  const query = adminPaymentTransactionsQuerySchema.parse(request.query || {});
  response.json(await financeOpsService.listPaymentTransactions({ matchStatus: 'NO_MATCH', ...query }));
}

async function listTopUpOrdersController(request, response) {
  const query = listTopUpOrdersQuerySchema.parse(request.query || {});
  const orders = await topUpOrderService.listOrders(query);
  response.json({ data: orders });
}

async function listAdminFundingRequestsController(request, response) {
  const query = listAdminFundingRequestsQuerySchema.parse(request.query || {});
  response.json(await pointsFundingService.listAdminFundingRequests(query));
}

async function getAdminFundingRequestController(request, response) {
  const params = adminFundingRequestParamsSchema.parse(request.params || {});
  response.json(await pointsFundingService.getAdminFundingRequest(params.id));
}

async function markAdminFundingRequestUnderReviewController(request, response) {
  const params = adminFundingRequestParamsSchema.parse(request.params || {});
  response.json(await pointsFundingService.markUnderReview({
    requestId: params.id,
    adminActorId: request.adminActorId
  }));
}

async function approveAdminFundingRequestController(request, response) {
  const params = adminFundingRequestParamsSchema.parse(request.params || {});
  const body = adminFundingApprovalSchema.parse(request.body || {});
  response.json(await pointsFundingService.approveFundingRequest({
    requestId: params.id,
    adminActorId: request.adminActorId,
    adminNote: body.adminNote,
    idempotencyKey: request.idempotencyKey
  }));
}

async function rejectAdminFundingRequestController(request, response) {
  const params = adminFundingRequestParamsSchema.parse(request.params || {});
  const body = adminFundingRejectSchema.parse(request.body || {});
  response.json(await pointsFundingService.rejectFundingRequest({
    requestId: params.id,
    adminActorId: request.adminActorId,
    rejectionReason: body.rejectionReason,
    adminNote: body.adminNote
  }));
}

async function requestAdminFundingMoreInfoController(request, response) {
  const params = adminFundingRequestParamsSchema.parse(request.params || {});
  const body = adminFundingInfoRequestSchema.parse(request.body || {});
  response.json(await pointsFundingService.requestMoreInformation({
    requestId: params.id,
    adminActorId: request.adminActorId,
    adminNote: body.adminNote
  }));
}

async function assignAdminFundingRequestController(request, response) {
  const params = adminFundingRequestParamsSchema.parse(request.params || {});
  const body = adminFundingAssignSchema.parse(request.body || {});
  response.json(await pointsFundingService.assignFundingRequest({
    requestId: params.id,
    adminActorId: request.adminActorId,
    assignedTo: body.assignedTo
  }));
}

async function completeTopUpOrderController(request, response) {
  const params = topUpOrderParamsSchema.parse(request.params || {});
  const body = topUpOrderAdminActionSchema.parse(request.body || {});
  const order = await topUpOrderService.completeOrder({
    orderId: params.id,
    adminActorId: request.adminActorId,
    notes: body.notes
  });
  response.json({ order });
}

async function cancelTopUpOrderController(request, response) {
  const params = topUpOrderParamsSchema.parse(request.params || {});
  const body = topUpOrderAdminActionSchema.parse(request.body || {});
  const order = await topUpOrderService.cancelOrder({
    orderId: params.id,
    adminActorId: request.adminActorId,
    notes: body.notes
  });
  response.json({ order });
}

async function adjustAdminUserPointsController(request, response) {
  const params = adminUserIdParamsSchema.parse(request.params || {});
  const body = adminAdjustUserPointsSchema.parse(request.body || {});
  const user = await slipcraftUserService.adjustUserPoints({
    targetUserId: params.id,
    delta: body.delta,
    reason: body.reason,
    adminActorId: request.adminActorId,
    idempotencyKey: request.idempotencyKey
  });

  response.json({ user: presentAdminUser(user) });
}

async function getAdminUserPointReconciliationController(request, response) {
  const params = adminUserIdParamsSchema.parse(request.params || {});
  const reconciliation = await slipcraftUserService.getPointReconciliation(params.id);
  response.json({ reconciliation });
}

async function reconcileAdminUserPointsController(request, response) {
  const params = adminUserIdParamsSchema.parse(request.params || {});
  const body = adminReconcileUserPointsSchema.parse(request.body || {});
  const reconciliation = await slipcraftUserService.reconcilePointProjection({
    targetUserId: params.id,
    reason: body.reason,
    adminActorId: request.adminActorId,
    idempotencyKey: request.idempotencyKey
  });
  response.json({ reconciliation });
}

async function updateAdminConfigController(request, response) {
  const updates = adminConfigUpdateSchema.parse(request.body || {});
  const config = await adminContentService.updateConfig({
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ config });
}

async function createAdminFaqController(request, response) {
  const input = adminFaqCreateSchema.parse(request.body || {});
  const faq = await adminContentService.createFaq({
    input,
    adminActorId: request.adminActorId
  });

  response.status(201).json({ faq });
}

async function updateAdminFaqController(request, response) {
  const params = adminFaqParamsSchema.parse(request.params || {});
  const updates = adminFaqUpdateSchema.parse(request.body || {});
  const faq = await adminContentService.updateFaq({
    id: params.id,
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ faq });
}

async function deleteAdminFaqController(request, response) {
  const params = adminFaqParamsSchema.parse(request.params || {});
  const result = await adminContentService.deleteFaq({
    id: params.id,
    adminActorId: request.adminActorId
  });

  response.json(result);
}

async function createAdminTestimonialController(request, response) {
  const input = adminTestimonialCreateSchema.parse(request.body || {});
  const testimonial = await adminContentService.createTestimonial({
    input,
    adminActorId: request.adminActorId
  });

  response.status(201).json({ testimonial });
}

async function updateAdminTestimonialController(request, response) {
  const params = adminTestimonialParamsSchema.parse(request.params || {});
  const updates = adminTestimonialUpdateSchema.parse(request.body || {});
  const testimonial = await adminContentService.updateTestimonial({
    id: params.id,
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ testimonial });
}

async function deleteAdminTestimonialController(request, response) {
  const params = adminTestimonialParamsSchema.parse(request.params || {});
  const result = await adminContentService.deleteTestimonial({
    id: params.id,
    adminActorId: request.adminActorId
  });

  response.json(result);
}

async function listAdminInvoiceTemplatesController(_request, response) {
  const templates = await invoiceTemplateService.listTemplates();
  response.json({ data: templates.map(presentInvoiceTemplate) });
}

async function listInvoiceReminderConfigurationsController(request, response) {
  const query = listInvoiceReminderConfigurationsQuerySchema.parse(request.query || {});
  const result = await paypalInvoiceService.listReminderConfigurations(query);
  response.json({
    data: result.data.map(presentInvoiceReminderConfiguration)
  });
}

async function updateInvoiceReminderConfigurationController(request, response) {
  const params = adminInvoiceReminderParamsSchema.parse(request.params || {});
  const input = adminInvoiceReminderUpdateSchema.parse(request.body || {});
  const configuration = await paypalInvoiceService.updateReminderConfiguration({
    configurationId: params.id,
    ...input,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json({ configuration: presentInvoiceReminderConfiguration(configuration) });
}

async function suspendInvoiceReminderConfigurationController(request, response) {
  const params = adminInvoiceReminderParamsSchema.parse(request.params || {});
  const configuration = await paypalInvoiceService.suspendReminderConfiguration({
    configurationId: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json({ configuration: presentInvoiceReminderConfiguration(configuration) });
}

async function resumeInvoiceReminderConfigurationController(request, response) {
  const params = adminInvoiceReminderParamsSchema.parse(request.params || {});
  const configuration = await paypalInvoiceService.resumeReminderConfiguration({
    configurationId: params.id,
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId
  });

  response.json({ configuration: presentInvoiceReminderConfiguration(configuration) });
}

async function createAdminInvoiceTemplateController(request, response) {
  const input = adminInvoiceTemplateCreateSchema.parse(request.body || {});
  const template = await invoiceTemplateService.createTemplate({
    input,
    adminActorId: request.adminActorId
  });

  response.status(201).json({ template: presentInvoiceTemplate(template) });
}

async function updateAdminInvoiceTemplateController(request, response) {
  const params = adminInvoiceTemplateParamsSchema.parse(request.params || {});
  const updates = adminInvoiceTemplateUpdateSchema.parse(request.body || {});
  const template = await invoiceTemplateService.updateTemplate({
    id: params.id,
    updates,
    adminActorId: request.adminActorId
  });

  response.json({ template: presentInvoiceTemplate(template) });
}

async function deleteAdminInvoiceTemplateController(request, response) {
  const params = adminInvoiceTemplateParamsSchema.parse(request.params || {});
  const result = await invoiceTemplateService.deleteTemplate({
    id: params.id,
    adminActorId: request.adminActorId
  });

  response.json(result);
}

async function getReconciliationTimelineController(request, response) {
  const query = reconciliationTimelineQuerySchema.parse(request.query || {});
  const timeline = await reconciliationTimelineService.getEntityTimeline(query);
  response.json(timeline);
}

async function getReconciliationMismatchesController(request, response) {
  const query = reconciliationMismatchQuerySchema.parse(request.query || {});
  const result = await reconciliationTimelineService.detectMismatches(query);
  response.json(result);
}

async function holdPayoutController(request, response) {
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  if (!payout) {
    response.status(404).json({ code: 'PAYOUT_NOT_FOUND', message: 'Payout not found.' });
    return;
  }
  const { reason } = payoutHoldSchema.parse(request.body || {});
  const now = new Date().toISOString();
  const updated = await payoutRepository.update(payout.id, {
    onHold: true,
    heldByActorId: request.adminActorId,
    heldAt: now,
    holdReason: reason
  });
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'payout.held',
    entityType: 'payout',
    entityId: payout.id,
    metadata: { reason }
  });
  response.json({ payout: updated });
}

async function unholdPayoutController(request, response) {
  const payout = await payoutRepository.findByIdentifier(request.params.id);
  if (!payout) {
    response.status(404).json({ code: 'PAYOUT_NOT_FOUND', message: 'Payout not found.' });
    return;
  }
  const updated = await payoutRepository.update(payout.id, {
    onHold: false,
    heldByActorId: null,
    heldAt: null,
    holdReason: null
  });
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'payout.hold_released',
    entityType: 'payout',
    entityId: payout.id,
    metadata: {}
  });
  response.json({ payout: updated });
}

async function assignRiskFlagController(request, response) {
  const flag = await riskFlagRepository.findById(request.params.id);
  if (!flag) {
    response.status(404).json({ code: 'RISK_FLAG_NOT_FOUND', message: 'Risk flag not found.' });
    return;
  }
  const { operatorId } = riskFlagAssignSchema.parse(request.body || {});
  const updated = await riskFlagRepository.update(flag.id, {
    operatorId,
    assignedAt: new Date().toISOString()
  });
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'risk_flag.assigned',
    entityType: 'risk_flag',
    entityId: flag.id,
    metadata: { operatorId }
  });
  response.json({ flag: updated });
}

async function escalateRiskFlagController(request, response) {
  const flag = await riskFlagRepository.findById(request.params.id);
  if (!flag) {
    response.status(404).json({ code: 'RISK_FLAG_NOT_FOUND', message: 'Risk flag not found.' });
    return;
  }
  const { note } = riskFlagEscalateSchema.parse(request.body || {});
  const updated = await riskFlagRepository.update(flag.id, {
    status: 'ESCALATED',
    escalatedAt: new Date().toISOString(),
    escalationNote: note
  });
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'risk_flag.escalated',
    entityType: 'risk_flag',
    entityId: flag.id,
    metadata: { note }
  });
  response.json({ flag: updated });
}

async function addRiskFlagNoteController(request, response) {
  const flag = await riskFlagRepository.findById(request.params.id);
  if (!flag) {
    response.status(404).json({ code: 'RISK_FLAG_NOT_FOUND', message: 'Risk flag not found.' });
    return;
  }
  const { note } = riskFlagNoteSchema.parse(request.body || {});
  await auditLogService.log({
    actorType: AUDIT_ACTOR_TYPE.ADMIN,
    actorId: request.adminActorId,
    action: 'risk_flag.note_added',
    entityType: 'risk_flag',
    entityId: flag.id,
    metadata: { note }
  });
  response.status(201).json({ note });
}

async function getRiskOverviewController(_request, response) {
  response.json({ overview: await riskEngineService.getOverview() });
}

async function listRiskCasesController(request, response) {
  const query = listRiskCasesQuerySchema.parse(request.query || {});
  const cases = await riskEngineService.listCases(query);
  response.json({ data: cases.map(presentRiskCase) });
}

async function getRiskCaseController(request, response) {
  const params = riskCaseParamsSchema.parse(request.params || {});
  const riskCase = await riskEngineService.getCase(params.id);
  response.json({ case: presentRiskCase(riskCase) });
}

async function updateRiskCaseStatusController(request, response) {
  const params = riskCaseParamsSchema.parse(request.params || {});
  const body = riskCaseStatusUpdateSchema.parse(request.body || {});
  const riskCase = await riskEngineService.updateCaseStatus({
    caseId: params.id,
    status: body.status,
    reason: body.reason,
    assignedTo: body.assignedTo,
    adminActorId: request.adminActorId
  });
  response.json({ case: presentRiskCase(riskCase) });
}

async function markRiskCaseFalsePositiveController(request, response) {
  const params = riskCaseParamsSchema.parse(request.params || {});
  const body = riskCaseFalsePositiveSchema.parse(request.body || {});
  const riskCase = await riskEngineService.updateCaseStatus({
    caseId: params.id,
    status: 'FALSE_POSITIVE',
    reason: body.reason,
    adminActorId: request.adminActorId
  });
  response.json({ case: presentRiskCase(riskCase) });
}

async function listRiskSignalsController(request, response) {
  const query = listRiskSignalsQuerySchema.parse(request.query || {});
  const signals = await riskEngineService.listSignals(query);
  response.json({ data: signals.map(presentRiskSignal) });
}

async function getAdminUserRiskProfileController(request, response) {
  const params = adminUserIdParamsSchema.parse(request.params || {});
  const profile = await riskEngineService.getUserRiskProfile(params.id);
  response.json({ risk_profile: presentRiskProfile(profile) });
}

module.exports = {
  acknowledgePaymentOpsIssueController,
  adjustAdminUserPointsController,
  assignAdminFundingRequestController,
  approveAdminFundingRequestController,
  approvePayoutController,
  addInvoiceNoteController,
  addPayoutNoteController,
  cancelTopUpOrderController,
  cancelUnclaimedPayoutController,
  completeTopUpOrderController,
  createAdminFaqController,
  listInvoiceReminderConfigurationsController,
  updateInvoiceReminderConfigurationController,
  suspendInvoiceReminderConfigurationController,
  resumeInvoiceReminderConfigurationController,
  createAdminInvoiceTemplateController,
  createAdminTestimonialController,
  deleteAdminFaqController,
  deleteAdminInvoiceTemplateController,
  deleteAdminTestimonialController,
  getAdminFundingRequestController,
  getAdminFinanceOverviewController,
  getAdminUserRiskProfileController,
  getAdminUserFinanceProfileController,
  getRiskOverviewController,
  getRiskCaseController,
  rejectPayoutController,
  refreshAdminInvoiceController,
  releaseInvoiceFundsController,
  markInvoiceReviewRequiredController,
  markAdminFundingRequestUnderReviewController,
  listAdminUsersController,
  listAdminFundingRequestsController,
  listAdminFinanceTransactionsController,
  listAdminFinanceReconciliationAlertsController,
  listAdminPaymentTransactionsController,
  listTopUpOrdersController,
  listAdminInvoiceTemplatesController,
  listAdminPayoutsController,
  listAdminInvoicesController,
  listPaymentOpsIssuesController,
  listRiskFlagsController,
  listRiskCasesController,
  listRiskSignalsController,
  listWebhookEventsController,
  getWebhookEventController,
  ignoreWebhookEventController,
  replayWebhookEventController,
  reopenPaymentOpsIssueController,
  resolvePaymentOpsIssueController,
  getQueueOverviewController,
  getOperationalDiagnosticsController,
  listPaymentProviderHealthController,
  listPaymentProviderReadinessController,
  getPaymentProviderInvoiceFeaturesController,
  getPaymentProviderBalanceController,
  getPaymentProviderController,
  getAdminUserPointReconciliationController,
  listDeadLetterJobsController,
  listOutboxEventsController,
  recoverDeadLetterJobController,
  replayOutboxEventController,
  rejectAdminFundingRequestController,
  reconcileAdminUserPointsController,
  requestAdminFundingMoreInfoController,
  listPaymentProviderInvoiceFeaturesController,
  listPaymentProvidersController,
  listStripeConnectedAccountsController,
  runPaymentReconciliationController,
  createStripeConnectedAccountController,
  createStripeConnectedAccountOnboardingLinkController,
  refreshStripeConnectedAccountController,
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
};
