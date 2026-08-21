const { randomBytes } = require('node:crypto');

const config = require('../config');
const { transaction } = require('../db');
const { idempotencyRepository } = require('../repositories/idempotencyRepository');
const { pointsFundingRepository } = require('../repositories/pointsFundingRepository');
const { userRepository } = require('../repositories/userRepository');
const {
  AUDIT_ACTOR_TYPE,
  ACCOUNT_RESTRICTION_CAPABILITY,
  POINT_TRANSACTION_TYPE,
  POINTS_FUNDING_STATUS,
  RISK_DOMAIN
} = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { hashCanonicalJson } = require('../utils/canonicalJson');
const { auditLogService } = require('./auditLogService');
const { pointLedgerService } = require('./pointLedgerService');
const { riskEngineService } = require('./riskEngineService');

const ALLOWED_EVIDENCE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const CREATE_FUNDING_OPERATION = 'points_funding.create';

function expectedAmountMinorForPoints(points) {
  return Number(points) * Number(config.POINTS_TO_NAIRA_RATE) * 100;
}

function assertPackageMatchesPointValue(pack) {
  const expectedAmountMinor = expectedAmountMinorForPoints(pack.points);
  if (Number(pack.priceMinor) !== expectedAmountMinor || Number(pack.bonusPoints || 0) !== 0) {
    throw new AppError(
      500,
      'POINTS_PACKAGE_VALUE_MISMATCH',
      'Points package pricing must satisfy 1 Transferly Point = ₦1.'
    );
  }
}

