const { z } = require('zod');

const { AppError } = require('../utils/errors');

const GENERATOR_MODES = Object.freeze({
  PRODUCTION: 'production',
  SANDBOX: 'sandbox',
  TRAINING: 'training'
});

const ASSET_CLASSIFICATIONS = Object.freeze({
  PRIVATE: 'private',
  SANDBOX: 'sandbox',
  VERIFIED_RECORD: 'verified-record',
  TRAINING: 'training',
  SUPPORT_PAGE: 'support-page'
});

const MAX_GENERATOR_INPUT_BYTES = 256 * 1024;
const MAX_GENERATOR_METADATA_BYTES = 64 * 1024;
const MAX_GENERATOR_OUTPUT_BYTES = 10 * 1024 * 1024;

const generatorContextSchema = z.object({
  orderId: z.string().trim().min(1).max(128),
  userId: z.string().trim().min(1).max(128),
  serviceId: z.string().trim().min(1).max(128),
  templateId: z.string().trim().min(1).max(128).nullable().optional(),
  correlationId: z.string().trim().min(1).max(128),
  mode: z.enum(Object.values(GENERATOR_MODES)),
  input: z.unknown().optional(),
  sourceRecords: z.unknown().optional(),
  storage: z.object({}).passthrough(),
  logger: z.object({}).passthrough().optional()
});

const generatorOutputSchema = z.object({
  asset: z.object({
    content: z.union([
      z.string(),
      z.instanceof(Buffer),
      z.instanceof(Uint8Array)
    ]),
    assetType: z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/),
    mimeType: z.string().trim().min(3).max(128).regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i),
    classification: z.enum(Object.values(ASSET_CLASSIFICATIONS)).optional(),
    extension: z.string().trim().min(1).max(12).regex(/^[a-z0-9]+$/i).optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional()
  }).strict(),
  metadata: z.unknown().optional()
}).strict();

function normalizeJsonObject(value, options = {}) {
  const label = options.label || 'value';
  const maxBytes = options.maxBytes || MAX_GENERATOR_INPUT_BYTES;
  const candidate = value === undefined || value === null ? {} : value;

  if (typeof candidate !== 'object' || Array.isArray(candidate) || Buffer.isBuffer(candidate)) {
    throw new AppError(400, 'GENERATOR_INPUT_INVALID', `${label} must be a JSON object.`);
  }

  let serialized;
  try {
    serialized = JSON.stringify(candidate);
  } catch (_error) {
    throw new AppError(400, 'GENERATOR_INPUT_INVALID', `${label} must be JSON serializable.`);
  }

  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new AppError(413, 'GENERATOR_INPUT_TOO_LARGE', `${label} exceeds the allowed size.`);
  }

  const normalized = JSON.parse(serialized);
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new AppError(400, 'GENERATOR_INPUT_INVALID', `${label} must be a JSON object.`);
  }

  return normalized;
}

function normalizeSourceRecords(value) {
  const records = value === undefined || value === null ? [] : value;
  if (!Array.isArray(records)) {
    throw new AppError(400, 'GENERATOR_SOURCE_RECORDS_INVALID', 'Generator source records must be an array.');
  }

  return records.map((record, index) => normalizeJsonObject(record, {
    label: `sourceRecords[${index}]`,
    maxBytes: MAX_GENERATOR_INPUT_BYTES
  }));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function createGeneratorContext(input) {
  const parsed = generatorContextSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(500, 'GENERATOR_CONTEXT_INVALID', 'Generator context is incomplete.', {
      fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)
    });
  }

  const context = {
    orderId: parsed.data.orderId,
    userId: parsed.data.userId,
    serviceId: parsed.data.serviceId,
    templateId: parsed.data.templateId || null,
    input: deepFreeze(normalizeJsonObject(parsed.data.input, { label: 'input' })),
    correlationId: parsed.data.correlationId,
    mode: parsed.data.mode,
    sourceRecords: deepFreeze(normalizeSourceRecords(parsed.data.sourceRecords)),
    storage: deepFreeze(normalizeJsonObject(parsed.data.storage, {
      label: 'storage',
      maxBytes: MAX_GENERATOR_METADATA_BYTES
    })),
    logger: parsed.data.logger || null
  };

  return Object.freeze(context);
}

function defaultClassificationForMode(mode) {
  if (mode === GENERATOR_MODES.SANDBOX) {
    return ASSET_CLASSIFICATIONS.SANDBOX;
  }

  if (mode === GENERATOR_MODES.TRAINING) {
    return ASSET_CLASSIFICATIONS.TRAINING;
  }

  return ASSET_CLASSIFICATIONS.PRIVATE;
}

function validateGeneratorOutput(output, context) {
  const parsed = generatorOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw new AppError(500, 'GENERATOR_OUTPUT_INVALID', 'Generator returned invalid output metadata.', {
      fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)
    });
  }

  const content = Buffer.isBuffer(parsed.data.asset.content)
    ? Buffer.from(parsed.data.asset.content)
    : Buffer.from(parsed.data.asset.content);

  if (content.length === 0) {
    throw new AppError(500, 'GENERATOR_OUTPUT_EMPTY', 'Generator returned an empty asset.');
  }

  if (content.length > MAX_GENERATOR_OUTPUT_BYTES) {
    throw new AppError(500, 'GENERATOR_OUTPUT_TOO_LARGE', 'Generator output exceeds the allowed size.');
  }

  const classification = parsed.data.asset.classification || defaultClassificationForMode(context.mode);
  if (
    context.mode === GENERATOR_MODES.SANDBOX &&
    classification !== ASSET_CLASSIFICATIONS.SANDBOX
  ) {
    throw new AppError(
      500,
      'GENERATOR_SANDBOX_CLASSIFICATION_REQUIRED',
      'Sandbox generator output must use the sandbox classification.'
    );
  }

  const metadata = normalizeJsonObject(parsed.data.metadata, {
    label: 'metadata',
    maxBytes: MAX_GENERATOR_METADATA_BYTES
  });

  return {
    asset: {
      content,
      assetType: parsed.data.asset.assetType,
      mimeType: parsed.data.asset.mimeType.toLowerCase(),
      classification,
      extension: parsed.data.asset.extension?.toLowerCase() || null,
      expiresAt: parsed.data.asset.expiresAt || null
    },
    metadata
  };
}

class ServiceGenerator {
  async validate(_input, _context) {
    throw new Error('validate() must be implemented');
  }

  async preflight(_context) {
    throw new Error('preflight() must be implemented');
  }

  async generate(_context) {
    throw new Error('generate() must be implemented');
  }

  async cleanup(_context) {
    return undefined;
  }
}

module.exports = {
  ASSET_CLASSIFICATIONS,
  GENERATOR_MODES,
  MAX_GENERATOR_INPUT_BYTES,
  MAX_GENERATOR_OUTPUT_BYTES,
  ServiceGenerator,
  createGeneratorContext,
  normalizeJsonObject,
  validateGeneratorOutput
};
