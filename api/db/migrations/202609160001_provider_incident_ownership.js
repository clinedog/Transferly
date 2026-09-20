'use strict';

module.exports = {
  id: '202609160001',
  name: 'provider_incident_ownership',
  async up(client) {
    await client.exec(`
      ALTER TABLE provider_incidents ADD COLUMN runbook_key TEXT;
      ALTER TABLE provider_incidents ADD COLUMN owner_role TEXT;
    `);
  }
};
