module.exports = {
  id: '202609150007',
  name: 'api_key_organizations',
  async up(client) {
    await client.exec(`
      ALTER TABLE api_keys ADD COLUMN organization_id TEXT
        REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_api_keys_organization_status
        ON api_keys(organization_id, status, created_at);
    `);
  }
};
