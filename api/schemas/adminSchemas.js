const { z } = require('zod');
const { invoiceLineItemSchema, listInvoicesQuerySchema } = require('./invoiceSchemas');

const paymentProviderSlugSchema = z.enum(['paypal', 'stripe', 'crypto', 'paystack', 'flutterwave', 'wise']);
const reminderTypeSchema = z.enum(['BEFORE_DUE', 'AFTER_DUE']);
const reminderIntervalUnitSchema = z.enum(['DAY', 'WEEK']);

function requireAtLeastOneField(schema, message) {
  return schema.refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    message || 'At least one field is required.'
  );
}

const releaseInvoiceFundsSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().max(1000).optional()
});

const adminUserIdParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const adminAdjustUserPointsSchema = z.object({
  delta: z.coerce.number().int().min(-1000000).max(1000000).refine((value) => value !== 0, {
    message: 'Point adjustment must be non-zero.'
  }),
  reason: z.string().trim().min(3).max(1000)
});

const adminReconcileUserPointsSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

const adminFundingRequestParamsSchema = z.object({
  id: z.string().trim().min(1).max(120)
});

const listAdminFundingRequestsQuerySchema = z.object({
  status: z.enum([
    'DRAFT', 'PAYMENT_INSTRUCTIONS', 'PAYMENT_REPORTED', 'UNDER_REVIEW', 'APPROVED',
    'POINTS_CREDITED', 'REJECTED', 'NEEDS_MORE_INFORMATION', 'CANCELLED', 'MANUAL_REVIEW'
  ]).optional(),
  userId: z.string().trim().min(1).optional(),
  query: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
});

const adminFundingApprovalSchema = z.object({
  adminNote: z.string().trim().max(1000).optional().default('')
}).strict();

const adminFundingRejectSchema = z.object({
  rejectionReason: z.string().trim().min(3).max(1000),
  adminNote: z.string().trim().max(1000).optional().default('')
}).strict();

const adminFundingInfoRequestSchema = z.object({
  adminNote: z.string().trim().min(3).max(1000)
}).strict();

const adminFundingAssignSchema = z.object({
  assignedTo: z.string().trim().min(1).max(255)
}).strict();

const adminFinanceTransactionsQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).max(80).optional(),
  reference: z.string().trim().min(1).max(160).optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
});

const adminAuditLogsQuerySchema = z.object({
  actorType: z.string().trim().min(1).max(80).optional(),
  action: z.string().trim().min(1).max(160).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().trim().min(1).max(160).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
}).strict();

const adminFinanceAlertsQuerySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED_WITH_REASON']).optional(),
  userId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
});

const adminPaymentTransactionsQuerySchema = z.object({
  provider: z.string().trim().min(1).max(80).optional(),
  matchStatus: z.string().trim().min(1).max(80).optional(),
  query: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
});

const listAdminPayoutsQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  riskDecision: z.string().trim().min(1).optional(),
  provider: paymentProviderSlugSchema.optional(),
  providerState: z.string().trim().min(1).optional(),
  recipient: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'amount', 'receiver', 'status']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  userId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(250).optional(),
  limit: z.coerce.number().int().positive().max(250).default(50)
});

const listAdminInvoicesQuerySchema = listInvoicesQuerySchema.extend({
  userId: z.string().trim().min(1).optional()
});

const adminRecordNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000)
});

const stripeConnectedAccountCreateSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  stripeAccountId: z.string().trim().regex(/^acct_[A-Za-z0-9]+$/).optional(),
  email: z.string().trim().email().optional(),
  country: z.string().trim().length(2).default('US'),
  businessType: z.enum(['individual', 'company', 'non_profit', 'government_entity']).optional(),
  metadata: z.record(z.unknown()).optional()
});

const stripeConnectedAccountParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const stripeConnectedAccountListQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional()
});

const stripeAccountLinkCreateSchema = z.object({
  returnUrl: z.string().trim().url().optional(),
  refreshUrl: z.string().trim().url().optional(),
  collect: z.enum(['currently_due', 'eventually_due']).optional()
});

const markInvoiceReviewRequiredSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional()
});

const listRiskFlagsQuerySchema = z.object({
  status: z.string().min(1).optional(),
  severity: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const listWebhookEventsQuerySchema = z.object({
  status: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  provider: paymentProviderSlugSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const webhookEventParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const webhookEventActionSchema = z.object({
  note: z.string().trim().max(1000).optional()
});

const listDeadLetterJobsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const deadLetterJobParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const deadLetterRecoverySchema = z.object({
  note: z.string().trim().max(1000).optional()
});

const listOutboxEventsQuerySchema = z.object({
  status: z.enum(['pending', 'leased', 'dispatched', 'failed']).optional(),
  aggregateType: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50)
}).strict();

const outboxEventParamsSchema = z.object({
  id: z.string().trim().min(1).max(255)
}).strict();

const outboxReplaySchema = z.object({
  reason: z.string().trim().min(3).max(1000)
}).strict();

const runPaymentReconciliationSchema = z.object({
  invoiceLimit: z.coerce.number().int().positive().max(100).optional(),
  payoutLimit: z.coerce.number().int().positive().max(100).optional()
});

const reconciliationTimelineQuerySchema = z.object({
  entityType: z.string().trim().min(1).max(64),
  entityId: z.string().trim().min(1).max(255),
  limit: z.coerce.number().int().positive().max(200).default(50)
});

const reconciliationMismatchQuerySchema = z.object({
  invoiceLimit: z.coerce.number().int().positive().max(200).default(50),
  payoutLimit: z.coerce.number().int().positive().max(200).default(50),
  webhookLimit: z.coerce.number().int().positive().max(200).default(100),
  pointsLimit: z.coerce.number().int().positive().max(500).default(200)
});

const listPaymentOpsIssuesQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  severity: z.string().trim().min(1).optional(),
  provider: paymentProviderSlugSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const listTopUpOrdersQuerySchema = z.object({
  status: z.enum(['pending', 'awaiting_confirmation', 'completed', 'cancelled']).optional(),
  userId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
});

const topUpOrderParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const topUpOrderAdminActionSchema = z.object({
  notes: z.string().trim().max(1000).optional()
});

const paymentOpsIssueParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const paymentOpsIssueActionSchema = z.object({
  note: z.string().trim().max(1000).optional()
});

const providerIncidentTransitionSchema = z.object({
  status: z.enum(['INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'])
}).strict();

const providerIncidentParamsSchema = z.object({
  id: z.string().trim().min(1)
}).strict();

const automationRuleCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  trigger: z.enum(['PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'INVOICE_PAID', 'INVOICE_OVERDUE', 'PAYOUT_SUCCEEDED', 'PAYOUT_FAILED', 'TRANSACTION_UNKNOWN', 'PROVIDER_HEALTH_CHANGED']),
  condition: z.object({ amount: z.number().nonnegative().optional() }).strict().default({}),
  action: z.enum(['NOTIFY_ADMIN', 'NOTIFY_USER', 'CREATE_RECONCILIATION_TASK', 'SEND_RECEIPT'])
}).strict();

const automationRuleStatusSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) }).strict();
const automationRuleDryRunSchema = z.object({
  trigger: z.string().trim().min(1),
  amount: z.number().nonnegative().optional()
}).strict();

const faqContentSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(5000)
});

