const { z } = require('zod');

const dateValue = z.string().trim().min(1).max(40).optional();

const paypalResourceQuerySchema = z.object({
  status: z.string().trim().min(1).max(64).optional(),
  type: z.string().trim().min(1).max(64).optional(),
  cursor: z.union([z.coerce.number().int().nonnegative(), z.string().trim().min(1)]).optional(),
  dateFrom: dateValue,
  dateTo: dateValue,
  limit: z.coerce.number().int().positive().max(100).default(25)
});

const paypalTransactionSearchQuerySchema = paypalResourceQuerySchema.extend({
  source: z.enum(['transferly', 'paypal']).default('transferly'),
  transactionId: z.string().trim().min(1).max(64).optional(),
  transactionType: z.string().trim().min(1).max(80).optional()
});

const paypalOrderQuerySchema = paypalResourceQuerySchema.extend({
  orderId: z.string().trim().min(3).max(127).optional()
});

const paypalCurrencyExchangeQuerySchema = z.object({
  sourceCurrency: z.string().trim().length(3).default('USD').transform((value) => value.toUpperCase()),
  targetCurrency: z.string().trim().length(3).default('EUR').transform((value) => value.toUpperCase()),
  amountCents: z.coerce.number().int().positive().max(100000000).optional()
});

module.exports = {
  paypalCurrencyExchangeQuerySchema,
  paypalOrderQuerySchema,
  paypalResourceQuerySchema,
  paypalTransactionSearchQuerySchema
};
