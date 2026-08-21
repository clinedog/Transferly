const { randomUUID } = require('node:crypto');

const config = require('../config');
const { db, transaction } = require('../db');
const { idempotencyRepository } = require('../repositories/idempotencyRepository');
const { orderAttemptRepository } = require('../repositories/orderAttemptRepository');
const { orderEventRepository } = require('../repositories/orderEventRepository');
const { orderRepository } = require('../repositories/orderRepository');
const { pointReservationRepository } = require('../repositories/pointReservationRepository');
const { serviceRepository } = require('../repositories/serviceRepository');
const { serviceTemplateRepository } = require('../repositories/serviceTemplateRepository');
const {
  FINANCIAL_WORKFLOW,
  assertTransition: assertFinancialTransition,
  listAllowedTransitions
} = require('../core/financial/financialStateMachine');
const {
  AUDIT_ACTOR_TYPE,
  ORDER_ATTEMPT_STATUS,
  ORDER_QUEUE_STATUS,
  ORDER_STATUS,
  POINT_RESERVATION_STATUS,
  RISK_DOMAIN
} = require('../utils/constants');
const { hashCanonicalJson } = require('../utils/canonicalJson');
const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const {
  getOrderDispatchGeneration,
  isCurrentOrderDispatch
} = require('../utils/orderDispatch');
const { auditLogService } = require('./auditLogService');
const { assetStorageService } = require('./assetStorageService');
const { catalogueService } = require('./catalogueService');
const { generationService } = require('./generationService');
const { pointReservationService } = require('./pointReservationService');
const { pointLedgerService } = require('./pointLedgerService');
const { pointPricingService } = require('./pointPricingService');
const { riskEngineService } = require('./riskEngineService');
const { serviceInputValidationService } = require('./serviceInputValidationService');

const CREATE_ORDER_OPERATION = 'orders.create';
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MAX_PROCESSING_IDENTIFIER_LENGTH = 240;

function sanitizeReason(reason) {
  const value = String(reason || '').trim();
  return value ? value.slice(0, 240) : null;
}

function sanitizeFailureMessage(message) {
  const value = String(message || '').trim();
  return value ? value.slice(0, 500) : null;
}

function sanitizeProcessingIdentifier(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, MAX_PROCESSING_IDENTIFIER_LENGTH) : null;
}

function normalizeIdempotencyKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key header is required to create an order.');
  }

  const normalized = value.trim();
  if (normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new AppError(
      400,
      'IDEMPOTENCY_KEY_INVALID',
      `Idempotency-Key must not exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`
    );
  }

  return normalized;
}

function buildCreateOrderRequestIdentity(input) {
  return {
    serviceSlug: String(input.serviceSlug || '').trim().toLowerCase(),
    templateId: input.templateId ? String(input.templateId).trim() : null,
    input: input.input || {},
    preflightAccepted: Boolean(input.preflightAccepted)
  };
}

function legacyOrderMatchesRequest(order, requestIdentity) {
  const persistedTemplateIdentifiers = [order.serviceTemplateId, order.serviceTemplateKey].filter(Boolean);
  const templateMatches = requestIdentity.templateId
    ? persistedTemplateIdentifiers.includes(requestIdentity.templateId)
    : persistedTemplateIdentifiers.length === 0;

  return (
    order.serviceSlug === requestIdentity.serviceSlug &&
    templateMatches &&
    hashCanonicalJson(order.input || {}) === hashCanonicalJson(requestIdentity.input) &&
    Boolean(order.metadata?.preflightAccepted) === requestIdentity.preflightAccepted
  );
}

function serializeService(service) {
  const pointCost = pointPricingService.getServicePointCost(service);
  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    category: service.category,
    description: service.description,
    point_price: pointCost,
    configured_point_price: service.pointPrice,
    input_schema: service.inputSchema,
    output_type: service.outputType,
    execution_mode: service.executionMode,
    version: service.version,
    receipt_type: service.receiptType,
    payment_provider: service.isPaymentProvider
  };
}

function serializeTemplate(template) {
  if (!template) {
    return null;
  }

  return {
    id: template.id,
    template_key: template.templateKey,
    title: template.title,
    receipt_type: template.receiptType,
    cost_points: template.costPoints,
    input_schema: template.inputSchema,
    version: template.version
  };
}

function serializeOrder(order) {
  return {
    id: order.id,
    user_id: order.userId,
    idempotency_key: order.idempotencyKey,
    service_id: order.serviceId,
    service_slug: order.serviceSlug,
    service_template_id: order.serviceTemplateId,
    service_template_key: order.serviceTemplateKey,
    status: order.status,
    point_cost: order.pointCost,
    point_reservation_id: order.pointReservationId,
    input: order.input,
    output: order.output,
    metadata: order.metadata,
    failure_code: order.failureCode,
    failure_message: order.failureMessage,
    queue_status: order.queueStatus,
    attempt_count: order.attemptCount,
    queued_at: order.queuedAt,
    processing_started_at: order.processingStartedAt,
    completed_at: order.completedAt,
    cancelled_at: order.cancelledAt,
    failed_at: order.failedAt,
    created_at: order.createdAt,
    updated_at: order.updatedAt
  };
}

