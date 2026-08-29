const ACTIVE_SERVICE_SLUG = 'paypal';

module.exports = {
  id: '202608290001',
  name: 'paypal_only_production_catalogue',
  async up(client) {
    if (process.env.NODE_ENV === 'test' || process.env.PAYPAL_ONLY_PRODUCTION_MVP === 'false') {
      return;
    }
    const now = new Date().toISOString();
    await client.run(
      `UPDATE services
       SET status = 'preview', badge = 'Coming Soon', permissions_json = '[]', updated_at = ?
       WHERE lower(slug) <> ?`,
      [now, ACTIVE_SERVICE_SLUG]
    );
    await client.run(
      `UPDATE services
       SET status = 'active', badge = 'Live', updated_at = ?
       WHERE lower(slug) = ?`,
      [now, ACTIVE_SERVICE_SLUG]
    );
  }
};