function formatReferenceDate(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function createFundingReference(now = new Date()) {
  return `TP-${formatReferenceDate(now)}-${randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
}

function presentMoneyMinor(amountMinor, currency) {
  const amount = Number(amountMinor || 0) / 100;
  if (currency === 'NGN') {
    return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function presentPackage(pack) {
  return {
    id: pack.id,
    name: pack.name,
    points: pack.points,
    price_minor: pack.priceMinor,
    currency: pack.currency,
    min_amount_minor: pack.minAmountMinor,
    max_amount_minor: pack.maxAmountMinor,
    bonus_points: pack.bonusPoints,
    active: pack.active,
    display_price: presentMoneyMinor(pack.priceMinor, pack.currency),
    points_value_note: config.POINTS_ECONOMY.valueNote
  };
}

function presentDestination(destination, { revealAccountNumber = false } = {}) {
  if (!destination) return null;
  return {
    id: destination.id,
    provider: destination.provider,
    account_name: destination.accountName,
    account_number: revealAccountNumber ? destination.accountNumber : destination.accountNumberMasked,
    account_number_masked: destination.accountNumberMasked,
    currency: destination.currency,
    instructions: destination.instructions,
    payment_note: destination.metadata?.payment_note || config.POINTS_FUNDING_DESTINATION.paymentNote,
    points_value_note: config.POINTS_ECONOMY.valueNote,
    active: destination.active,
    is_primary: destination.primary
  };
}

function presentFundingRequest(request, { admin = false } = {}) {
  if (!request) return null;
  const destinationSnapshot = request.destinationSnapshot || {};
  return {
    id: request.id,
    public_reference: request.publicReference,
    user_id: request.userId,
    user_name: admin ? request.userName : undefined,
    user_email: admin ? request.userEmail : undefined,
    telegram_username: admin ? request.telegramUsername : undefined,
    package_id: request.packageId,
    requested_points: request.requestedPoints,
    expected_amount_minor: request.expectedAmountMinor,
    display_amount: presentMoneyMinor(request.expectedAmountMinor, request.currency),
    points_value_note: config.POINTS_ECONOMY.valueNote,
    currency: request.currency,
    payment_method: request.paymentMethod,
    payment_reference: request.paymentReference,
    destination_snapshot: {
      ...destinationSnapshot,
      account_number: admin ? destinationSnapshot.account_number_masked : destinationSnapshot.account_number,
      account_number_masked: destinationSnapshot.account_number_masked || destinationSnapshot.account_number
    },
    user_transaction_reference: request.userTransactionReference,
    user_note: request.userNote,
    evidence: request.evidenceFileId || request.evidenceStorageKey ? {
      file_id: request.evidenceFileId,
      storage_key: admin ? request.evidenceStorageKey : undefined,
      metadata: request.evidenceMetadata || {}
    } : null,
    status: request.status,
    risk_status: request.riskStatus,
    possible_duplicate: request.possibleDuplicate,
    submitted_at: request.submittedAt,
    reviewed_at: request.reviewedAt,
    reviewed_by: admin ? request.reviewedBy : undefined,
    assigned_to: admin ? request.assignedTo : undefined,
    assigned_by: admin ? request.assignedBy : undefined,
    assigned_at: admin ? request.assignedAt : undefined,
    rejection_reason: request.rejectionReason,
    admin_note: request.adminNote,
    credited_at: request.creditedAt,
    created_at: request.createdAt,
    updated_at: request.updatedAt
  };
}

async function getUserOrThrow(userId, client) {
  const user = await userRepository.findById(userId, client);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return user;
}

async function getFundingConfig() {
  const [packages, destination] = await Promise.all([
    pointsFundingRepository.listActivePackages(),
    pointsFundingRepository.findPrimaryDestination('NGN')
  ]);
  packages.forEach(assertPackageMatchesPointValue);
  return {
    packages: packages.map(presentPackage),
    payment_destination: presentDestination(destination, { revealAccountNumber: true }),
    evidence_policy: {
      allowed_mime_types: ALLOWED_EVIDENCE_MIME_TYPES,
      max_size_bytes: MAX_EVIDENCE_BYTES
    },
    economy: {
      points_to_naira_rate: config.POINTS_TO_NAIRA_RATE,
      default_service_point_charge: config.DEFAULT_SERVICE_POINT_CHARGE,
      value_note: config.POINTS_ECONOMY.valueNote
    }
  };
}

async function createFundingRequest({ userId, packageId, userNote, idempotencyKey }) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }
  const requestIdentity = {
    packageId,
    userNote: userNote || ''
  };
  const requestHash = hashCanonicalJson(requestIdentity);

  return transaction(async (client) => {
    await getUserOrThrow(userId, client);
    await riskEngineService.assertCapabilityAllowed(userId, ACCOUNT_RESTRICTION_CAPABILITY.FUNDING_RESTRICTED, client);
    const idempotencyRecord = await idempotencyRepository.findByUserOperationAndKey(
      userId,
      CREATE_FUNDING_OPERATION,
      idempotencyKey,
      client
    );
    if (idempotencyRecord) {
      if (idempotencyRecord.requestHash !== requestHash) {
        throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different funding request.');
      }
      return idempotencyRecord.responsePayload;
    }

    const pack = await pointsFundingRepository.findPackageById(packageId, client);
    if (!pack || !pack.active) {
      throw new AppError(404, 'POINTS_PACKAGE_NOT_FOUND', 'Points package is not available.');
    }
    assertPackageMatchesPointValue(pack);

    const destination = await pointsFundingRepository.findPrimaryDestination(pack.currency, client);
    if (!destination) {
      throw new AppError(503, 'PAYMENT_DESTINATION_UNAVAILABLE', 'No active payment destination is configured.');
    }

    let reference = createFundingReference();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await pointsFundingRepository.findRequestByReference(reference, client);
      if (!existing) break;
      reference = createFundingReference();
    }

    const destinationSnapshot = {
      provider: destination.provider,
      account_name: destination.accountName,
      account_number: destination.accountNumber,
      account_number_masked: destination.accountNumberMasked,
      currency: destination.currency,
      instructions: destination.instructions,
      payment_note: destination.metadata?.payment_note || config.POINTS_FUNDING_DESTINATION.paymentNote,
      points_value_note: config.POINTS_ECONOMY.valueNote
    };

    const request = await pointsFundingRepository.createRequest(
      {
        publicReference: reference,
        userId,
        packageId: pack.id,
        requestedPoints: pack.points,
        expectedAmountMinor: pack.priceMinor,
        currency: pack.currency,
        paymentMethod: 'MANUAL_BANK_TRANSFER',
        paymentDestinationId: destination.id,
        paymentReference: reference,
        destinationSnapshot,
        userNote,
        status: POINTS_FUNDING_STATUS.PAYMENT_INSTRUCTIONS,
        metadata: {
          package_name: pack.name,
          base_points: pack.points,
          bonus_points: pack.bonusPoints || 0
        }
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        action: 'points_funding.created',
        entityType: 'points_funding_request',
        entityId: request.id,
        metadata: {
          public_reference: request.publicReference,
          points: request.requestedPoints,
          expected_amount_minor: request.expectedAmountMinor,
          currency: request.currency
        }
      },
      client
    );

    await riskEngineService.evaluateEvent(
      {
        eventType: 'FUNDING_CREATED',
        domain: RISK_DOMAIN.VELOCITY,
        userId,
        source: 'points-funding-service',
        resourceType: 'points_funding_request',
        resourceId: request.id,
        correlationId: `funding:${request.id}`,
        restrictionCapability: ACCOUNT_RESTRICTION_CAPABILITY.FUNDING_RESTRICTED,
        metadata: {
          expectedAmountMinor: request.expectedAmountMinor,
          requestedPoints: request.requestedPoints
        }
      },
      { actorId: userId, client }
    );

    const result = {
      funding_request: presentFundingRequest(request),
      payment_destination: presentDestination(destination, { revealAccountNumber: true })
    };

    await idempotencyRepository.create(
      {
        userId,
        idempotencyKey,
        operation: CREATE_FUNDING_OPERATION,
        requestHash,
        responseStatus: 201,
        responsePayload: result
      },
      client
    );

    return result;
  });
}

function validateEvidence(evidence = {}) {
  if (!evidence.fileId && !evidence.storageKey) {
    throw new AppError(400, 'PAYMENT_EVIDENCE_REQUIRED', 'Payment evidence is required.');
  }
  const mimeType = String(evidence.mimeType || '').toLowerCase();
  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(mimeType)) {
    throw new AppError(400, 'PAYMENT_EVIDENCE_TYPE_UNSUPPORTED', 'Unsupported payment evidence file type.');
  }
  const sizeBytes = Number(evidence.sizeBytes || 0);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_EVIDENCE_BYTES) {
    throw new AppError(400, 'PAYMENT_EVIDENCE_SIZE_INVALID', 'Payment evidence file size is invalid.');
  }
}

async function submitEvidence({ userId, requestId, evidence, userTransactionReference, userNote }) {
  validateEvidence(evidence);
  return transaction(async (client) => {
    const request = await pointsFundingRepository.findRequestById(requestId, client);
    if (!request || request.userId !== userId) {
      throw new AppError(404, 'FUNDING_REQUEST_NOT_FOUND', 'Funding request not found.');
    }
    if (![POINTS_FUNDING_STATUS.PAYMENT_INSTRUCTIONS, POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION].includes(request.status)) {
      throw new AppError(409, 'FUNDING_REQUEST_NOT_SUBMITTABLE', 'Funding request cannot accept evidence in its current state.');
    }

    const duplicateMatches = await pointsFundingRepository.findDuplicateSignals(
      {
        userTransactionReference,
        expectedAmountMinor: request.expectedAmountMinor,
        excludeRequestId: request.id
      },
      client
    );
    const possibleDuplicate = duplicateMatches.length > 0;
    const updated = await pointsFundingRepository.updateRequest(
      request.id,
      {
        userTransactionReference,
        userNote,
        evidenceFileId: evidence.fileId || null,
        evidenceStorageKey: evidence.storageKey || null,
        evidenceMetadata: {
          original_name: evidence.originalName || null,
          mime_type: evidence.mimeType,
          size_bytes: evidence.sizeBytes,
          sha256: evidence.sha256 || null,
          uploaded_at: new Date().toISOString()
        },
        status: POINTS_FUNDING_STATUS.PAYMENT_REPORTED,
        riskStatus: possibleDuplicate ? 'POSSIBLE_DUPLICATE' : 'NORMAL',
        possibleDuplicate,
        submittedAt: new Date().toISOString(),
        metadata: {
          ...request.metadata,
          duplicate_request_ids: duplicateMatches.map((match) => match.id)
        }
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        action: 'points_funding.evidence_submitted',
        entityType: 'points_funding_request',
        entityId: request.id,
        metadata: {
          public_reference: request.publicReference,
          possible_duplicate: possibleDuplicate,
          mime_type: evidence.mimeType,
          size_bytes: evidence.sizeBytes
        }
      },
      client
    );

    return { funding_request: presentFundingRequest(updated) };
  });
}

async function listUserFundingRequests(userId) {
  await getUserOrThrow(userId);
  const requests = await pointsFundingRepository.listUserRequests(userId);
  return { data: requests.map((request) => presentFundingRequest(request)) };
}

async function listAdminFundingRequests(filters = {}) {
  const requests = await pointsFundingRepository.listRequests(filters);
  return { data: requests.map((request) => presentFundingRequest(request, { admin: true })) };
}

async function getAdminFundingRequest(requestId) {
  const request = await pointsFundingRepository.findRequestById(requestId);
  if (!request) {
    throw new AppError(404, 'FUNDING_REQUEST_NOT_FOUND', 'Funding request not found.');
  }
  return { funding_request: presentFundingRequest(request, { admin: true }) };
}

async function markUnderReview({ requestId, adminActorId }) {
  return adminTransition({
    requestId,
    adminActorId,
    nextStatus: POINTS_FUNDING_STATUS.UNDER_REVIEW,
    action: 'points_funding.under_review'
  });
}

async function rejectFundingRequest({ requestId, adminActorId, rejectionReason, adminNote }) {
  return adminTransition({
    requestId,
    adminActorId,
    nextStatus: POINTS_FUNDING_STATUS.REJECTED,
    action: 'points_funding.rejected',
    rejectionReason,
    adminNote
  });
}

async function requestMoreInformation({ requestId, adminActorId, adminNote }) {
  return adminTransition({
    requestId,
    adminActorId,
    nextStatus: POINTS_FUNDING_STATUS.NEEDS_MORE_INFORMATION,
    action: 'points_funding.more_information_requested',
    adminNote
  });
}

async function assignFundingRequest({ requestId, adminActorId, assignedTo }) {
  return transaction(async (client) => {
    const request = await pointsFundingRepository.findRequestById(requestId, client);
    if (!request) {
      throw new AppError(404, 'FUNDING_REQUEST_NOT_FOUND', 'Funding request not found.');
    }
    if ([POINTS_FUNDING_STATUS.POINTS_CREDITED, POINTS_FUNDING_STATUS.REJECTED, POINTS_FUNDING_STATUS.CANCELLED].includes(request.status)) {
      throw new AppError(409, 'FUNDING_REQUEST_FINAL', 'Funding request has already reached a final state.');
    }

    const now = new Date().toISOString();
    const updated = await pointsFundingRepository.updateRequest(
      request.id,
      {
        assignedTo,
        assignedBy: adminActorId,
        assignedAt: now,
        status: request.status === POINTS_FUNDING_STATUS.PAYMENT_REPORTED
          ? POINTS_FUNDING_STATUS.UNDER_REVIEW
          : request.status
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action: 'points_funding.assigned',
        entityType: 'points_funding_request',
        entityId: request.id,
        metadata: {
          assigned_to: assignedTo,
          previous_assigned_to: request.assignedTo || null,
          previous_status: request.status,
          next_status: updated.status,
          public_reference: request.publicReference
        }
      },
      client
    );

    return { funding_request: presentFundingRequest(updated, { admin: true }) };
  });
}

async function adminTransition({ requestId, adminActorId, nextStatus, action, rejectionReason, adminNote }) {
  return transaction(async (client) => {
    const request = await pointsFundingRepository.findRequestById(requestId, client);
    if (!request) {
      throw new AppError(404, 'FUNDING_REQUEST_NOT_FOUND', 'Funding request not found.');
    }
    if ([POINTS_FUNDING_STATUS.POINTS_CREDITED, POINTS_FUNDING_STATUS.REJECTED, POINTS_FUNDING_STATUS.CANCELLED].includes(request.status)) {
      throw new AppError(409, 'FUNDING_REQUEST_FINAL', 'Funding request has already reached a final state.');
    }
    const updated = await pointsFundingRepository.updateRequest(
      request.id,
      {
        status: nextStatus,
        reviewedBy: adminActorId,
        reviewedAt: new Date().toISOString(),
        rejectionReason,
        adminNote
      },
      client
    );
    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorId: adminActorId,
        action,
        entityType: 'points_funding_request',
        entityId: request.id,
        metadata: { previous_status: request.status, next_status: nextStatus, public_reference: request.publicReference }
      },
      client
    );
    return { funding_request: presentFundingRequest(updated, { admin: true }) };
  });
}

async function approveFundingRequest({ requestId, adminActorId, adminNote, idempotencyKey: _idempotencyKey }) {
  return transaction(async (client) => {
    const request = await pointsFundingRepository.findRequestById(requestId, client);
    if (!request) {
      throw new AppError(404, 'FUNDING_REQUEST_NOT_FOUND', 'Funding request not found.');
    }
    if (request.status === POINTS_FUNDING_STATUS.POINTS_CREDITED) {
      return { funding_request: presentFundingRequest(request, { admin: true }), already_processed: true };
    }
    if (![POINTS_FUNDING_STATUS.PAYMENT_REPORTED, POINTS_FUNDING_STATUS.UNDER_REVIEW].includes(request.status)) {
      throw new AppError(409, 'FUNDING_REQUEST_NOT_APPROVABLE', 'Funding request is not eligible for approval.');
    }

    const ledgerEntryKey = `points-funding:${request.id}:credit`;
    const ledgerResult = await pointLedgerService.applyEntry(
      {
        entryKey: ledgerEntryKey,
        userId: request.userId,
        type: POINT_TRANSACTION_TYPE.PURCHASE_CREDIT,
        amount: request.requestedPoints,
        description: `Points funding ${request.publicReference}`,
        referenceType: 'POINTS_FUNDING_REQUEST',
        referenceId: request.id,
        metadata: {
          public_reference: request.publicReference,
          payment_reference: request.paymentReference,
          expected_amount_minor: request.expectedAmountMinor,
          currency: request.currency,
          admin_actor_id: adminActorId
        }
      },
      client
    );

    const updated = await pointsFundingRepository.updateRequest(
      request.id,
      {
        status: POINTS_FUNDING_STATUS.POINTS_CREDITED,
        reviewedBy: adminActorId,
        reviewedAt: new Date().toISOString(),
        adminNote,
        creditedAt: new Date().toISOString(),
        ledgerEntryKey
      },
      client
    );

    if (ledgerResult.applied) {
      await auditLogService.log(
        {
          actorType: AUDIT_ACTOR_TYPE.ADMIN,
          actorId: adminActorId,
          action: 'points_funding.approved_and_credited',
          entityType: 'points_funding_request',
          entityId: request.id,
          metadata: {
            public_reference: request.publicReference,
            points: request.requestedPoints,
            balance_after: ledgerResult.balance
          }
        },
        client
      );
    }

    return {
      funding_request: presentFundingRequest(updated, { admin: true }),
      ledger_entry: ledgerResult.entry,
      balance: ledgerResult.balance,
      already_processed: !ledgerResult.applied
    };
  });
}

async function getOperationsMetrics() {
  const pendingRequests = await pointsFundingRepository.countPending();
  return {
    pending_requests: pendingRequests,
    reconciliation_issues: 0
  };
}

module.exports = {
  pointsFundingService: {
    approveFundingRequest,
    assignFundingRequest,
    createFundingRequest,
    getAdminFundingRequest,
    getFundingConfig,
    getOperationsMetrics,
    listAdminFundingRequests,
    listUserFundingRequests,
    markUnderReview,
    presentFundingRequest,
    requestMoreInformation,
    rejectFundingRequest,
    submitEvidence
  }
};