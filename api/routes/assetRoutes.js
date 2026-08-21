const express = require('express');

const {
  downloadAssetController,
  getAssetController,
  issueAssetDownloadUrlController
} = require('../controllers/assetController');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuthenticatedUser } = require('../middleware/authenticateRequest');

const assetRouter = express.Router();

assetRouter.get('/:id/download', asyncHandler(downloadAssetController));
assetRouter.use(requireAuthenticatedUser);
assetRouter.get('/:id', asyncHandler(getAssetController));
assetRouter.post('/:id/download-url', asyncHandler(issueAssetDownloadUrlController));

module.exports = {
  assetRoutes: assetRouter
};
