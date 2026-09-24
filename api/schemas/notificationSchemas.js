const { z } = require('zod');

const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50)
}).strict();

const notificationParamsSchema = z.object({
  id: z.string().trim().min(1).max(160)
}).strict();

const notificationPreferencesSchema = z.object({
  channels: z.object({
    in_app: z.boolean().optional(),
    telegram: z.boolean().optional(),
    email: z.boolean().optional(),
    webhook: z.boolean().optional()
  }).strict().optional(),
  categories: z.object({
    funding: z.boolean().optional(),
    operations: z.boolean().optional(),
    security: z.boolean().optional()
  }).strict().optional()
}).strict();

module.exports = {
  notificationListQuerySchema,
  notificationParamsSchema,
  notificationPreferencesSchema
};
