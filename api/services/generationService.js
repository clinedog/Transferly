const { storageConfig } = require('../config/storageConfig');
const {
  createGeneratorContext,
  normalizeJsonObject,
  validateGeneratorOutput
} = require('../generators/generatorContract');
const { generatorRegistry } = require('../generators/generatorRegistry');
const { serviceRepository } = require('../repositories/serviceRepository');
const { ORDER_STATUS } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { assetStorageService } = require('./assetStorageService');

function fallbackResult(order) {
  return {
    status: ORDER_STATUS.MANUAL_REVIEW,
    output: {
      handled: false,
      service_slug: order.serviceSlug
    },
    failureCode: 'ORDER_HANDLER_UNAVAILABLE',
    failureMessage: 'Order processing handler is not available for this service yet.',
    reason: 'handler_unavailable',
    metadata: {
      handler: 'unavailable'
    }
  };
}

function normalizeValidatedInput(result, originalInput) {
  if (result === false) {
    throw new AppError(422, 'GENERATOR_INPUT_REJECTED', 'Generator rejected the order input.');
  }
  if (result === undefined || result === true) {
    return originalInput;
  }
  return normalizeJsonObject(result, { label: 'validated input' });
}

function assertPreflightReady(result) {
  if (result === false || (result && typeof result === 'object' && result.ready === false)) {
    throw new AppError(422, 'GENERATOR_PREFLIGHT_REJECTED', 'Generator preflight did not approve this order.');
  }
}

function createGenerationService(options = {}) {
  const registry = options.generatorRegistry || generatorRegistry;
  const services = options.serviceRepository || serviceRepository;
  const assets = options.assetStorageService || assetStorageService;
  const serviceLogger = options.logger || logger;

  function buildContext(order, service, input) {
    return createGeneratorContext({
      orderId: order.id,
      userId: order.userId,
      serviceId: service.id,
      templateId: order.serviceTemplateId || null,
      correlationId: order.id,
      mode: service.executionMode,
      input,
      sourceRecords: [],
      storage: {
        visibility: 'private',
        maxAssetBytes: storageConfig.maxAssetBytes
      },
      logger: serviceLogger.child({
        component: 'service-generator',
        orderId: order.id,
        serviceId: service.id,
        generatorKey: service.generatorKey,
        generatorVersion: service.generatorVersion
      })
    });
  }

  async function executeOrder(order) {
    const service = await services.findById(order.serviceId);
    if (!service || service.slug !== order.serviceSlug) {
      throw new AppError(500, 'ORDER_SERVICE_MISMATCH', 'Order service configuration could not be resolved.');
    }

    if (!service.generatorKey && !service.generatorVersion) {
      return fallbackResult(order);
    }
    if (!service.generatorKey || !service.generatorVersion) {
      throw new AppError(500, 'SERVICE_GENERATOR_CONFIG_INVALID', 'Service generator configuration is incomplete.');
    }

    const generator = registry.create(service.generatorKey, service.generatorVersion);
    let context = buildContext(order, service, order.input);
    let stagedAsset = null;

    try {
      const validatedInput = normalizeValidatedInput(
        await generator.validate(context.input, context),
        context.input
      );
      if (validatedInput !== context.input) {
        context = buildContext(order, service, validatedInput);
      }

      assertPreflightReady(await generator.preflight(context));
      const output = validateGeneratorOutput(await generator.generate(context), context);
      stagedAsset = await assets.stageGeneratedAsset({
        order,
        asset: output.asset,
        retentionDays: service.retentionDays
      });

      return {
        status: ORDER_STATUS.COMPLETED,
        output: {
          handled: true,
          service_slug: service.slug,
          generation: {
            generator_key: service.generatorKey,
            generator_version: service.generatorVersion,
            metadata: output.metadata
          }
        },
        reason: 'asset_generated',
        metadata: {
          generatorKey: service.generatorKey,
          generatorVersion: service.generatorVersion
        },
        stagedAsset
      };
    } catch (error) {
      if (stagedAsset) {
        await assets.discardStagedAsset(stagedAsset).catch((cleanupError) => {
          serviceLogger.error({
            err: cleanupError,
            orderId: order.id,
            generatorKey: service.generatorKey,
            generatorVersion: service.generatorVersion
          }, 'Failed to discard a partially generated asset');
        });
      }

      await generator.cleanup(context).catch((cleanupError) => {
        serviceLogger.error({
          err: cleanupError,
          orderId: order.id,
          generatorKey: service.generatorKey,
          generatorVersion: service.generatorVersion
        }, 'Generator cleanup failed');
      });
      throw error;
    }
  }

  return Object.freeze({ executeOrder });
}

const generationService = createGenerationService();

module.exports = {
  createGenerationService,
  generationService
};
