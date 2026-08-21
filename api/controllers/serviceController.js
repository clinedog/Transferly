const { serviceCommandCenterService } = require('../services/serviceCommandCenterService');
const { catalogueService } = require('../services/catalogueService');
const { serviceLaneActionIntentSchema } = require('../schemas/serviceSchemas');

async function listServicesController(request, response) {
  const result = await catalogueService.listServices({ auth: request.auth });
  response.json(result);
}

async function getServiceController(request, response) {
  const result = await catalogueService.getServiceBySlug(request.params.slug, { auth: request.auth });
  response.json(result);
}

async function getServiceTemplatesController(request, response) {
  const result = await catalogueService.getServiceTemplates(request.params.slug, { auth: request.auth });
  response.json(result);
}

async function getServiceCommandCenterSummaryController(request, response) {
  const result = await serviceCommandCenterService.getServiceCommandCenterSummary({
    auth: request.auth,
    slug: request.params.slug
  });

  response.json(result);
}

async function getServiceLaneDetailController(request, response) {
  const result = await serviceCommandCenterService.getServiceLaneDetail({
    auth: request.auth,
    slug: request.params.slug,
    laneId: request.params.laneId
  });

  response.json(result);
}

async function createServiceLaneActionIntentController(request, response) {
  const payload = serviceLaneActionIntentSchema.parse(request.body || {});
  const result = await serviceCommandCenterService.createServiceLaneActionIntent({
    auth: request.auth,
    slug: request.params.slug,
    laneId: request.params.laneId,
    intent: payload.intent,
    source: payload.source,
    metadata: payload.metadata
  });

  response.status(201).json(result);
}

module.exports = {
  listServicesController,
  getServiceController,
  getServiceTemplatesController,
  getServiceCommandCenterSummaryController,
  getServiceLaneDetailController,
  createServiceLaneActionIntentController
};
