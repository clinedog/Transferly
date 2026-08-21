const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  ASSET_CLASSIFICATIONS,
  GENERATOR_MODES,
  ServiceGenerator,
  createGeneratorContext,
  validateGeneratorOutput
} = require('../generators/generatorContract');
const { GeneratorRegistry } = require('../generators/generatorRegistry');
const { AppError } = require('../utils/errors');

class TestGenerator extends ServiceGenerator {
  async validate(input) {
    return input;
  }

  async preflight() {
    return { ready: true };
  }

  async generate() {
    return {
      asset: {
        content: 'test output',
        assetType: 'test-record',
        mimeType: 'text/plain'
      }
    };
  }
}

function buildContext(overrides = {}) {
  return createGeneratorContext({
    orderId: 'order-1',
    userId: 'user-1',
    serviceId: 'service-1',
    templateId: null,
    input: { label: 'Record' },
    correlationId: 'correlation-1',
    mode: GENERATOR_MODES.PRODUCTION,
    sourceRecords: [{ id: 'source-1', userId: 'user-1' }],
    storage: {},
    ...overrides
  });
}

describe('generator contract and registry', () => {
  test('resolves a registered generator by exact key and version', () => {
    const registry = new GeneratorRegistry();
    registry.register({ key: 'test-record', version: '1', Generator: TestGenerator });

    assert.equal(registry.create('test-record', '1') instanceof TestGenerator, true);
    assert.deepEqual(registry.list(), [{ key: 'test-record', version: '1', enabled: true }]);
  });

  test('fails closed for unknown, disabled, and duplicate generators', () => {
    const registry = new GeneratorRegistry();
    registry.register({ key: 'test-record', version: '1', Generator: TestGenerator, enabled: false });

    assert.throws(
      () => registry.create('missing-record', '1'),
      (error) => error instanceof AppError && error.code === 'GENERATOR_NOT_REGISTERED'
    );
    assert.throws(
      () => registry.create('test-record', '2'),
      (error) => {
        assert.equal(error.code, 'GENERATOR_NOT_REGISTERED');
        assert.deepEqual(error.details.available_versions, ['1']);
        return true;
      }
    );
    assert.throws(
      () => registry.create('test-record', '1'),
      (error) => error instanceof AppError && error.code === 'GENERATOR_DISABLED'
    );
    assert.throws(
      () => registry.register({ key: 'test-record', version: '1', Generator: TestGenerator }),
      (error) => error instanceof AppError && error.code === 'GENERATOR_ALREADY_REGISTERED'
    );
  });

  test('rejects classes that do not implement the shared generator contract', () => {
    const registry = new GeneratorRegistry();
    registry.register({ key: 'invalid-record', version: '1', Generator: class InvalidGenerator {} });

    assert.throws(
      () => registry.create('invalid-record', '1'),
      (error) => error instanceof AppError && error.code === 'GENERATOR_CONTRACT_INVALID'
    );
  });

  test('normalizes and freezes the whitelisted generator context', () => {
    const context = buildContext({
      wallet: { availablePoints: 999 },
      unrelatedUser: { id: 'user-2' }
    });

    assert.equal(Object.isFrozen(context), true);
    assert.equal(Object.isFrozen(context.input), true);
    assert.equal(Object.isFrozen(context.sourceRecords), true);
    assert.equal(Object.isFrozen(context.storage), true);
    assert.equal('wallet' in context, false);
    assert.equal('unrelatedUser' in context, false);
    assert.deepEqual(context.input, { label: 'Record' });
  });

  test('normalizes valid output and defaults production assets to private', () => {
    const output = validateGeneratorOutput(
      {
        asset: {
          content: 'record content',
          assetType: 'transaction-record',
          mimeType: 'text/plain'
        },
        metadata: { generatorVersion: '1' }
      },
      buildContext()
    );

    assert.equal(Buffer.isBuffer(output.asset.content), true);
    assert.equal(output.asset.content.toString('utf8'), 'record content');
    assert.equal(output.asset.classification, ASSET_CLASSIFICATIONS.PRIVATE);
    assert.deepEqual(output.metadata, { generatorVersion: '1' });
  });

  test('enforces sandbox classification and rejects malformed output metadata', () => {
    const sandboxContext = buildContext({ mode: GENERATOR_MODES.SANDBOX });

    assert.throws(
      () => validateGeneratorOutput({
        asset: {
          content: 'not sandboxed',
          assetType: 'training-record',
          mimeType: 'text/plain',
          classification: ASSET_CLASSIFICATIONS.PRIVATE
        }
      }, sandboxContext),
      (error) => error instanceof AppError && error.code === 'GENERATOR_SANDBOX_CLASSIFICATION_REQUIRED'
    );

    assert.throws(
      () => validateGeneratorOutput({ asset: { content: '', assetType: 'bad', mimeType: 'text/plain' } }, buildContext()),
      (error) => error instanceof AppError && error.code === 'GENERATOR_OUTPUT_EMPTY'
    );
  });
});
