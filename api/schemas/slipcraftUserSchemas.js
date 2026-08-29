const { z } = require('zod');

const userPointsParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const updateCurrentUserProfileSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

const topUpOrderParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const createTopUpOrderSchema = z.object({
  points: z.coerce.number().int().min(5).max(1000000),
  amountLabel: z.string().trim().min(1).max(80).optional(),
  methodId: z.string().trim().min(1).max(80),
  methodTitle: z.string().trim().min(1).max(120),
  serviceIntent: z.string().trim().max(120).optional().default(''),
  instructions: z.string().trim().max(500).optional().default(''),
  vendorUrl: z.string().trim().url().max(500).optional().or(z.literal('')).default(''),
  notes: z.string().trim().max(500).optional().default('')
});

const updateTopUpOrderStatusSchema = z.object({
  status: z.enum(['awaiting_confirmation', 'cancelled']),
  notes: z.string().trim().max(500).optional().default('')
});

const createFundingRequestSchema = z.object({
  packageId: z.string().trim().min(1).max(120),
  userNote: z.string().trim().max(1000).optional().default('')
}).strict();

const fundingRequestParamsSchema = z.object({
  id: z.string().trim().min(1).max(120)
});

const submitFundingEvidenceSchema = z.object({
  evidence: z.object({
    fileId: z.string().trim().max(200).optional(),
    storageKey: z.string().trim().max(500).optional(),
    originalName: z.string().trim().max(255).optional(),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.coerce.number().int().positive(),
    sha256: z.string().trim().regex(/^[a-f0-9]{64}$/i).optional()
  }).strict(),
  userTransactionReference: z.string().trim().max(120).optional().default(''),
  userNote: z.string().trim().max(1000).optional().default('')
}).strict();

const uploadFundingEvidenceSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  contentBase64: z.string().trim().min(1),
  userTransactionReference: z.string().trim().max(120).optional().default(''),
  userNote: z.string().trim().max(1000).optional().default('')
}).strict();

module.exports = {
  createFundingRequestSchema,
  createTopUpOrderSchema,
  fundingRequestParamsSchema,
  submitFundingEvidenceSchema,
  uploadFundingEvidenceSchema,
  topUpOrderParamsSchema,
  updateTopUpOrderStatusSchema,
  updateCurrentUserProfileSchema,
  userPointsParamsSchema
};
