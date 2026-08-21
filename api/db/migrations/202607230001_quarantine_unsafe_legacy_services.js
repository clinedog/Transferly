const UNSAFE_LEGACY_SERVICE_SLUGS = Object.freeze([
  'opay',
  'kuda',
  'palmpay',
  'binance',
  'bybit',
  'coinbase',
  'crypto-com',
  'cash-app',
  'zelle',
  'venmo',
  'trust-wallet',
  'gcash',
  'pass-clone',
  'link-shortener'
]);

module.exports = {
  id: '202607230001',
  name: 'quarantine_unsafe_legacy_services',
  async up(client) {
    const placeholders = UNSAFE_LEGACY_SERVICE_SLUGS.map(() => '?').join(', ');
    await client.run(
      `UPDATE services
       SET status = 'disabled',
           badge = 'Quarantined',
           updated_at = ?
       WHERE lower(slug) IN (${placeholders})`,
      [new Date().toISOString(), ...UNSAFE_LEGACY_SERVICE_SLUGS]
    );
  }
};

module.exports.UNSAFE_LEGACY_SERVICE_SLUGS = UNSAFE_LEGACY_SERVICE_SLUGS;
