const express = require('express');

const {
  cancelOrderController,
  createOrderController,
  getOrderController,
  listOrderAssetsController,
  listOrdersController,
  preflightOrderController,
  retryOrderController
} = require('../controllers/orderController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const orderRouter = express.Router();

orderRouter.use(requireAuthenticatedUser);

orderRouter.post('/preflight', asyncHandler(preflightOrderController));
orderRouter.post('/', asyncHandler(createOrderController));
orderRouter.get('/', asyncHandler(listOrdersController));
orderRouter.get('/:id/assets', asyncHandler(listOrderAssetsController));
orderRouter.get('/:id', asyncHandler(getOrderController));
orderRouter.post('/:id/cancel', asyncHandler(cancelOrderController));
orderRouter.post('/:id/retry', asyncHandler(retryOrderController));

module.exports = {
  orderRoutes: orderRouter
};
