const { presentInvoice, presentPayout } = require('./paymentPresenter');
const { formatMoney } = require('../utils/money');

function presentAdminInvoice(invoice) {
  const provider = String(invoice.metadata?.provider || 'paypal').toLowerCase();
  const providerActions = {
    paypal: ['refresh', 'release_funds', 'open_hosted_link', 'cancel'],
    stripe: ['refresh', 'release_funds', 'open_hosted_link', 'open_pdf', 'void'],
    crypto: ['refresh', 'release_funds', 'open_hosted_link', 'mark_review_required']
  };

  return {
    ...presentInvoice(invoice),
    user_id: invoice.userId,
    provider,
    admin_actions: providerActions[provider] || ['refresh', 'open_hosted_link']
  };
}

function presentAdminPayout(payout) {
  return {
    ...presentPayout(payout),
    user_id: payout.userId
  };
}

function presentAdminUser(user) {
  const ledgerBalance = user.pointBalance?.ledgerBalance ?? user.points ?? 0;
  const projectionBalance = user.pointBalance?.projectionBalance ?? ledgerBalance;
  const difference = user.pointBalance?.difference ?? projectionBalance - ledgerBalance;

  return {
    user_id: user.id,
    email: user.email,
    name: user.name || user.displayName || '',
    display_name: user.displayName || null,
    country_code: user.countryCode || null,
    points: ledgerBalance,
    point_balance: {
      ledger_balance: ledgerBalance,
      projection_balance: projectionBalance,
      difference,
      reconciled: user.pointBalance?.reconciled ?? (difference === 0)
    },
    referral_count: user.referral_count ?? 0,
    referral_code: user.referral_code ?? null,
    is_admin: Boolean(user.is_admin),
    receipt_count: user.receipt_count ?? 0,
    created_at: user.createdAt || user.created_at,
    updated_at: user.updatedAt || user.updated_at,
    profile: user.profile || null,
    wallet: user.wallet || null
  };
}

function presentRiskFlag(flag) {
  return {
    risk_flag_id: flag.id,
    user_id: flag.userId,
    invoice_id: flag.invoiceId,
    payout_id: flag.payoutId,
    rule_code: flag.ruleCode,
    severity: flag.severity,
    status: flag.status,
    reason: flag.reason,
    metadata: flag.metadata || {},
    created_at: flag.createdAt,
    resolved_at: flag.resolvedAt || null
  };
}

const webhookProviderSlugs = ['paypal', 'stripe', 'crypto', 'paystack', 'flutterwave', 'wise'];

function inferWebhookProvider(event) {
  const payloadProvider = event.payload?.provider;
  if (payloadProvider && webhookProviderSlugs.includes(String(payloadProvider).toLowerCase())) {
    return String(payloadProvider).toLowerCase();
  }

  const eventId = String(event.eventId || '').toLowerCase();
  const prefixedProvider = webhookProviderSlugs.find((provider) => eventId.startsWith(`${provider}:`));
  if (prefixedProvider) {
    return prefixedProvider;
  }

  const eventText = [
    event.eventType,
    event.resourceType,
    event.payload?.type,
    event.payload?.event_type
  ].join(' ').toLowerCase();
  const textProvider = webhookProviderSlugs.find((provider) => eventText.includes(provider));

  return textProvider || 'paypal';
}

function summarizeWebhookPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return {
      has_payload: false
    };
  }

  const resource = payload.resource || payload.data?.object || payload.data || {};

  return {
    has_payload: true,
    id: payload.id || null,
    type: payload.type || payload.event_type || null,
    provider: payload.provider || null,
    resource_id: resource.id || payload.resource_id || null,
    resource_type: resource.object || payload.resource_type || null,
    top_level_keys: Object.keys(payload).slice(0, 20)
  };
}

function summarizeWebhookVerification(verificationPayload = {}) {
  if (!verificationPayload || typeof verificationPayload !== 'object') {
    return {
      has_verification_payload: false
    };
  }

  return {
    has_verification_payload: true,
    verification_status: verificationPayload.verification_status || verificationPayload.status || null,
    signature_header_present: Boolean(
      verificationPayload.signature_header_present ||
        verificationPayload.stripe_signature_present ||
        verificationPayload.coinbase_signature_present
    ),
    transmission_id_present: Boolean(verificationPayload.transmission_id || verificationPayload.transmissionId)
  };
}

