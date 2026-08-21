const express = require('express');

const {
  createServiceLaneActionIntentController,
  getServiceController,
  getServiceCommandCenterSummaryController,
  getServiceLaneDetailController,
  getServiceTemplatesController,
  listServicesController
} = require('../controllers/serviceController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const serviceRouter = express.Router();

serviceRouter.get(
  '/',
  requireAuthenticatedUser,
  asyncHandler(listServicesController)
);

serviceRouter.get(
  '/:slug/templates',
  requireAuthenticatedUser,
  asyncHandler(getServiceTemplatesController)
);

serviceRouter.get(
  '/:slug/command-center',
  requireAuthenticatedUser,
  asyncHandler(getServiceCommandCenterSummaryController)
);

serviceRouter.get(
  '/:slug/lanes/:laneId',
  requireAuthenticatedUser,
  asyncHandler(getServiceLaneDetailController)
);

serviceRouter.post(
  '/:slug/lanes/:laneId/actions',
  requireAuthenticatedUser,
  asyncHandler(createServiceLaneActionIntentController)
);

serviceRouter.get(
  '/:slug',
  requireAuthenticatedUser,
  asyncHandler(getServiceController)
);

module.exports = {
  serviceRoutes: serviceRouter
};
