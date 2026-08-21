const { z } = require('zod');

const orderInputSchema = z.record(z.unknown()).default({});

const orderServiceSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform((value) => value.toLowerCase());

const orderTemplateIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .optional();

const orderPreflightSchema = z.object({
  serviceSlug: orderServiceSlugSchema,
  templateId: orderTemplateIdentifierSchema,
  input: orderInputSchema.optional()
});

const createOrderSchema = orderPreflightSchema.extend({
  preflightAccepted: z.boolean().optional()
});

const orderListQuerySchema = z.object({
  status: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const orderCancelSchema = z.object({
  reason: z.string().trim().max(240).optional()
});

const orderRetrySchema = z.object({
  reason: z.string().trim().max(240).optional()
});

module.exports = {
  createOrderSchema,
  orderCancelSchema,
  orderListQuerySchema,
  orderPreflightSchema,
  orderRetrySchema
};
