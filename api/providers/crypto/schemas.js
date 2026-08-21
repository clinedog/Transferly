const { z } = require('zod');

const cryptoResourceQuerySchema = z.object({
  status: z.string().trim().min(1).max(64).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

const cryptoChargeQuerySchema = cryptoResourceQuerySchema.extend({
  chargeId: z.string().trim().min(1).max(128).optional()
});

module.exports = {
  cryptoResourceQuerySchema,
  cryptoChargeQuerySchema
};
