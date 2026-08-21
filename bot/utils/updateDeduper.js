'use strict';

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 5000;

function createUpdateDeduper(options = {}) {
  const ttlMs = Number.isSafeInteger(options.ttlMs) && options.ttlMs > 0 ? options.ttlMs : DEFAULT_TTL_MS;
  const maxEntries = Number.isSafeInteger(options.maxEntries) && options.maxEntries > 0
    ? options.maxEntries
    : DEFAULT_MAX_ENTRIES;
  const seen = new Map();
  let acceptedCount = 0;
  let duplicateCount = 0;
  let cleanupCount = 0;

  function cleanup(now = Date.now()) {
    let deleted = 0;
    for (const [key, expiresAt] of seen.entries()) {
      if (!expiresAt || expiresAt <= now) {
        seen.delete(key);
        deleted += 1;
      }
    }

    while (seen.size > maxEntries) {
      const oldest = seen.keys().next().value;
      if (typeof oldest === 'undefined') break;
      seen.delete(oldest);
      deleted += 1;
    }

    cleanupCount += deleted;
    return deleted;
  }

  function check(updateId, now = Date.now()) {
    if (updateId === null || typeof updateId === 'undefined') {
      return { duplicate: false, tracked: false, updateId: null };
    }

    cleanup(now);
    const key = String(updateId);
    const expiresAt = seen.get(key);
    if (expiresAt && expiresAt > now) {
      duplicateCount += 1;
      return { duplicate: true, tracked: true, updateId: key };
    }

    seen.set(key, now + ttlMs);
    acceptedCount += 1;
    return { duplicate: false, tracked: true, updateId: key };
  }

  function stats(now = Date.now()) {
    cleanup(now);
    return {
      tracked: seen.size,
      acceptedCount,
      duplicateCount,
      cleanupCount,
      ttlMs,
      maxEntries,
    };
  }

  return {
    check,
    cleanup,
    stats,
    reset: () => {
      seen.clear();
      acceptedCount = 0;
      duplicateCount = 0;
      cleanupCount = 0;
    },
  };
}

module.exports = { createUpdateDeduper };