function serializeEvent(event) {
  return {
    id: event.id,
    order_id: event.orderId,
    previous_status: event.previousStatus,
    next_status: event.nextStatus,
    event_type: event.eventType,
    actor_type: event.actorType,
    actor_id: event.actorId,
    reason: event.reason,
    metadata: event.metadata,
    created_at: event.createdAt
  };
}

function serializeAttempt(attempt) {
  return {
    id: attempt.id,
    order_id: attempt.orderId,
    dispatch_generation: attempt.dispatchGeneration,
    attempt_number: attempt.attemptNumber,
    job_id: attempt.jobId,
    correlation_id: attempt.correlationId,
    status: attempt.status,
    started_at: attempt.startedAt,
    lock_expires_at: attempt.lockExpiresAt,
    finished_at: attempt.finishedAt,
    failure_code: attempt.failureCode,
    failure_message: attempt.failureMessage,
    metadata: attempt.metadata,
    created_at: attempt.createdAt,
    updated_at: attempt.updatedAt
  };
}

function assertTransition(previousStatus, nextStatus) {
  assertFinancialTransition({
    workflow: FINANCIAL_WORKFLOW.SERVICE_ORDER,
    previousStatus,
    nextStatus,
    errorCode: 'ORDER_STATE_TRANSITION_INVALID',
    message: `Cannot transition order from ${previousStatus} to ${nextStatus}.`
  });
}

async function recordTransition(input, client) {
  assertTransition(input.order.status, input.nextStatus);

  const metadata = {
    ...input.order.metadata,
    ...(input.metadata || {})
  };
  const updatedOrder = await orderRepository.update(
    input.order.id,
    {
      status: input.nextStatus,
      metadata,
      ...(input.updates || {})
    },
    client
  );

  await orderEventRepository.create(
    {
      orderId: input.order.id,
      previousStatus: input.order.status,
      nextStatus: input.nextStatus,
      eventType: input.eventType || 'status_transition',
      actorType: input.actorType,
      actorId: input.actorId,
      reason: sanitizeReason(input.reason),
      metadata: input.metadata || {}
    },
    client
  );

  await auditLogService.log(
    {
      actorType: input.actorType,
      actorId: input.actorId,
      action: 'order.status_changed',
      entityType: 'order',
      entityId: input.order.id,
      metadata: {
        previousStatus: input.order.status,
        nextStatus: input.nextStatus,
        reason: sanitizeReason(input.reason),
        ...(input.metadata || {})
      }
    },
    client
  );

  return updatedOrder;
}

async function resolveServiceAndTemplate(input, client = db) {
  const service = await serviceRepository.findAvailableBySlug(input.serviceSlug, client);
  const auth = input.auth || {
    userId: input.userId,
    role: 'USER'
  };
  if (!service || auth.userId !== input.userId || !catalogueService.isServiceAvailableToActor(service, auth)) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service is not available.');
  }

  let template = null;
  if (input.templateId) {
    template = await serviceTemplateRepository.findByServiceIdAndIdentifier(service.id, input.templateId, client);
    if (!template || template.status !== 'active') {
      throw new AppError(404, 'SERVICE_TEMPLATE_NOT_FOUND', 'Service template is not available.');
    }
  }

  return {
    service,
    template,
    pointCost: template?.costPoints === null || template?.costPoints === undefined
      ? pointPricingService.getServicePointCost(service)
      : pointPricingService.getServicePointCost({ ...service, pointPrice: template.costPoints, configuration: {} })
  };
}

function assertReservationMatchesOrder(reservation, order) {
  if (
    reservation.userId !== order.userId ||
    reservation.referenceId !== order.id ||
    Number(reservation.amount) !== Number(order.pointCost)
  ) {
    throw new AppError(
      500,
      'ORDER_POINT_RESERVATION_MISMATCH',
      'Order point reservation does not match the persisted order.'
    );
  }
}

async function findOrderReservation(order, client) {
  if (!order.pointReservationId) {
    return null;
  }

  const reservation = await pointReservationRepository.findById(order.pointReservationId, client);
  if (!reservation) {
    throw new AppError(
      500,
      'ORDER_POINT_RESERVATION_MISSING',
      'Order point reservation could not be found.'
    );
  }

  assertReservationMatchesOrder(reservation, order);
  return reservation;
}

async function settleOrderReservation(order, nextStatus, reason, client) {
  const reservation = await findOrderReservation(order, client);
  if (!reservation) {
    return null;
  }

  if (nextStatus === ORDER_STATUS.COMPLETED) {
    return pointReservationService.commitReservation(
      {
        reservationId: reservation.id,
        referenceId: order.id,
        metadata: {
          orderId: order.id,
          orderStatus: ORDER_STATUS.COMPLETED
        }
      },
      client
    );
  }

  if ([ORDER_STATUS.FAILED, ORDER_STATUS.CANCELLED].includes(nextStatus)) {
    return pointReservationService.releaseReservation(
      {
        reservationId: reservation.id,
        reason: sanitizeReason(reason) || 'order_failed'
      },
      client
    );
  }

  return reservation;
}

