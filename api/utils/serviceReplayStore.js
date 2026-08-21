const IORedis = require('ioredis');

const DEFAULT_KEY_PREFIX = 'transferly:bot-api-replay';

let redisClient = null;

function getRedisClient(redisUrl) {
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for Redis-backed service replay protection.');
  }

  if (!redisClient) {
    redisClient = new IORedis(redisUrl, {
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
  }

  return redisClient;
}

function createRedisReplayStore({ redisUrl, keyPrefix = DEFAULT_KEY_PREFIX } = {}) {
  return {
    type: 'redis',
    async checkAndStore(replayKey, ttlMs) {
      const client = getRedisClient(redisUrl);
      if (client.status === 'wait') {
        await client.connect();
      }

      const namespacedKey = `${keyPrefix}:${replayKey}`;
      const result = await client.set(namespacedKey, '1', 'PX', ttlMs, 'NX');
      return result === 'OK';
    }
  };
}

async function closeServiceReplayStore() {
  if (!redisClient) {
    return;
  }

  const client = redisClient;
  redisClient = null;

  try {
    await client.quit();
  } catch (_error) {
    client.disconnect();
  }
}

module.exports = {
  DEFAULT_KEY_PREFIX,
  closeServiceReplayStore,
  createRedisReplayStore
};
