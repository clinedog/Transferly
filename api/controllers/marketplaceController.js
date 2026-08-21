const { marketplaceRepository } = require('../repositories/marketplaceRepository');

async function listListingsController(req, res) {
  const rows = await req.app.locals.db.all('SELECT * FROM marketplace_listings WHERE status = ?', ['active']);
  res.json({ success: true, data: rows });
}

async function createListingController(req, res) {
  const body = req.body || {};
  const result = await marketplaceRepository.createListing({
    sellerUserId: req.auth.userId,
    pointsAvailable: body.pointsAvailable,
    unitPriceCents: body.unitPriceCents,
    currencyCode: body.currencyCode,
    paymentMethod: body.paymentMethod,
    minimumPoints: body.minimumPoints,
    maximumPoints: body.maximumPoints,
    expiresAt: body.expiresAt,
    metadata: body.metadata
  });
  res.json({ success: true, data: result });
}

async function createTradeController(req, res) {
  const body = req.body || {};
  const result = await marketplaceRepository.createTrade({
    listingId: body.listingId,
    buyerUserId: req.auth.userId,
    sellerUserId: body.sellerUserId,
    points: body.points,
    monetaryAmountCents: body.monetaryAmountCents,
    currencyCode: body.currencyCode,
    expiresAt: body.expiresAt,
    metadata: body.metadata
  });
  res.json({ success: true, data: result });
}

module.exports = {
  listListingsController,
  createListingController,
  createTradeController
};