async function prepareRetryReservation(order, reason, client) {
  if (Number(order.pointCost || 0) === 0) {
    return {
      action: 'not_required',
      reservation: null
    };
  }

  const currentReservation = await findOrderReservation(order, client);
  if (currentReservation?.status === POINT_RESERVATION_STATUS.RESERVED) {
    return {
      action: 'reused_legacy_hold',
      reservation: currentReservation
    };
  }

  if (currentReservation && currentReservation.status !== POINT_RESERVATION_STATUS.RELEASED) {
    throw new AppError(
      409,
      'ORDER_POINT_RESERVATION_NOT_RETRYABLE',
      'Order points cannot be reserved again from the current reservation state.'
    );
  }

  const nextAttempt = Number(order.attemptCount || 0) + 1;
  const orderReservations = await pointReservationRepository.findByReference('ORDER', order.id, client);
  const reservationSequence = orderReservations.length + 1;
  const reservation = await pointReservationService.reservePoints(
    {
      reservationKey: `order:${order.id}:points:reservation:${reservationSequence}`,
      userId: order.userId,
      amount: order.pointCost,
      referenceType: 'ORDER',
      referenceId: order.id,
      metadata: {
        orderId: order.id,
        serviceSlug: order.serviceSlug,
        serviceTemplateKey: order.serviceTemplateKey,
        orderAttempt: nextAttempt,
        reservationSequence,
        retryReason: sanitizeReason(reason)
      }
    },
    client
  );

  assertReservationMatchesOrder(reservation, order);
  return {
    action: 'created',
    reservation
  };
}

async function preflightOrder(input, client = db) {
  const availablePoints = await pointLedgerService.getBalance(input.userId, client);
  const { service, template, pointCost } = await resolveServiceAndTemplate(input, client);
  serviceInputValidationService.validateOrderInput({
    input: input.input || {},
    service,
    template
  });
  const ready = availablePoints >= pointCost;

  return {
    ready,
    status: ready ? ORDER_STATUS.PREFLIGHT : ORDER_STATUS.INSUFFICIENT_POINTS,
    service: serializeService(service),
    template: serializeTemplate(template),
    point_cost: pointCost,
    available_points: availablePoints,
    idempotency_key: `order:${randomUUID()}`,
    requirements: {
      points_required: pointCost,
      points_shortfall: ready ? 0 : pointCost - availablePoints
    },
    warnings: []
  };
}

