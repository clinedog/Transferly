const { transaction } = require('../db');
const { randomUUID } = require('node:crypto');
const { platformConfigRepository } = require('../repositories/platformConfigRepository');
const { receiptRepository } = require('../repositories/receiptRepository');
const { serviceRepository } = require('../repositories/serviceRepository');
const { userRepository } = require('../repositories/userRepository');
const { auditLogService } = require('./auditLogService');
const { pointLedgerService } = require('./pointLedgerService');
const { pointPricingService } = require('./pointPricingService');
const { pointReservationService } = require('./pointReservationService');
const {
  AUDIT_ACTOR_TYPE,
  POINT_TRANSACTION_TYPE,
  RECEIPT_STATUS
} = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { SANDBOX_REQUIRED_MARKINGS } = require('../constants/serviceCatalogue');
const { buildReceiptArtifacts } = require('../utils/simplePdf');

const LABEL_TOKEN_OVERRIDES = new Map([
  ['api', 'API'],
  ['crypto', 'Crypto'],
  ['email', 'Email'],
  ['gcash', 'GCash'],
  ['id', 'ID'],
  ['kuda', 'Kuda'],
  ['opay', 'Opay'],
  ['paypal', 'PayPal'],
  ['qr', 'QR'],
  ['url', 'URL'],
  ['usd', 'USD'],
  ['usdt', 'USDT']
]);

function formatGeneratedFieldLabel(label) {
  return String(label)
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const normalized = token.toLowerCase();
      return LABEL_TOKEN_OVERRIDES.get(normalized) || `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    })
    .join(' ');
}

function buildFields(details, fields) {
  if (Array.isArray(fields) && fields.length > 0) {
    return fields;
  }

  return Object.entries(details || {}).map(([label, value]) => ({
    label: formatGeneratedFieldLabel(label),
    value: String(value)
  }));
}

function buildSummaryText(user, input) {
  if (input.summary) {
    return input.summary;
  }

  return `Generated for ${user.profile?.name || user.email} (${input.type} receipt).`;
}

function resolveServiceSlug(input) {
  return String(input.serviceSlug || input.details?.service || '').trim().toLowerCase();
}

async function requireSandboxReceiptService(input, client) {
  const serviceSlug = resolveServiceSlug(input);
  const service = serviceSlug
    ? await serviceRepository.findAvailableBySlug(serviceSlug, client)
    : null;

  if (
    !service ||
    service.status !== 'sandbox' ||
    service.executionMode !== 'sandbox' ||
    service.metadata?.legacyReceiptGeneration !== true
  ) {
    throw new AppError(
      410,
      'LEGACY_RECEIPT_GENERATION_DISABLED',
      'Direct receipt generation is available only for permanently labeled sandbox test data.'
    );
  }

  const configuredMarkings = Array.isArray(service.metadata?.requiredMarkings)
    ? service.metadata.requiredMarkings
    : [];
  const hasRequiredMarkings = SANDBOX_REQUIRED_MARKINGS.every((marking) =>
    configuredMarkings.includes(marking)
  );
  if (!hasRequiredMarkings) {
    throw new AppError(
      503,
      'SANDBOX_MARKINGS_NOT_CONFIGURED',
      'Sandbox receipt generation is unavailable because its required safety markings are incomplete.'
    );
  }

  return service;
}

function buildSandboxContent(user, input, service) {
  const originalTitle = input.title || `${String(input.type).toUpperCase()} Test Record`;
  const originalSummary = buildSummaryText(user, input);
  const details = {
    ...(input.details || {}),
    service: service.slug,
    sandbox: true,
    required_markings: SANDBOX_REQUIRED_MARKINGS
  };
  const fields = [
    ...SANDBOX_REQUIRED_MARKINGS.map((marking) => ({
      label: 'Safety Marking',
      value: marking
    })),
    ...buildFields(details, input.fields)
  ];

  return {
    details,
    fields,
    summaryText: `${SANDBOX_REQUIRED_MARKINGS.join(' | ')} | ${originalSummary}`,
    title: `${SANDBOX_REQUIRED_MARKINGS[0]} - ${originalTitle}`
  };
}

async function generateReceipt(input) {
  return transaction(async (client) => {
    const service = await requireSandboxReceiptService(input, client);
    const user = await userRepository.findById(input.userId, client);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const platformConfig = await platformConfigRepository.get(client);
    const costPoints = pointPricingService.getServicePointCost(service);

    const availablePoints = await pointLedgerService.getBalance(input.userId, client);
    if (availablePoints < costPoints) {
      throw new AppError(400, 'INSUFFICIENT_POINTS', 'Not enough points to generate this receipt.', {
        requiredPoints: costPoints,
        availablePoints,
        shortfallPoints: costPoints - availablePoints
      });
    }

    const { details, fields, summaryText, title } = buildSandboxContent(user, input, service);
    const artifacts = buildReceiptArtifacts(title, summaryText, fields, details);
    const receiptId = input.receiptId || randomUUID();
    const pointReservation = await pointReservationService.reservePoints(
      {
        reservationKey: `receipt:${receiptId}:points`,
        userId: input.userId,
        amount: costPoints,
        referenceType: 'RECEIPT',
        referenceId: receiptId,
        transactionType: POINT_TRANSACTION_TYPE.RECEIPT_SPEND,
        transactionDescription: `Receipt generated: ${input.type}.`,
        metadata: {
          receiptType: input.type,
          sandbox: true,
          serviceSlug: service.slug
        }
      },
      client
    );

    const receipt = await receiptRepository.create(
      {
        id: receiptId,
        userId: input.userId,
        type: input.type,
        status: RECEIPT_STATUS.GENERATED,
        title,
        summary: {
          text: summaryText
        },
        data: {
          fields,
          details,
          layout: artifacts.layout
        },
        pdfBase64: artifacts.pdfBase64,
        imageDataUrl: artifacts.imageDataUrl,
        emailTo: input.emailTo || null,
        costPoints
      },
      client
    );

    await pointReservationService.commitReservation(
      {
        reservationId: pointReservation.id,
        referenceId: receipt.id
      },
      client
    );

    await platformConfigRepository.update(
      {
        total_receipts: Number(platformConfig.total_receipts || 0) + 1
      },
      client
    );

    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: input.userId,
        action: 'receipt.generate',
        entityType: 'receipt',
        entityId: receipt.id,
        metadata: {
          type: input.type,
          costPoints,
          defaultServicePointCharge: pointPricingService.getEconomySummary().default_service_point_charge,
          sandbox: true,
          serviceSlug: service.slug
        }
      },
      client
    );

    const remainingPoints = await pointLedgerService.getBalance(input.userId, client);

    return {
      receipt,
      summary: {
        user_id: input.userId,
        cost_points: costPoints,
        remaining_points: remainingPoints
      },
      pdf_data_url: artifacts.pdfDataUrl,
      image_data_url: artifacts.imageDataUrl,
      safety: {
        mode: 'sandbox',
        required_markings: SANDBOX_REQUIRED_MARKINGS
      }
    };
  });
}

async function getReceiptHistory(userId, limit = 10) {
  const receipts = await receiptRepository.findByUserId(userId);
  return receipts.slice(0, limit);
}

module.exports = {
  slipcraftReceiptService: {
    generateReceipt,
    getReceiptHistory
  }
};
