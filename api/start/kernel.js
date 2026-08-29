const compression = require('compression');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const config = require('../config');
const { assignRequestId } = require('../middleware/requestContext');
const { authenticateRequest } = require('../middleware/authenticateRequest');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
const { registerRoutes } = require('../routes');
const {
  buildClientHealthPayload,
  buildHealthPayload,
  buildDetailedHealth,
  createHttpRequestLogger
} = require('../core/observability/httpObservability');
const {
  buildApiRateLimitOptions,
  buildCorsOptions,
  createRequestTimeoutMiddleware
} = require('../core/config/httpPolicy');
const { buildJsonBodyParserOptions } = require('../core/webhooks/rawBodyCapture');
const { logger } = require('../utils/logger');

function configureHttpKernel(app) {
  const requestLogger = createHttpRequestLogger({ logger });

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(buildCorsOptions({ config, logger })));
  app.use(compression());
  app.use(assignRequestId);
  app.use(createRequestTimeoutMiddleware({ timeoutMs: config.API_REQUEST_TIMEOUT_MS, logger }));
  app.use(requestLogger);
  app.use(express.json(buildJsonBodyParserOptions()));
  app.use(authenticateRequest);
  app.use(rateLimit(buildApiRateLimitOptions({ config })));
  app.get('/health', (request, response) => {
    response.json(buildHealthPayload({ request, config }));
  });

  app.get('/api/health', (request, response) => {
    response.json(buildHealthPayload({ request, config }));
  });

  app.get('/api/v1/health', (request, response) => {
    response.json(buildHealthPayload({ request, config }));
  });

  app.get('/api/health/client', (request, response) => {
    response.json(buildClientHealthPayload({ request, config }));
  });

  app.get('/api/v1/health/client', (request, response) => {
    response.json(buildClientHealthPayload({ request, config }));
  });

  app.get('/api/health/detailed', async (request, response) => {
    const { checks, degradedReasons } = await buildDetailedHealth({ config });
    const degraded = degradedReasons.length > 0;
    response.status(degraded ? 503 : 200).json({
      ok: !degraded,
      status: degraded ? 'degraded' : 'healthy',
      requestId: request.id,
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      checks,
      degradedReasons
    });
  });

  app.get('/api/v1/health/detailed', async (request, response) => {
    const { checks, degradedReasons } = await buildDetailedHealth({ config });
    const degraded = degradedReasons.length > 0;
    response.status(degraded ? 503 : 200).json({
      ok: !degraded,
      status: degraded ? 'degraded' : 'healthy',
      requestId: request.id,
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      checks,
      degradedReasons
    });
  });

  // Expose the discovery-backed provider registry to runtime integrations.
  try {
    const { providerModuleRegistry } = require('../providers/moduleRegistry');
    app.locals.providerRegistry = providerModuleRegistry;
  } catch (err) {
    logger.warn({ err }, 'Provider discovery failed (continuing without providers)');
  }

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
}

module.exports = {
  configureHttpKernel
};