async function createOrder(input) {
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const requestIdentity = buildCreateOrderRequestIdentity(input);
  const requestHash = hashCanonicalJson(requestIdentity);

  return transaction(async (client) => {
    const idempotencyRecord = await idempotencyRepository.findByUserOperationAndKey(
      input.userId,
      CREATE_ORDER_OPERATION,
      idempotencyKey,
      client
    );
    const existingOrder = await orderRepository.findByIdempotencyKey(idempotencyKey, client);
    if (existingOrder) {
      if (existingOrder.userId !== input.userId) {
        throw new AppError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key belongs to another user.');
      }

      if (idempotencyRecord && idempotencyRecord.requestHash !== requestHash) {
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency key was already used with a different order request.'
        );
      }

      if (!idempotencyRecord && !legacyOrderMatchesRequest(existingOrder, requestIdentity)) {
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency key was already used with a different order request.'
        );
      }

      const result = {
        order: serializeOrder(existingOrder),
        idempotent: true
      };

      if (!idempotencyRecord) {
        await idempotencyRepository.create(
          {
            userId: input.userId,
            idempotencyKey,
            operation: CREATE_ORDER_OPERATION,
            requestHash,
            responseStatus: 200,
            responsePayload: result
          },
          client
        );
      }

      return result;
    }

    if (idempotencyRecord) {
      throw new AppError(
        409,
        'IDEMPOTENCY_REPLAY_UNAVAILABLE',
        'Idempotency record exists, but its order is unavailable.'
      );
    }

    const availablePoints = await pointLedgerService.getBalance(input.userId, client);
    const { service, template, pointCost } = await resolveServiceAndTemplate(input, client);
    const validatedInput = serviceInputValidationService.validateOrderInput({
      input: input.input || {},
      service,
      template
    });
    const riskEvaluation = await riskEngineService.evaluateEvent(
      {
        eventType: 'SERVICE_REQUESTED',
        domain: RISK_DOMAIN.SERVICE,
        userId: input.userId,
        source: 'order-service',
        resourceType: 'service_order_request',
        resourceId: idempotencyKey,
        correlationId: `order:${input.userId}:${idempotencyKey}`,
        metadata: {
          serviceSlug: service.slug,
          serviceTemplateKey: template?.templateKey || null,
          pointCost
        }
      },
      { actorId: input.userId, client }
    );
    if (['REQUIRE_REVIEW', 'REQUIRE_VERIFICATION', 'TEMPORARILY_RESTRICT', 'BLOCK'].includes(riskEvaluation.decision.decision)) {
      throw new AppError(403, 'ACTION_REQUIRES_ADDITIONAL_VERIFICATION', 'This action requires additional verification before continuing.', {
        decision: riskEvaluation.decision.decision,
        riskLevel: riskEvaluation.decision.riskLevel
      });
    }
    if (availablePoints < pointCost) {
      throw new AppError(400, 'INSUFFICIENT_POINTS', 'Not enough points to create this order.', {
        requiredPoints: pointCost,
        availablePoints,
        shortfallPoints: pointCost - availablePoints
      });
    }

    let order = await orderRepository.create(
      {
        userId: input.userId,
        idempotencyKey,
        serviceId: service.id,
        serviceSlug: service.slug,
        serviceTemplateId: template?.id || null,
        serviceTemplateKey: template?.templateKey || null,
        status: ORDER_STATUS.DRAFT,
        pointCost,
        input: validatedInput,
        metadata: {
          preflightAccepted: Boolean(input.preflightAccepted),
          dispatchGeneration: 1
        },
        queueStatus: ORDER_QUEUE_STATUS.PENDING
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: input.userId,
        action: 'order.created',
        entityType: 'order',
        entityId: order.id,
        metadata: {
          serviceSlug: service.slug,
          serviceTemplateKey: template?.templateKey || null,
          pointCost,
          idempotencyKey
        }
      },
      client
    );

    order = await recordTransition({
      order,
      nextStatus: ORDER_STATUS.VALIDATING,
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorId: input.userId,
      reason: 'order_create_requested'
    }, client);

    order = await recordTransition({
      order,
      nextStatus: ORDER_STATUS.PREFLIGHT,
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: 'order-service',
      reason: 'preflight_passed'
    }, client);

    let reservation = null;
    if (pointCost > 0) {
      reservation = await pointReservationService.reservePoints(
        {
          reservationKey: `order:${order.id}:points`,
          userId: input.userId,
          amount: pointCost,
          referenceType: 'ORDER',
          referenceId: order.id,
          metadata: {
            orderId: order.id,
            serviceSlug: service.slug,
            serviceTemplateKey: template?.templateKey || null,
            idempotencyKey
          }
        },
        client
      );

      order = await orderRepository.update(
        order.id,
        {
          pointReservationId: reservation.id,
          metadata: {
            ...order.metadata,
            pointReservationId: reservation.id
          }
        },
        client
      );
    }

    order = await recordTransition({
      order,
      nextStatus: ORDER_STATUS.POINTS_RESERVED,
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: 'order-service',
      reason: pointCost > 0 ? 'points_reserved' : 'no_points_required',
      metadata: {
        pointReservationId: reservation?.id || null
      }
    }, client);

    order = await recordTransition({
      order,
      nextStatus: ORDER_STATUS.QUEUED,
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: 'order-service',
      reason: 'worker_dispatch_deferred',
      metadata: {
        dispatch: 'pending',
        dispatchGeneration: getOrderDispatchGeneration(order)
      },
      updates: {
        queuedAt: new Date().toISOString(),
        queueStatus: ORDER_QUEUE_STATUS.DISPATCH_PENDING
      }
    }, client);

    const result = {
      order: serializeOrder(order),
      idempotent: false
    };

    await idempotencyRepository.create(
      {
        userId: input.userId,
        idempotencyKey,
        operation: CREATE_ORDER_OPERATION,
        requestHash,
        responseStatus: 201,
        responsePayload: result
      },
      client
    );

    return result;
  });
}

async function listOrders(input) {
  const orders = await orderRepository.findManyByUserId(input.userId, input.filters || {});
  return {
    orders: orders.map(serializeOrder)
  };
}

async function getOrder(input) {
  const order = await orderRepository.findById(input.orderId);
  if (!order || order.userId !== input.userId) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  const [events, attempts] = await Promise.all([
    orderEventRepository.findManyByOrderId(order.id),
    orderAttemptRepository.findManyByOrderId(order.id)
  ]);
  return {
    order: serializeOrder(order),
    events: events.map(serializeEvent),
    attempts: attempts.map(serializeAttempt)
  };
}

async function cancelOrder(input) {
  return transaction(async (client) => {
    let order = await orderRepository.findById(input.orderId, client);
    if (!order || order.userId !== input.userId) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
      return {
        order: serializeOrder(order)
      };
    }

    if (!listAllowedTransitions(FINANCIAL_WORKFLOW.SERVICE_ORDER, order.status).includes(ORDER_STATUS.CANCELLED)) {
      throw new AppError(409, 'ORDER_NOT_CANCELLABLE', 'Order cannot be cancelled from its current status.');
    }

    await settleOrderReservation(
      order,
      ORDER_STATUS.CANCELLED,
      sanitizeReason(input.reason) || 'order_cancelled',
      client
    );

    order = await recordTransition({
      order,
      nextStatus: ORDER_STATUS.CANCELLED,
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorId: input.userId,
      reason: sanitizeReason(input.reason) || 'order_cancelled',
      updates: {
        cancelledAt: new Date().toISOString(),
        queueStatus: ORDER_QUEUE_STATUS.UNAVAILABLE
      }
    }, client);

    return {
      order: serializeOrder(order)
    };
  });
}

