const { assetDownloadQuerySchema, assetParamsSchema } = require('../schemas/assetSchemas');
const { generatedAssetService } = require('../services/generatedAssetService');

async function getAssetController(request, response) {
  const params = assetParamsSchema.parse(request.params);
  const result = await generatedAssetService.getAsset({
    assetId: params.id,
    userId: request.auth.userId
  });
  response.json(result);
}

async function issueAssetDownloadUrlController(request, response) {
  const params = assetParamsSchema.parse(request.params);
  const result = await generatedAssetService.issueDownloadUrl({
    assetId: params.id,
    userId: request.auth.userId
  });
  response.json(result);
}

async function downloadAssetController(request, response) {
  const params = assetParamsSchema.parse(request.params);
  const query = assetDownloadQuerySchema.parse(request.query || {});
  const result = await generatedAssetService.downloadAsset({
    assetId: params.id,
    token: query.token
  });

  response.set({
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${result.fileName}"`,
    'Content-Type': result.asset.mime_type,
    'X-Content-SHA256': result.asset.checksum
  });
  response.send(result.content);
}

module.exports = {
  downloadAssetController,
  getAssetController,
  issueAssetDownloadUrlController
};
