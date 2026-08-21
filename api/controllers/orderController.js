const { orderService } = require('../services/orderService');
const { generatedAssetService } = require('../services/generatedAssetService');
const { assetParamsSchema } = require('../schemas/assetSchemas');
const {
  createOrderSchema,
  orderCancelSchema,
  orderListQuerySchema,
  orderPreflightSchema,
  orderRetrySchema
} = require('../schemas/orderSchemas');

async function preflightOrderController(request, response) {
  const payload = orderPreflightSchema.parse(request.body || {});
  const result = await orderService.preflightOrder({
    auth: request.auth,
    userId: request.auth.userId,
    serviceSlug: payload.serviceSlug,
    templateId: payload.templateId,
    input: payload.input || {}
  });

  response.json(result);
}

async function createOrderController(request, response) {
  const payload = createOrderSchema.parse(request.body || {});
  const result = await orderService.createOrder({
    auth: request.auth,
    userId: request.auth.userId,
    idempotencyKey: request.headers['idempotency-key'],
    serviceSlug: payload.serviceSlug,
    templateId: payload.templateId,
    input: payload.input || {},
    preflightAccepted: payload.preflightAccepted
  });

  response.status(result.idempotent ? 200 : 201).json(result);
}

async function listOrdersController(request, response) {
  const filters = orderListQuerySchema.parse(request.query || {});
  const result = await orderService.listOrders({
    userId: request.auth.userId,
    filters
  });

  response.json(result);
}

async function getOrderController(request, response) {
  const result = await orderService.getOrder({
    userId: request.auth.userId,
    orderId: request.params.id
  });

  response.json(result);
}

async function listOrderAssetsController(request, response) {
  const params = assetParamsSchema.parse(request.params);
  const result = await generatedAssetService.listOrderAssets({
    orderId: params.id,
    userId: request.auth.userId
  });

  response.json(result);
}

async function cancelOrderController(request, response) {
  const payload = orderCancelSchema.parse(request.body || {});
  const result = await orderService.cancelOrder({
    userId: request.auth.userId,
    orderId: request.params.id,
    reason: payload.reason
  });

  response.json(result);
}

async function retryOrderController(request, response) {
  const payload = orderRetrySchema.parse(request.body || {});
  const result = await orderService.retryOrder({
    userId: request.auth.userId,
    orderId: request.params.id,
    reason: payload.reason
  });

  response.json(result);
}

module.exports = {
  cancelOrderController,
  createOrderController,
  getOrderController,
  listOrderAssetsController,
  listOrdersController,
  preflightOrderController,
  retryOrderController
};
