const { z } = require('zod');

const flutterwaveResourceQuerySchema = z.object({
  status: z.string().trim().min(1).max(64).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

const flutterwaveTransactionQuerySchema = flutterwaveResourceQuerySchema.extend({
  currency: z.string().trim().length(3).optional(),
  txRef: z.string().trim().min(1).max(255).optional()
});

module.exports = {
  flutterwaveResourceQuerySchema,
  flutterwaveTransactionQuerySchema
};
