const { db } = require('../db');
const { randomUUID } = require('node:crypto');

module.exports = {
  async createListing({ sellerUserId, pointsAvailable, unitPriceCents, currencyCode = 'USD', paymentMethod = 'external', minimumPoints = 1, maximumPoints = null, expiresAt = null, metadata = {} }) {
    const id = `listing:${randomUUID()}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO marketplace_listings (id, seller_user_id, points_available, unit_price_cents, currency_code, payment_method, minimum_points, maximum_points, status, expires_at, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sellerUserId, pointsAvailable, unitPriceCents, currencyCode, paymentMethod, minimumPoints, maximumPoints, 'draft', expiresAt, JSON.stringify(metadata), now, now]
    );
    return { id };
  },

  async getListing(id) {
    return db.get(`SELECT * FROM marketplace_listings WHERE id = ?`, [id]);
  },

  async createTrade({ listingId, buyerUserId, sellerUserId, points, monetaryAmountCents, currencyCode = 'USD', expiresAt = null, metadata = {} }) {
    const id = `trade:${randomUUID()}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO marketplace_trades (id, listing_id, buyer_user_id, seller_user_id, points, monetary_amount_cents, currency_code, status, expires_at, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, listingId, buyerUserId, sellerUserId, points, monetaryAmountCents, currencyCode, 'created', expiresAt, JSON.stringify(metadata), now, now]
    );
    return { id };
  }
};
