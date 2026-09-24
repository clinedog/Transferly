module.exports = {
  id: '202609230001',
  name: 'support_ticket_context',
  async up(client) {
    await client.exec(`
      ALTER TABLE support_tickets ADD COLUMN details TEXT NOT NULL DEFAULT '';
      ALTER TABLE support_tickets ADD COLUMN context_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE support_tickets ADD COLUMN transaction_reference TEXT;
      ALTER TABLE support_tickets ADD COLUMN provider TEXT;
      ALTER TABLE support_tickets ADD COLUMN operation TEXT;
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created
        ON support_tickets (user_id, created_at DESC);
    `);
  }
};