async function retryOrder(input) {
  return transaction(async (client) => {
    let order = await orderRepository.findById(input.orderId, client);
    if (!order || order.userId !== input.userId) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    if (order.status !== ORDER_STATUS.FAILED) {
      throw new AppError(409, 'ORDER_NOT_RETRYABLE', 'Only failed orders can be retried.');
    }

    const nextAttempt = Number(order.attemptCount || 0) + 1;
    const dispatchGeneration = getOrderDispatchGeneration(order) + 1;
    const retryReservation = await prepareRetryReservation(order, input.reason, client);

    order = await recordTransition({
      order,
      nextStatus: ORDER_STATUS.QUEUED,
      actorType: AUDIT_ACTOR_TYPE.USER,
      actorId: input.userId,
      reason: sanitizeReason(input.reason) || 'order_retry_requested',
      metadata: {
        pointReservationId: retryReservation.reservation?.id || null,
        reservationAction: retryReservation.action,
        requestedAttempt: nextAttempt,
        dispatch: 'pending',
        dispatchGeneration
      },
      updates: {
        pointReservationId: retryReservation.reservation?.id || null,
        queuedAt: new Date().toISOString(),
        processingStartedAt: null,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
        queueStatus: ORDER_QUEUE_STATUS.DISPATCH_PENDING
      }
    }, client);

    return {
      order: serializeOrder(order)
    };
  });
}

async function expireStalePointReservations(input = {}) {
  const cutoff = new Date(input.before || new Date());
  if (!Number.isFinite(cutoff.getTime())) {
    throw new AppError(400, 'POINT_RESERVATION_EXPIRY_CUTOFF_INVALID', 'Expiry cutoff must be a valid timestamp.');
  }

  const requestedLimit = Number(input.limit || config.POINT_RESERVATION_EXPIRY_BATCH_SIZE);
  if (!Number.isInteger(requestedLimit) || requestedLimit <= 0) {
    throw new AppError(400, 'POINT_RESERVATION_EXPIRY_LIMIT_INVALID', 'Expiry batch size must be a positive integer.');
  }

  const limit = Math.min(requestedLimit, config.POINT_RESERVATION_EXPIRY_BATCH_SIZE);
  const before = cutoff.toISOString();
  const candidates = await pointReservationRepository.findExpired({
    before,
    limit,
    referenceType: 'ORDER'
  });
  const result = {
    scanned: candidates.length,
    expired: 0,
    skipped: 0
  };

  for (const candidate of candidates) {
    const outcome = await transaction(async (client) => {
      const reservation = await pointReservationRepository.findById(candidate.id, client);
      if (
        !reservation ||
        reservation.status !== POINT_RESERVATION_STATUS.RESERVED ||
        !reservation.expiresAt ||
        Date.parse(reservation.expiresAt) > cutoff.getTime()
      ) {
        return 'skipped';
      }

      const order = reservation.referenceId
        ? await orderRepository.findById(reservation.referenceId, client)
        : null;
      const isCurrentOrderReservation = order?.pointReservationId === reservation.id;

      if (order && isCurrentOrderReservation) {
        if (![ORDER_STATUS.POINTS_RESERVED, ORDER_STATUS.QUEUED].includes(order.status)) {
          return 'skipped';
        }

        const expiredReservation = await pointReservationService.expireReservation(
          {
            reservationId: reservation.id,
            before,
            reason: 'order_queue_ttl_elapsed',
            actorId: input.actorId || 'point-reservation-recovery'
          },
          client
        );

        await recordTransition({
          order,
          nextStatus: ORDER_STATUS.EXPIRED,
          actorType: AUDIT_ACTOR_TYPE.SYSTEM,
          actorId: input.actorId || 'point-reservation-recovery',
          reason: 'point_reservation_expired',
          metadata: {
            pointReservationId: expiredReservation.id,
            pointReservationStatus: expiredReservation.status,
            reservationExpiresAt: reservation.expiresAt
          },
          updates: {
            queueStatus: ORDER_QUEUE_STATUS.UNAVAILABLE,
            failureCode: 'POINT_RESERVATION_EXPIRED',
            failureMessage: 'Point reservation expired before processing started.'
          }
        }, client);
        return 'expired';
      }

      if (order && [ORDER_STATUS.PROCESSING, ORDER_STATUS.COMPLETED].includes(order.status)) {
        return 'skipped';
      }

      await pointReservationService.expireReservation(
        {
          reservationId: reservation.id,
          before,
          reason: order ? 'orphaned_order_reservation' : 'missing_order_reservation',
          actorId: input.actorId || 'point-reservation-recovery'
        },
        client
      );
      return 'expired';
    });

    result[outcome] += 1;
  }

  return result;
}

