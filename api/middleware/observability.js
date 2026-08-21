const { db } = require('../db');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname'
    }
  }
});

// Middleware to attach request ID and logger to each request
function attachRequestId(req, res, next) {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.id = requestId;
  req.logger = logger.child({ requestId });

  res.setHeader('x-request-id', requestId);
  req.logger.info({
    msg: 'incoming_request',
    method: req.method,
    path: req.path,
    query: req.query
  });

  next();
}

// Health check endpoint that includes service readiness
async function healthCheck(req, res) {
  try {
    // Check database connectivity
    const dbCheck = await db.get('SELECT 1');
    if (!dbCheck) {
      throw new Error('Database check failed');
    }

    // Check Redis connectivity (if configured)
    let redisOk = true;
    if (process.env.REDIS_URL) {
      try {
        // Placeholder: actual Redis check would go here
        redisOk = true;
      } catch (_) {
        redisOk = false;
      }
    }

    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbCheck ? 'ok' : 'failed',
        redis: redisOk ? 'ok' : 'unavailable'
      }
    };

    res.status(200).json(status);
  } catch (error) {
    req.logger.error({
      msg: 'health_check_failed',
      error: error.message
    });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

// Operational insights endpoint
async function operationalInsights(req, res) {
  try {
    const insights = {
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        node_version: process.version
      },
      runtime: {
        uptime_seconds: process.uptime(),
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        memory_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
    res.json(insights);
  } catch (error) {
    req.logger.error({
      msg: 'insights_error',
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  attachRequestId,
  healthCheck,
  operationalInsights,
  logger
};