const adminConfigUpdateSchema = requireAtLeastOneField(
  z.object({
    site_name: z.string().trim().min(1).max(255).optional(),
    platform_name: z.string().trim().min(1).max(255).optional(),
    tagline: z.string().trim().min(1).max(500).optional(),
    support_email: z.string().trim().email().optional(),
    admin_email: z.string().trim().email().optional(),
    telegram_handle: z.string().trim().min(1).max(255).optional(),
    brand_color: z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
    bank_slip_cost: z.coerce.number().int().min(0).max(1000000).optional(),
    email_receipt_cost: z.coerce.number().int().min(0).max(1000000).optional(),
    referral_bonus: z.coerce.number().int().min(0).max(1000000).optional(),
    signup_bonus: z.coerce.number().int().min(0).max(1000000).optional(),
    payout_minimum_cents: z.coerce.number().int().min(0).max(1000000000).optional(),
    payout_fee_fixed_cents: z.coerce.number().int().min(0).max(1000000000).optional(),
    payout_fee_percentage_bps: z.coerce.number().int().min(0).max(10000).optional(),
    payout_manual_review_cents: z.coerce.number().int().min(0).max(1000000000).optional(),
    total_users: z.coerce.number().int().min(0).max(1000000000).optional(),
    total_receipts: z.coerce.number().int().min(0).max(1000000000).optional(),
    uptime: z.string().trim().min(1).max(255).optional(),
    privacy_policy: z.string().trim().min(1).max(20000).optional(),
    terms_of_service: z.string().trim().min(1).max(20000).optional(),
    about_us: z.string().trim().min(1).max(20000).optional(),
    helpFAQ: z.union([z.string().trim().min(1), z.array(faqContentSchema)]).optional(),
    help_faq: z.union([z.string().trim().min(1), z.array(faqContentSchema)]).optional()
  }),
  'At least one config field is required.'
);

const adminFaqCreateSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(5000),
  order_index: z.coerce.number().int().min(0).max(100000).optional()
});

const adminFaqUpdateSchema = requireAtLeastOneField(
  z.object({
    question: z.string().trim().min(1).max(500).optional(),
    answer: z.string().trim().min(1).max(5000).optional(),
    order_index: z.coerce.number().int().min(0).max(100000).optional()
  }),
  'At least one FAQ field is required.'
);

const adminFaqParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const adminTestimonialCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  role: z.string().trim().min(1).max(255),
  avatar: z.string().trim().max(255).optional(),
  content: z.string().trim().min(1).max(5000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  order_index: z.coerce.number().int().min(0).max(100000).optional(),
  is_active: z.coerce.boolean().optional()
});

const adminTestimonialUpdateSchema = requireAtLeastOneField(
  z.object({
    name: z.string().trim().min(1).max(255).optional(),
    role: z.string().trim().min(1).max(255).optional(),
    avatar: z.string().trim().max(255).optional(),
    content: z.string().trim().min(1).max(5000).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    order_index: z.coerce.number().int().min(0).max(100000).optional(),
    is_active: z.coerce.boolean().optional()
  }),
  'At least one testimonial field is required.'
);

const adminTestimonialParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const invoiceTemplateContentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  currency_code: z.string().trim().length(3),
  default_due_days: z.coerce.number().int().min(0).max(365).optional(),
  line_items: z.array(invoiceLineItemSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
  is_active: z.coerce.boolean().optional()
});

const adminInvoiceTemplateCreateSchema = invoiceTemplateContentSchema;

const adminInvoiceTemplateUpdateSchema = requireAtLeastOneField(
  z.object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(1000).optional(),
    currency_code: z.string().trim().length(3).optional(),
    default_due_days: z.coerce.number().int().min(0).max(365).optional(),
    line_items: z.array(invoiceLineItemSchema).min(1).optional(),
    metadata: z.record(z.unknown()).optional(),
    is_active: z.coerce.boolean().optional()
  }),
  'At least one invoice template field is required.'
);

const adminInvoiceTemplateParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const listInvoiceReminderConfigurationsQuerySchema = z.object({
  type: reminderTypeSchema.optional()
});

const adminInvoiceReminderParamsSchema = z.object({
  id: z.string().trim().regex(/^RC-[A-Z0-9]+$/)
});