async function markOrderDispatched(input) {
  return transaction(async (client) => {
    const order = await orderRepository.findById(input.orderId, client);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    if (!isCurrentOrderDispatch(order, input.dispatchGeneration)) {
      return {
        order: serializeOrder(order),
        skipped: true,
        skipReason: 'stale_dispatch'
      };
    }

    if (order.queueStatus === ORDER_QUEUE_STATUS.DISPATCHED) {
      return {
        order: serializeOrder(order),
        skipped: true
      };
    }

    if (order.status !== ORDER_STATUS.QUEUED) {
      return {
        order: serializeOrder(order),
        skipped: true
      };
    }

    const metadata = {
      ...order.metadata,
      dispatchJobId: input.jobId || null,
      dispatchGeneration: getOrderDispatchGeneration(order)
    };
    const updatedOrder = await orderRepository.update(
      order.id,
      {
        metadata,
        queueStatus: ORDER_QUEUE_STATUS.DISPATCHED
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: 'order-dispatcher',
        action: 'order.queue_dispatched',
        entityType: 'order',
        entityId: order.id,
        metadata: {
          jobId: input.jobId || null,
          dispatchGeneration: getOrderDispatchGeneration(order)
        }
      },
      client
    );

    return {
      order: serializeOrder(updatedOrder)
    };
  });
}

async function discardStagedAsset(stagedAsset, orderId) {
  if (!stagedAsset) {
    return;
  }

  try {
    await assetStorageService.discardStagedAsset(stagedAsset);
  } catch (error) {
    logger.error({ err: error, orderId }, 'Failed to discard staged asset after order finalization');
  }
}

async function finishFailedProcessingAttempt(attempt, error) {
  try {
    await transaction(async (client) => {
      const finishedAttempt = await orderAttemptRepository.finish(
        {
          id: attempt.id,
          lockToken: attempt.lockToken,
          status: ORDER_ATTEMPT_STATUS.FAILED,
          failureCode: sanitizeProcessingIdentifier(error?.code) || 'ORDER_PROCESSING_ERROR',
          failureMessage: sanitizeFailureMessage(error?.message) || 'Order processing failed.',
          metadata: {
            ...attempt.metadata,
            failedBy: 'order-service'
          }
        },
        client
      );

      if (!finishedAttempt) {
        return;
      }

      await auditLogService.log(
        {
          actorType: AUDIT_ACTOR_TYPE.SYSTEM,
          actorId: 'order-service',
          action: 'order.processing_attempt_failed',
          entityType: 'order',
          entityId: attempt.orderId,
          metadata: {
            attemptId: attempt.id,
            attemptNumber: attempt.attemptNumber,
            correlationId: attempt.correlationId,
            failureCode: finishedAttempt.failureCode
          }
        },
        client
      );
    });
  } catch (attemptError) {
    logger.error(
      { err: attemptError, orderId: attempt.orderId, attemptId: attempt.id },
      'Failed to close order processing attempt'
    );
  }
}

