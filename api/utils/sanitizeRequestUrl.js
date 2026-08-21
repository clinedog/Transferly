const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'api_key',
  'apikey',
  'code',
  'id_token',
  'key',
  'password',
  'refresh_token',
  'secret',
  'sig',
  'signature',
  'token'
]);

function sanitizeRequestUrl(value) {
  const originalUrl = String(value || '/');

  try {
    const parsed = new URL(originalUrl, 'http://transferly.local');
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch (_error) {
    return originalUrl.split('?')[0] || '/';
  }
}

module.exports = {
  sanitizeRequestUrl
};
