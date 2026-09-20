export function normalizeRequestHeaders(headers = {}) {
  const entries = headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers || {});
  const normalized = {};

  for (const [key, value] of entries) {
    const headerName = String(key).toLowerCase();
    if (
      !value ||
      headerName === 'x-request-id' ||
      headerName === 'cookie' ||
      headerName === 'set-cookie' ||
      headerName === 'connection'
    ) {
      continue;
    }

    normalized[headerName] = String(value);
  }

  return normalized;
}

export function buildRequestDedupKey({ method, url, headers = {} }) {
  const normalizedHeaders = normalizeRequestHeaders(headers);
  const requestMethod = String(method || 'GET').toUpperCase();

  return JSON.stringify({
    method: requestMethod,
    url: String(url || ''),
    authorization: normalizedHeaders.authorization || '',
    organizationId: normalizedHeaders['x-organization-id'] || '',
    transferlyClient: normalizedHeaders['x-transferly-client'] || ''
  });
}

export function createRequestDeduper() {
  const inFlight = new Map();

  return {
    get(key) {
      return inFlight.get(key) || null;
    },
    set(key, promise) {
      inFlight.set(key, promise);
      return promise;
    },
    delete(key) {
      inFlight.delete(key);
    },
    clear() {
      inFlight.clear();
    }
  };
}
