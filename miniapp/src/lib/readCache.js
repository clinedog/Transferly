const entries = new Map();

function now() {
  return Date.now();
}

export function clearReadCache() {
  entries.clear();
}

export function readThroughCache(key, loader, { ttlMs = 30000, staleMs = 120000 } = {}) {
  const current = entries.get(key);
  const timestamp = now();

  if (current && timestamp - current.updatedAt <= ttlMs) {
    return Promise.resolve(current.value);
  }

  if (current && timestamp - current.updatedAt <= staleMs) {
    if (!current.refresh) {
      current.refresh = Promise.resolve()
        .then(loader)
        .then((value) => {
          entries.set(key, { value, updatedAt: now(), refresh: null });
          return value;
        })
        .catch((error) => {
          entries.set(key, { ...current, refresh: null });
          console.warn('[Transferly] Read cache refresh failed', { key, message: error?.message });
          return current.value;
        });
    }
    return Promise.resolve(current.value);
  }

  const request = Promise.resolve().then(loader).then((value) => {
    entries.set(key, { value, updatedAt: now(), refresh: null });
    return value;
  });
  entries.set(key, { value: undefined, updatedAt: timestamp, refresh: request });
  return request;
}
