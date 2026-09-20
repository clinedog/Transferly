'use strict';

const REDACTION_PATTERNS = [
  /bearer\s+[a-z0-9._~+/=-]+/gi,
  /(authorization|token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi
];

function sanitizeTelemetryValue(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  let sanitized = value.slice(0, maxLength);
  for (const pattern of REDACTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '$1=[REDACTED]');
  }
  return sanitized;
}

function sanitizeClientTelemetry(input = {}) {
  return {
    event: sanitizeTelemetryValue(input.event, 80),
    message: sanitizeTelemetryValue(input.message, 500),
    stack: sanitizeTelemetryValue(input.stack, 2000),
    route: sanitizeTelemetryValue(input.route, 200),
    userAgent: sanitizeTelemetryValue(input.userAgent, 300),
    webVital: sanitizeTelemetryValue(input.webVital, 40),
    value: Number.isFinite(input.value) ? input.value : null
  };
}

module.exports = {
  sanitizeClientTelemetry,
  sanitizeTelemetryValue
};
