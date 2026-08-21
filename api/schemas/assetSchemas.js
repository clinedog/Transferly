const { z } = require('zod');

const resourceIdSchema = z.string().trim().min(1).max(128);

const assetParamsSchema = z.object({
  id: resourceIdSchema
});

const assetDownloadQuerySchema = z.object({
  token: z.string().trim().min(32).max(4096)
});

module.exports = {
  assetDownloadQuerySchema,
  assetParamsSchema
};
