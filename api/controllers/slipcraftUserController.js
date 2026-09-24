const { assertCanAccessUserResource } = require('../middleware/authenticateRequest');
const {
  createTopUpOrderSchema,
  createSupportTicketSchema,
  createFundingRequestSchema,
  fundingRequestParamsSchema,
  submitFundingEvidenceSchema,
  uploadFundingEvidenceSchema,
  topUpOrderParamsSchema,
  updateTopUpOrderStatusSchema,
  updateCurrentUserProfileSchema,
  userPointsParamsSchema,
  supportTicketListQuerySchema,
  transactionActivityParamsSchema,
  transactionActivityQuerySchema
} = require('../schemas/slipcraftUserSchemas');
const { slipcraftUserService } = require('../services/slipcraftUserService');
const { pointsFundingService } = require('../services/pointsFundingService');
const { topUpOrderService } = require('../services/topUpOrderService');
const { supportTicketService } = require('../services/supportTicketService');
const { transactionActivityService } = require('../services/transactionActivityService');

async function listCurrentUserTransactionActivityController(request, response) {
  const query = transactionActivityQuerySchema.parse(request.query || {});
  response.json(await transactionActivityService.listUserActivity({ userId: request.auth.userId, ...query }));
}

async function getCurrentUserTransactionActivityController(request, response) {
  const params = transactionActivityParamsSchema.parse(request.params || {});
  response.json(await transactionActivityService.getUserActivityDetail({
    userId: request.auth.userId,
    activityId: params.id
  }));
}

async function listCurrentUserSupportTicketsController(request, response) {
  const query = supportTicketListQuerySchema.parse(request.query || {});
  const tickets = await supportTicketService.listTickets({ userId: request.auth.userId, limit: query.limit });
  response.json({ data: tickets });
}

async function createCurrentUserSupportTicketController(request, response) {
  const body = createSupportTicketSchema.parse(request.body || {});
  const ticket = await supportTicketService.createTicket({ userId: request.auth.userId, ...body });
  response.status(201).json({ ticket });
}

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

async function getCurrentUserFundingEvidenceController(request, response) {
  const params = fundingRequestParamsSchema.parse(request.params || {});
  const evidence = await pointsFundingService.getEvidenceContentForUser({
    userId: request.auth.userId,
    requestId: params.id
  });
  response.setHeader('Content-Type', evidence.mimeType);
  response.setHeader('Content-Disposition', `attachment; filename="${evidence.fileName.replace(/"/g, '')}"`);
  response.setHeader('Cache-Control', 'private, no-store');
  response.send(evidence.content);
}

async function uploadCurrentUserFundingEvidenceController(request, response) {
  const params = fundingRequestParamsSchema.parse(request.params || {});
  const body = uploadFundingEvidenceSchema.parse(request.body || {});
  const result = await pointsFundingService.uploadAndSubmitEvidence({
    userId: request.auth.userId,
    requestId: params.id,
    fileName: body.fileName,
    mimeType: body.mimeType,
    contentBase64: body.contentBase64,
    userTransactionReference: body.userTransactionReference,
    userNote: body.userNote
  });
  response.status(result.idempotent ? 200 : 201).json(result);
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
  createCurrentUserSupportTicketController,
  createCurrentUserTopUpOrderController,
  deleteCurrentUserAccountController,
  getCurrentUserFundingEvidenceController,
  getFundingConfigController,
  getUserPointsController,
  listCurrentUserFundingRequestsController,
  listCurrentUserSupportTicketsController,
  listCurrentUserTransactionActivityController,
  getCurrentUserTransactionActivityController,
  listCurrentUserTopUpOrdersController,
  submitCurrentUserFundingEvidenceController,
  uploadCurrentUserFundingEvidenceController,
  updateCurrentUserTopUpOrderStatusController,
  updateCurrentUserProfileController
};
