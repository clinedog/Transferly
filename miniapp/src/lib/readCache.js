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

  if (current) {
    if (current.refresh) {
      return current.refresh;
    }

    if (timestamp - current.updatedAt <= ttlMs) {
      return Promise.resolve(current.value);
    }

    if (timestamp - current.updatedAt <= staleMs) {
      const refresh = Promise.resolve()
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

      entries.set(key, { ...current, refresh });
      return Promise.resolve(current.value);
    }
  }

  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      entries.set(key, { value, updatedAt: now(), refresh: null });
      return value;
    })
    .catch((error) => {
      entries.delete(key);
      throw error;
    });

  entries.set(key, { value: undefined, updatedAt: timestamp, refresh: request });
  return request;
}
