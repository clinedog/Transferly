'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { logger } = require('../utils/logger');
const { sanitizeClientTelemetry } = require('../core/observability/clientTelemetry');

const telemetrySchema = z.object({
  event: z.string().min(1).max(80),
  message: z.string().max(500).optional(),
  stack: z.string().max(5000).optional(),
  route: z.string().max(200).optional(),
  userAgent: z.string().max(300).optional(),
  webVital: z.string().max(40).optional(),
  value: z.number().finite().optional()
}).strict();

const router = express.Router();
const telemetryRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/', telemetryRateLimiter, (request, response) => {
  const result = telemetrySchema.safeParse(request.body || {});
  if (!result.success) {
    response.status(400).json({
      code: 'CLIENT_TELEMETRY_INVALID',
      message: 'Telemetry payload is invalid.',
      requestId: request.id
    });
    return;
  }

  logger.warn({
    event: sanitizeClientTelemetry(result.data),
    requestId: request.id,
    correlationId: request.correlationId
  }, 'Mini App client telemetry');
  response.status(202).json({ accepted: true, requestId: request.id });
});

module.exports = { clientTelemetryRoutes: router, telemetrySchema };