const adminInvoiceReminderUpdateSchema = z.object({
  type: reminderTypeSchema,
  interval: z.object({
    unit: reminderIntervalUnitSchema,
    value: z.coerce.number().int().min(1).max(365)
  }),
  repetition: z.coerce.number().int().min(1).max(7),
  notification: z
    .object({
      send_to_invoicer: z.coerce.boolean().optional()
    })
    .optional()
}).superRefine((input, context) => {
  if (input.type === 'BEFORE_DUE' && input.repetition !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['repetition'],
      message: 'BEFORE_DUE reminder configurations must use a repetition of 1.'
    });
  }
});

const payoutHoldSchema = z.object({
  reason: z.string().trim().min(1).max(500)
});

const riskFlagAssignSchema = z.object({
  operatorId: z.string().trim().min(1).max(255)
});

const riskFlagEscalateSchema = z.object({
  note: z.string().trim().min(1).max(1000)
});

const riskFlagNoteSchema = z.object({
  note: z.string().trim().min(1).max(1000)
});

const listRiskCasesQuerySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'WAITING_FOR_INFORMATION', 'RESOLVED', 'FALSE_POSITIVE', 'ESCALATED']).optional(),
  userId: z.string().trim().min(1).optional(),
  domain: z.enum(['PAYMENT_RISK', 'ACCOUNT_RISK', 'SERVICE_RISK', 'VELOCITY_RISK', 'ADMIN_RISK']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
}).strict();

const listRiskSignalsQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  domain: z.enum(['PAYMENT_RISK', 'ACCOUNT_RISK', 'SERVICE_RISK', 'VELOCITY_RISK', 'ADMIN_RISK']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().positive().max(250).default(100)
}).strict();

const riskCaseParamsSchema = z.object({
  id: z.string().trim().min(1).max(120)
});

const riskCaseStatusUpdateSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'WAITING_FOR_INFORMATION', 'RESOLVED', 'ESCALATED']),
  assignedTo: z.string().trim().min(1).max(255).optional(),
  reason: z.string().trim().min(3).max(1000).optional()
}).strict();

const riskCaseFalsePositiveSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
}).strict();

module.exports = {
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
  faqContentSchema,
  adminFinanceAlertsQuerySchema,
  adminAuditLogsQuerySchema,
  adminFinanceTransactionsQuerySchema,
  adminPaymentTransactionsQuerySchema,
  listInvoiceReminderConfigurationsQuerySchema,
  listAdminFundingRequestsQuerySchema,
  listPaymentOpsIssuesQuerySchema,
  listTopUpOrdersQuerySchema,
  paymentOpsIssueActionSchema,
  paymentOpsIssueParamsSchema,
  providerIncidentParamsSchema,
  providerIncidentTransitionSchema,
  automationRuleCreateSchema,
  automationRuleStatusSchema,
  automationRuleDryRunSchema,
  releaseInvoiceFundsSchema,
  markInvoiceReviewRequiredSchema,
  stripeAccountLinkCreateSchema,
  stripeConnectedAccountCreateSchema,
  stripeConnectedAccountListQuerySchema,
  stripeConnectedAccountParamsSchema,
  runPaymentReconciliationSchema,
  reconciliationTimelineQuerySchema,
  reconciliationMismatchQuerySchema,
  topUpOrderAdminActionSchema,
  topUpOrderParamsSchema,
  listAdminPayoutsQuerySchema,
  listAdminInvoicesQuerySchema,
  listRiskFlagsQuerySchema,
  listWebhookEventsQuerySchema,
  webhookEventActionSchema,
  webhookEventParamsSchema,
  listDeadLetterJobsQuerySchema,
  deadLetterJobParamsSchema,
  deadLetterRecoverySchema,
  listOutboxEventsQuerySchema,
  outboxEventParamsSchema,
  outboxReplaySchema,
  payoutHoldSchema,
  riskFlagAssignSchema,
  riskFlagEscalateSchema,
  riskFlagNoteSchema,
  listRiskCasesQuerySchema,
  listRiskSignalsQuerySchema,
  riskCaseParamsSchema,
  riskCaseStatusUpdateSchema,
  riskCaseFalsePositiveSchema
};
