const { z } = require('zod');

const wiseResourceQuerySchema = z.object({
  status: z.string().trim().min(1).max(64).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

const wiseTransferQuerySchema = wiseResourceQuerySchema.extend({
  currency: z.string().trim().length(3).optional(),
  sourceCurrency: z.string().trim().length(3).optional(),
  targetCurrency: z.string().trim().length(3).optional()
});

module.exports = {
  wiseResourceQuerySchema,
  wiseTransferQuerySchema
};
