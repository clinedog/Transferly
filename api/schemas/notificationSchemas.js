const { z } = require('zod');

const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50)
}).strict();

const notificationParamsSchema = z.object({
  id: z.string().trim().min(1).max(160)
}).strict();

module.exports = {
  notificationListQuerySchema,
  notificationParamsSchema
};