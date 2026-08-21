const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'generation-service-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'generation-service-webhook';

const {
  ASSET_CLASSIFICATIONS,
  ServiceGenerator
} = require('../generators/generatorContract');
const { GeneratorRegistry } = require('../generators/generatorRegistry');
const { createGenerationService } = require('../services/generationService');
const { ORDER_STATUS } = require('../utils/constants');

const ORDER = Object.freeze({
  id: 'order-1',
  userId: 'user-1',
  serviceId: 'service-1',
  serviceSlug: 'record-service',
  serviceTemplateId: null,
  input: { reference: ' raw ' }
});

function createLogger() {
  const errors = [];
  const logger = {
    child() {
      return logger;
    },
    error(details, message) {
      errors.push({ details, message });
    }
  };
  return { errors, logger };
}

function createService(overrides = {}) {
  return {
    id: ORDER.serviceId,
    slug: ORDER.serviceSlug,
    generatorKey: 'record-generator',
    generatorVersion: '1',
    executionMode: 'production',
    retentionDays: 7,
    ...overrides
  };
}

describe('generation service', () => {
  test('runs an exact generator with a restricted context and stages validated output', async () => {
    const contexts = [];
    class RecordGenerator extends ServiceGenerator {
      async validate(input, context) {
        contexts.push(context);
        return { reference: input.reference.trim() };
      }

      async preflight(context) {
        contexts.push(context);
        return { ready: true };
      }

      async generate(context) {
        contexts.push(context);
        return {
          asset: {
            content: `record:${context.input.reference}`,
            assetType: 'transaction-record',
            mimeType: 'text/plain'
          },
          metadata: { format: 'plain-v1' }
        };
      }
    }

    const registry = new GeneratorRegistry();
    registry.register({ key: 'record-generator', version: '1', Generator: RecordGenerator });
    const staged = [];
    const { logger } = createLogger();
    const service = createGenerationService({
      generatorRegistry: registry,
      serviceRepository: { async findById() { return createService(); } },
      assetStorageService: {
        async stageGeneratedAsset(input) {
          staged.push(input);
          return { staged: true };
        },
        async discardStagedAsset() {
          throw new Error('discard should not run');
        }
      },
      logger
    });

    const result = await service.executeOrder(ORDER);

    assert.equal(result.status, ORDER_STATUS.COMPLETED);
    assert.deepEqual(result.stagedAsset, { staged: true });
    assert.equal(staged.length, 1);
    assert.equal(staged[0].asset.content.toString('utf8'), 'record:raw');
    assert.equal(staged[0].asset.classification, ASSET_CLASSIFICATIONS.PRIVATE);
    assert.equal(staged[0].retentionDays, 7);
    assert.equal(contexts.length, 3);
    assert.deepEqual(contexts[1].input, { reference: 'raw' });
    assert.equal(Object.isFrozen(contexts[1].storage), true);
    assert.equal('wallet' in contexts[1], false);
    assert.equal('storageAdapter' in contexts[1], false);
  });

  test('preserves manual-review fallback for services without a generator', async () => {
    let registryCalls = 0;
    const { logger } = createLogger();
    const service = createGenerationService({
      generatorRegistry: {
        create() {
          registryCalls += 1;
          throw new Error('registry should not run');
        }
      },
      serviceRepository: {
        async findById() {
          return createService({ generatorKey: null, generatorVersion: null });
        }
      },
      logger
    });

    const result = await service.executeOrder(ORDER);
    assert.equal(result.status, ORDER_STATUS.MANUAL_REVIEW);
    assert.equal(result.failureCode, 'ORDER_HANDLER_UNAVAILABLE');
    assert.deepEqual(result.output, {
      handled: false,
      service_slug: ORDER.serviceSlug
    });
    assert.equal(registryCalls, 0);
  });

  test('runs generator cleanup when preflight fails without staging an asset', async () => {
    let cleanupCalls = 0;
    let stageCalls = 0;
    class RejectedGenerator extends ServiceGenerator {
      async validate(input) {
        return input;
      }

      async preflight() {
        return { ready: false };
      }

      async generate() {
        throw new Error('generate should not run');
      }

      async cleanup() {
        cleanupCalls += 1;
      }
    }

    const registry = new GeneratorRegistry();
    registry.register({ key: 'record-generator', version: '1', Generator: RejectedGenerator });
    const { logger } = createLogger();
    const service = createGenerationService({
      generatorRegistry: registry,
      serviceRepository: { async findById() { return createService(); } },
      assetStorageService: {
        async stageGeneratedAsset() {
          stageCalls += 1;
        },
        async discardStagedAsset() {}
      },
      logger
    });

    await assert.rejects(
      service.executeOrder(ORDER),
      (error) => error.code === 'GENERATOR_PREFLIGHT_REJECTED'
    );
    assert.equal(cleanupCalls, 1);
    assert.equal(stageCalls, 0);
  });
});
