const DEFAULT_RECENT_LIMIT = 25;

function createCounterMap() {
  return Object.create(null);
}

function increment(map, key, amount = 1) {
  const normalized = String(key || 'unknown');
  map[normalized] = (map[normalized] || 0) + amount;
}

function createOperationalMetrics({ now = () => new Date() } = {}) {
  const startedAt = now().toISOString();
  const state = {
    requests: {
      total: 0,
      byStatusClass: createCounterMap(),
      byMethod: createCounterMap(),
      byRoute: createCounterMap(),
      errors: 0,
      slow: 0,
      latency: {
        count: 0,
        totalMs: 0,
        maxMs: 0
      }
    },
    failures: {
      byCode: createCounterMap(),
      byClass: createCounterMap()
    },
    auth: {
      denied: 0,
      byCode: createCounterMap()
    },
    recentFailures: []
  };

  function rememberFailure(entry) {
    state.recentFailures.unshift(entry);
    if (state.recentFailures.length > DEFAULT_RECENT_LIMIT) {
      state.recentFailures.length = DEFAULT_RECENT_LIMIT;
    }
  }

  return {
    recordRequest(event = {}) {
      const statusCode = Number(event.statusCode || 0);
      const statusClass = statusCode ? `${Math.floor(statusCode / 100)}xx` : 'unknown';
      const durationMs = Number.isFinite(Number(event.durationMs)) ? Math.max(0, Number(event.durationMs)) : 0;

      state.requests.total += 1;
      increment(state.requests.byStatusClass, statusClass);
      increment(state.requests.byMethod, event.method || 'UNKNOWN');
      increment(state.requests.byRoute, event.route || event.path || 'unknown');
      state.requests.latency.count += 1;
      state.requests.latency.totalMs += durationMs;
      state.requests.latency.maxMs = Math.max(state.requests.latency.maxMs, durationMs);

      if (statusCode >= 400) state.requests.errors += 1;
      if (durationMs >= 1000) state.requests.slow += 1;
    },

    recordFailure(event = {}) {
      const code = event.errorCode || event.code || 'UNKNOWN_ERROR';
      const failureClass = event.failureClass || event.classification || 'unknown_failure';
      increment(state.failures.byCode, code);
      increment(state.failures.byClass, failureClass);
      if (code === 'ADMIN_AUTH_REQUIRED' || code === 'AUTH_REQUIRED' || code === 'SESSION_INVALID' || code === 'SESSION_EXPIRED') {
        state.auth.denied += 1;
        increment(state.auth.byCode, code);
      }
      rememberFailure({
        at: now().toISOString(),
        requestId: event.requestId || null,
        correlationId: event.correlationId || null,
        route: event.route || null,
        method: event.method || null,
        statusCode: event.statusCode || null,
        errorCode: code,
        failureClass,
        retryable: typeof event.retryable === 'boolean' ? event.retryable : null
      });
    },

    snapshot({ requestId = null, correlationId = null } = {}) {
      const latency = state.requests.latency;
      const averageLatencyMs = latency.count ? Math.round(latency.totalMs / latency.count) : 0;
      const errorRate = state.requests.total ? state.requests.errors / state.requests.total : 0;
      return {
        requestId,
        correlationId,
        generatedAt: now().toISOString(),
        startedAt,
        window: 'process_lifetime',
        requests: {
          total: state.requests.total,
          errors: state.requests.errors,
          slow: state.requests.slow,
          errorRate: Number(errorRate.toFixed(4)),
          latencyMs: {
            average: averageLatencyMs,
            max: Math.round(latency.maxMs)
          },
          byStatusClass: { ...state.requests.byStatusClass },
          byMethod: { ...state.requests.byMethod },
          byRoute: { ...state.requests.byRoute }
        },
        failures: {
          byCode: { ...state.failures.byCode },
          byClass: { ...state.failures.byClass }
        },
        auth: {
          denied: state.auth.denied,
          byCode: { ...state.auth.byCode }
        },
        recentFailures: state.recentFailures.slice()
      };
    },

    reset() {
      state.requests.total = 0;
      state.requests.errors = 0;
      state.requests.slow = 0;
      state.requests.latency.count = 0;
      state.requests.latency.totalMs = 0;
      state.requests.latency.maxMs = 0;
      state.requests.byStatusClass = createCounterMap();
      state.requests.byMethod = createCounterMap();
      state.requests.byRoute = createCounterMap();
      state.failures.byCode = createCounterMap();
      state.failures.byClass = createCounterMap();
      state.auth.denied = 0;
      state.auth.byCode = createCounterMap();
      state.recentFailures = [];
    }
  };
}

const operationalMetrics = createOperationalMetrics();

module.exports = {
  createOperationalMetrics,
  operationalMetrics
};