const { z } = require('zod');

const paystackResourceQuerySchema = z.object({
  status: z.string().trim().min(1).max(64).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

const paystackTransactionQuerySchema = paystackResourceQuerySchema.extend({
  currency: z.string().trim().length(3).optional(),
  customerId: z.string().trim().min(1).max(255).optional()
});

module.exports = {
  paystackResourceQuerySchema,
  paystackTransactionQuerySchema
};