async function processQueuedOrder(input) {
  const processingResult = await transaction(async (client) => {
    let order = await orderRepository.findById(input.orderId, client);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    if (!isCurrentOrderDispatch(order, input.dispatchGeneration)) {
      return {
        order,
        staleDispatch: true
      };
    }

    if ([ORDER_STATUS.COMPLETED, ORDER_STATUS.MANUAL_REVIEW, ORDER_STATUS.FAILED, ORDER_STATUS.CANCELLED, ORDER_STATUS.EXPIRED, ORDER_STATUS.REFUNDED].includes(order.status)) {
      return {
        order,
        staleDispatch: false
      };
    }

    if (order.status !== ORDER_STATUS.QUEUED && order.status !== ORDER_STATUS.PROCESSING) {
      throw new AppError(409, 'ORDER_NOT_PROCESSABLE', 'Order cannot be processed from its current status.');
    }

    const now = new Date();
    const activeAttempt = await orderAttemptRepository.findActiveByOrderId(order.id, client);
    if (activeAttempt) {
      const lockExpiresAt = Date.parse(activeAttempt.lockExpiresAt);
      if (Number.isFinite(lockExpiresAt) && lockExpiresAt > now.getTime()) {
        throw new AppError(
          409,
          'ORDER_PROCESSING_LOCKED',
          'Order is already owned by an active processing attempt.',
          {
            correlationId: activeAttempt.correlationId,
            retryAfterMs: lockExpiresAt - now.getTime()
          }
        );
      }

      await orderAttemptRepository.finish(
        {
          id: activeAttempt.id,
          lockToken: activeAttempt.lockToken,
          status: ORDER_ATTEMPT_STATUS.STALE,
          failureCode: 'ORDER_PROCESSING_LOCK_EXPIRED',
          failureMessage: 'Processing lock expired before the attempt completed.',
          metadata: {
            ...activeAttempt.metadata,
            recoveredAt: now.toISOString()
          },
          finishedAt: now.toISOString()
        },
        client
      );

      await auditLogService.log(
        {
          actorType: AUDIT_ACTOR_TYPE.SYSTEM,
          actorId: input.actorId || 'order-worker',
          action: 'order.processing_lock_recovered',
          entityType: 'order',
          entityId: order.id,
          metadata: {
            staleAttemptId: activeAttempt.id,
            staleCorrelationId: activeAttempt.correlationId
          }
        },
        client
      );
    }

    const attemptNumber = Number(order.attemptCount || 0) + 1;
    if (order.status === ORDER_STATUS.QUEUED) {
      order = await recordTransition({
        order,
        nextStatus: ORDER_STATUS.PROCESSING,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: input.actorId || 'order-worker',
        reason: 'worker_started',
        metadata: {
          jobId: input.jobId || null,
          correlationId: input.correlationId || null,
          dispatchGeneration: getOrderDispatchGeneration(order)
        },
        updates: {
          attemptCount: attemptNumber,
          processingStartedAt: now.toISOString(),
          queueStatus: ORDER_QUEUE_STATUS.PROCESSING
        }
      }, client);
    } else {
      order = await orderRepository.update(
        order.id,
        {
          attemptCount: attemptNumber,
          queueStatus: ORDER_QUEUE_STATUS.PROCESSING
        },
        client
      );
    }

    const correlationId =
      sanitizeProcessingIdentifier(input.correlationId) ||
      sanitizeProcessingIdentifier(input.jobId) ||
      randomUUID();
    const lockToken = randomUUID();
    const attempt = await orderAttemptRepository.create(
      {
        orderId: order.id,
        dispatchGeneration: getOrderDispatchGeneration(order),
        attemptNumber,
        jobId: sanitizeProcessingIdentifier(input.jobId),
        correlationId,
        lockToken,
        status: ORDER_ATTEMPT_STATUS.PROCESSING,
        startedAt: now.toISOString(),
        lockExpiresAt: new Date(now.getTime() + config.ORDER_PROCESSING_LOCK_TTL_MS).toISOString(),
        metadata: {
          queueAttempt: Number(input.queueAttempt || 1),
          actorId: input.actorId || 'order-worker'
        }
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: input.actorId || 'order-worker',
        action: 'order.processing_attempt_started',
        entityType: 'order',
        entityId: order.id,
        metadata: {
          attemptId: attempt.id,
          attemptNumber,
          correlationId,
          dispatchGeneration: attempt.dispatchGeneration,
          recoveredExpiredAttempt: Boolean(activeAttempt)
        }
      },
      client
    );

    return {
      order,
      attempt,
      staleDispatch: false
    };
  });

  const processingOrder = processingResult.order;
  if (processingResult.staleDispatch || processingOrder.status !== ORDER_STATUS.PROCESSING) {
    return {
      order: serializeOrder(processingOrder),
      skipped: true,
      ...(processingResult.staleDispatch ? { skipReason: 'stale_dispatch' } : {})
    };
  }

  const executor = input.executor || generationService.executeOrder;
  const processingAttempt = processingResult.attempt;
  let result;
  let nextStatus;
  let stagedAsset = null;
  try {
    result = await executor(processingOrder);
    nextStatus = result.status || ORDER_STATUS.MANUAL_REVIEW;
    stagedAsset = result.stagedAsset || null;
    if (stagedAsset && nextStatus !== ORDER_STATUS.COMPLETED) {
      throw new AppError(500, 'STAGED_ASSET_STATUS_INVALID', 'A staged asset can only finalize a completed order.');
    }
  } catch (error) {
    await discardStagedAsset(stagedAsset, processingOrder.id);
    await finishFailedProcessingAttempt(processingAttempt, error);
    throw error;
  }

  let finalization;
  try {
    finalization = await transaction(async (client) => {
      const currentOrder = await orderRepository.findById(input.orderId, client);
      if (!currentOrder) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      }

      if (!isCurrentOrderDispatch(currentOrder, input.dispatchGeneration)) {
        return {
          order: serializeOrder(currentOrder),
          skipped: true,
          skipReason: 'stale_dispatch'
        };
      }

      if (currentOrder.status !== ORDER_STATUS.PROCESSING) {
        return {
          order: serializeOrder(currentOrder),
          skipped: true
        };
      }

      const activeAttempt = await orderAttemptRepository.findActiveByOrderId(currentOrder.id, client);
      if (
        !activeAttempt ||
        activeAttempt.id !== processingAttempt.id ||
        activeAttempt.lockToken !== processingAttempt.lockToken
      ) {
        return {
          order: serializeOrder(currentOrder),
          skipped: true,
          skipReason: 'processing_lock_lost'
        };
      }

      const generatedAsset = stagedAsset
        ? await assetStorageService.persistStagedAsset({ order: currentOrder, stagedAsset }, client)
        : null;
      const generatedAssetOutput = generatedAsset
        ? assetStorageService.presentGeneratedAsset(generatedAsset)
        : null;
      const output = {
        ...(currentOrder.output || {}),
        ...(result.output || {}),
        ...(generatedAssetOutput
          ? {
            asset_id: generatedAsset.id,
            asset: generatedAssetOutput
          }
          : {})
      };
      const updates = {
        output,
        queueStatus: ORDER_QUEUE_STATUS.UNAVAILABLE,
        failureCode:
          nextStatus === ORDER_STATUS.FAILED
            ? result.failureCode || 'ORDER_PROCESSING_FAILED'
            : result.failureCode || null,
        failureMessage: sanitizeFailureMessage(result.failureMessage),
        ...(nextStatus === ORDER_STATUS.COMPLETED ? { completedAt: new Date().toISOString() } : {}),
        ...(nextStatus === ORDER_STATUS.FAILED ? { failedAt: new Date().toISOString() } : {})
      };

      const settledReservation = await settleOrderReservation(
        currentOrder,
        nextStatus,
        result.reason || 'worker_finished',
        client
      );

      const order = await recordTransition({
        order: currentOrder,
        nextStatus,
        actorType: AUDIT_ACTOR_TYPE.SYSTEM,
        actorId: input.actorId || 'order-worker',
        reason: result.reason || 'worker_finished',
        metadata: {
          jobId: input.jobId || null,
          correlationId: processingAttempt.correlationId,
          attemptId: processingAttempt.id,
          attemptNumber: processingAttempt.attemptNumber,
          dispatchGeneration: getOrderDispatchGeneration(currentOrder),
          pointReservationStatus: settledReservation?.status || null,
          ...(generatedAsset ? { generatedAssetId: generatedAsset.id } : {}),
          ...(result.metadata || {})
        },
        updates
      }, client);

      const finishedAttempt = await orderAttemptRepository.finish(
        {
          id: processingAttempt.id,
          lockToken: processingAttempt.lockToken,
          status:
            nextStatus === ORDER_STATUS.FAILED
              ? ORDER_ATTEMPT_STATUS.FAILED
              : ORDER_ATTEMPT_STATUS.SUCCEEDED,
          failureCode: nextStatus === ORDER_STATUS.FAILED ? updates.failureCode : null,
          failureMessage: nextStatus === ORDER_STATUS.FAILED ? updates.failureMessage : null,
          metadata: {
            ...processingAttempt.metadata,
            outcomeStatus: nextStatus,
            generatedAssetId: generatedAsset?.id || null
          }
        },
        client
      );
      if (!finishedAttempt) {
        throw new AppError(409, 'ORDER_PROCESSING_LOCK_LOST', 'Order processing ownership changed before finalization.');
      }

      return {
        order: serializeOrder(order),
        skipped: false
      };
    });
  } catch (error) {
    await discardStagedAsset(stagedAsset, processingOrder.id);
    await finishFailedProcessingAttempt(processingAttempt, error);
    throw error;
  }

  if (finalization.skipped) {
    await discardStagedAsset(stagedAsset, processingOrder.id);
  }
  return finalization;
}

