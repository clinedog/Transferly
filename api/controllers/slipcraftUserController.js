const { assertCanAccessUserResource } = require('../middleware/authenticateRequest');
const {
  createTopUpOrderSchema,
  createFundingRequestSchema,
  fundingRequestParamsSchema,
  submitFundingEvidenceSchema,
  topUpOrderParamsSchema,
  updateTopUpOrderStatusSchema,
  updateCurrentUserProfileSchema,
  userPointsParamsSchema
} = require('../schemas/slipcraftUserSchemas');
const { slipcraftUserService } = require('../services/slipcraftUserService');
const { pointsFundingService } = require('../services/pointsFundingService');
const { topUpOrderService } = require('../services/topUpOrderService');

async function getFundingConfigController(_request, response) {
  response.json(await pointsFundingService.getFundingConfig());
}

async function listCurrentUserFundingRequestsController(request, response) {
  response.json(await pointsFundingService.listUserFundingRequests(request.auth.userId));
}

async function createCurrentUserFundingRequestController(request, response) {
  const body = createFundingRequestSchema.parse(request.body || {});
  const result = await pointsFundingService.createFundingRequest({
    userId: request.auth.userId,
    packageId: body.packageId,
    userNote: body.userNote,
    idempotencyKey: request.idempotencyKey
  });
  response.status(201).json(result);
}

async function submitCurrentUserFundingEvidenceController(request, response) {
  const params = fundingRequestParamsSchema.parse(request.params || {});
  const body = submitFundingEvidenceSchema.parse(request.body || {});
  const result = await pointsFundingService.submitEvidence({
    userId: request.auth.userId,
    requestId: params.id,
    evidence: body.evidence,
    userTransactionReference: body.userTransactionReference,
    userNote: body.userNote
  });
  response.json(result);
}

async function getUserPointsController(request, response) {
  const params = userPointsParamsSchema.parse(request.params || {});
  assertCanAccessUserResource(request, params.id);
  const result = await slipcraftUserService.getPointsSummary(params.id);
  response.json(result);
}

async function updateCurrentUserProfileController(request, response) {
  const body = updateCurrentUserProfileSchema.parse(request.body || {});
  const user = await slipcraftUserService.updateProfile(request.auth.userId, body);

  response.json({ user });
}

async function deleteCurrentUserAccountController(request, response) {
  const result = await slipcraftUserService.deleteAccount(request.auth.userId);
  response.json(result);
}

async function listCurrentUserTopUpOrdersController(request, response) {
  const orders = await topUpOrderService.listUserOrders(request.auth.userId);
  response.json({ data: orders });
}

async function createCurrentUserTopUpOrderController(request, response) {
  const body = createTopUpOrderSchema.parse(request.body || {});
  const order = await topUpOrderService.createOrder(request.auth.userId, body);
  response.status(201).json({ order });
}

async function updateCurrentUserTopUpOrderStatusController(request, response) {
  const params = topUpOrderParamsSchema.parse(request.params || {});
  const body = updateTopUpOrderStatusSchema.parse(request.body || {});
  const order = await topUpOrderService.updateUserOrderStatus(request.auth.userId, params.id, body);
  response.json({ order });
}

module.exports = {
  createCurrentUserFundingRequestController,
  createCurrentUserTopUpOrderController,
  deleteCurrentUserAccountController,
  getFundingConfigController,
  getUserPointsController,
  listCurrentUserFundingRequestsController,
  listCurrentUserTopUpOrdersController,
  submitCurrentUserFundingEvidenceController,
  updateCurrentUserTopUpOrderStatusController,
  updateCurrentUserProfileController
};