function presentWebhookEvent(event) {
  const provider = inferWebhookProvider(event);

  return {
    webhook_event_id: event.id,
    event_id: event.eventId,
    provider,
    event_type: event.eventType,
    resource_type: event.resourceType,
    transmission_id: event.transmissionId,
    status: event.status,
    processing_attempts: event.processingAttempts,
    last_error: event.lastError || null,
    processed_at: event.processedAt || null,
    created_at: event.createdAt,
    updated_at: event.updatedAt
  };
}

function presentWebhookEventDetail(event) {
  const status = String(event.status || '').toUpperCase();

  return {
    ...presentWebhookEvent(event),
    can_replay: status !== 'REJECTED',
    can_ignore: !['IGNORED', 'PROCESSED'].includes(status),
    sanitized_payload: summarizeWebhookPayload(event.payload),
    verification: summarizeWebhookVerification(event.verificationPayload)
  };
}

function presentFundRelease(result) {
  return {
    invoice_id: result.invoice.paypalInvoiceId,
    internal_invoice_id: result.invoice.id,
    released_amount: formatMoney(result.amountCents),
    currency: result.invoice.currencyCode,
    remaining_releasable_amount: formatMoney(result.remainingReleasableCents),
    wallet: {
      pending_balance: formatMoney(result.wallet.pendingBalanceCents),
      available_balance: formatMoney(result.wallet.availableBalanceCents),
      frozen_balance: formatMoney(result.wallet.frozenBalanceCents),
      paid_out_balance: formatMoney(result.wallet.paidOutBalanceCents),
      currency: result.wallet.currencyCode
    }
  };
}

function presentQueueOverview(overview) {
  return {
    generated_at: overview.generated_at,
    redis_status: overview.redis_status,
    queues: overview.queues.map((queue) => ({
      key: queue.key,
      name: queue.name,
      counts: queue.counts
    }))
  };
}

function presentDeadLetterJob(job) {
  return {
    job_id: job.job_id,
    queue_job_id: job.queue_job_id || null,
    record_id: job.record_id || null,
    name: job.name,
    attempts_made: job.attempts_made,
    failed_reason: job.failed_reason,
    failure_code: job.failure_code || null,
    failure_classification: job.failure_classification || null,
    retryable: typeof job.retryable === 'boolean' ? job.retryable : null,
    status: job.status || null,
    queue_name: job.queue_name,
    source_queue: job.source_queue || null,
    source_job_id: job.source_job_id || null,
    correlation_id: job.correlation_id || null,
    recovery: job.recovery || null,
    data: job.data,
    created_at: job.created_at,
    finished_at: job.finished_at
  };
}

function presentOutboxEvent(event) {
  return {
    id: event.id,
    semantic_key: event.semanticKey,
    event_type: event.eventType,
    aggregate_type: event.aggregateType,
    aggregate_id: event.aggregateId,
    queue_name: event.queueName,
    job_name: event.jobName,
    status: event.status,
    attempt_count: event.attemptCount,
    max_attempts: event.maxAttempts,
    next_attempt_at: event.nextAttemptAt,
    queue_job_id: event.queueJobId,
    last_error_code: event.lastErrorCode,
    last_error_message: event.lastErrorMessage,
    correlation_id: event.correlationId,
    dispatched_at: event.dispatchedAt,
    created_at: event.createdAt,
    updated_at: event.updatedAt
  };
}

function presentProviderHealthReport(report) {
  return {
    generated_at: report.generated_at,
    data: report.data.map((provider) => ({
      provider: provider.provider,
      display_name: provider.display_name,
      provider_status: provider.provider_status,
      score: provider.score,
      status: provider.status,
      failed_webhooks: provider.failed_webhooks,
      recent_webhooks: provider.recent_webhooks,
      unresolved_issues: provider.unresolved_issues,
      last_webhook_at: provider.last_webhook_at,
      reasons: provider.reasons || [],
      next_actions: provider.next_actions || []
    }))
  };
}

function presentInvoiceTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    description: template.description || null,
    currency_code: template.currency_code,
    default_due_days: template.default_due_days ?? null,
    line_items: template.line_items || [],
    metadata: template.metadata || {},
    is_active: Boolean(template.is_active),
    created_at: template.created_at,
    updated_at: template.updated_at
  };
}