async function markOrderFailed(input) {
  return transaction(async (client) => {
    const order = await orderRepository.findById(input.orderId, client);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    if (!isCurrentOrderDispatch(order, input.dispatchGeneration)) {
      return {
        order: serializeOrder(order),
        skipped: true,
        skipReason: 'stale_dispatch'
      };
    }

    if ([ORDER_STATUS.COMPLETED, ORDER_STATUS.MANUAL_REVIEW, ORDER_STATUS.FAILED, ORDER_STATUS.CANCELLED, ORDER_STATUS.EXPIRED, ORDER_STATUS.REFUNDED].includes(order.status)) {
      return {
        order: serializeOrder(order),
        skipped: true
      };
    }

    if (order.status !== ORDER_STATUS.QUEUED && order.status !== ORDER_STATUS.PROCESSING) {
      throw new AppError(409, 'ORDER_NOT_FAILABLE', 'Order cannot be failed from its current status.');
    }

    const failureReason = sanitizeReason(input.reason) || 'worker_failed';
    const failureCode = input.failureCode || 'ORDER_PROCESSING_FAILED';
    const failureMessage = sanitizeFailureMessage(input.failureMessage);
    const activeAttempt = await orderAttemptRepository.findActiveByOrderId(order.id, client);
    if (activeAttempt) {
      await orderAttemptRepository.finish(
        {
          id: activeAttempt.id,
          lockToken: activeAttempt.lockToken,
          status: ORDER_ATTEMPT_STATUS.FAILED,
          failureCode,
          failureMessage,
          metadata: {
            ...activeAttempt.metadata,
            exhausted: true,
            failureReason
          }
        },
        client
      );
    }

    const releasedReservation = await settleOrderReservation(
      order,
      ORDER_STATUS.FAILED,
      failureReason,
      client
    );

    const failedOrder = await recordTransition({
      order,
      nextStatus: ORDER_STATUS.FAILED,
      actorType: AUDIT_ACTOR_TYPE.SYSTEM,
      actorId: input.actorId || 'order-worker',
      reason: failureReason,
      metadata: {
        dispatchGeneration: getOrderDispatchGeneration(order),
        pointReservationStatus: releasedReservation?.status || null,
        ...(input.metadata || {})
      },
      updates: {
        failureCode,
        failureMessage,
        failedAt: new Date().toISOString(),
        queueStatus: ORDER_QUEUE_STATUS.UNAVAILABLE
      }
    }, client);

    return {
      order: serializeOrder(failedOrder),
      skipped: false
    };
  });
}

module.exports = {
  orderService: {
    cancelOrder,
    createOrder,
    expireStalePointReservations,
    getOrder,
    listOrders,
    markOrderDispatched,
    markOrderFailed,
    preflightOrder,
    processQueuedOrder,
    retryOrder
  }
};
