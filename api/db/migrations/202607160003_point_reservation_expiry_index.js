module.exports = {
  id: '202607160003',
  name: 'point_reservation_expiry_index',
  async up(client) {
    await client.exec(`
      CREATE INDEX IF NOT EXISTS idx_point_reservations_expiry
      ON point_reservations (status, expires_at)
    `);
  }
};