function presentInvoiceReminderConfiguration(configuration) {
  return {
    id: configuration.id,
    type: configuration.type,
    status: configuration.status || null,
    interval: configuration.interval || null,
    repetition: configuration.repetition ?? null,
    notification: configuration.notification || {},
    metadata: configuration.metadata || {},
    links: configuration.links || []
  };
}

function presentPaymentOpsIssue(issue) {
  return {
    payment_issue_id: issue.id,
    entity_type: issue.entityType,
    entity_id: issue.entityId,
    issue_type: issue.issueType,
    severity: issue.severity,
    status: issue.status,
    summary: issue.summary,
    metadata: issue.metadata || {},
    acknowledgement: {
      acknowledged_at: issue.metadata?.acknowledged_at || null,
      acknowledged_by_actor_id: issue.metadata?.acknowledged_by_actor_id || null,
      acknowledgement_note: issue.metadata?.acknowledgement_note || null
    },
    resolution: {
      resolved_at: issue.metadata?.resolved_at || issue.resolvedAt || null,
      resolved_by_actor_id: issue.metadata?.resolved_by_actor_id || null,
      resolution_note: issue.metadata?.resolution_note || null
    },
    first_seen_at: issue.firstSeenAt,
    last_seen_at: issue.lastSeenAt,
    resolved_at: issue.resolvedAt || null,
    created_at: issue.createdAt,
    updated_at: issue.updatedAt
  };
}

function presentRiskCase(riskCase) {
  return {
    id: riskCase.id,
    case_number: riskCase.caseNumber || riskCase.case_number,
    user_id: riskCase.userId || riskCase.user_id || null,
    domain: riskCase.domain,
    risk_level: riskCase.riskLevel || riskCase.risk_level,
    status: riskCase.status,
    title: riskCase.title,
    summary: riskCase.summary,
    assigned_to: riskCase.assignedTo || riskCase.assigned_to || null,
    signal_ids: riskCase.signalIds || [],
    related_resources: riskCase.relatedResources || [],
    resolution: riskCase.resolution || null,
    resolution_reason: riskCase.resolutionReason || null,
    resolved_by_actor_id: riskCase.resolvedByActorId || null,
    resolved_at: riskCase.resolvedAt || null,
    metadata: riskCase.metadata || {},
    created_at: riskCase.createdAt || riskCase.created_at,
    updated_at: riskCase.updatedAt || riskCase.updated_at
  };
}

function presentRiskSignal(signal) {
  return {
    id: signal.id,
    signal_type: signal.signalType,
    domain: signal.domain,
    severity: signal.severity,
    source: signal.source,
    user_id: signal.userId || null,
    resource_type: signal.resourceType || null,
    resource_id: signal.resourceId || null,
    correlation_id: signal.correlationId,
    reason: signal.reason,
    metadata: signal.metadata || {},
    created_at: signal.createdAt
  };
}

function presentRiskProfile(profile) {
  return {
    user_id: profile.user_id,
    account_state: {
      state: profile.account_state.state,
      risk_level: profile.account_state.riskLevel || profile.account_state.risk_level,
      last_signal_at: profile.account_state.lastSignalAt || null,
      updated_at: profile.account_state.updatedAt || null
    },
    active_restrictions: (profile.active_restrictions || []).map((restriction) => ({
      id: restriction.id,
      capability: restriction.capability,
      status: restriction.status,
      reason: restriction.reason,
      expires_at: restriction.expiresAt || null,
      created_at: restriction.createdAt
    })),
    recent_signals: (profile.recent_signals || []).map(presentRiskSignal),
    cases: (profile.cases || []).map(presentRiskCase)
  };
}

module.exports = {
  presentAdminInvoice,
  presentAdminUser,
  presentAdminPayout,
  presentInvoiceReminderConfiguration,
  presentInvoiceTemplate,
  presentPaymentOpsIssue,
  presentRiskCase,
  presentRiskFlag,
  presentRiskProfile,
  presentRiskSignal,
  presentWebhookEvent,
  presentWebhookEventDetail,
  presentFundRelease,
  presentProviderHealthReport,
  presentQueueOverview,
  presentDeadLetterJob,
  presentOutboxEvent
};
