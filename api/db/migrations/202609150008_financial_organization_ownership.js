module.exports = {
  id: '202609150008',
  name: 'financial_organization_ownership',
  async up(client) {
    const invoiceColumns = await client.all('PRAGMA table_info(invoices)');
    if (!invoiceColumns.some((column) => column.name === 'organization_id')) {
      await client.exec(`
        ALTER TABLE invoices ADD COLUMN organization_id TEXT
          REFERENCES organizations(id) ON DELETE CASCADE;
      `);
    }

    const payoutColumns = await client.all('PRAGMA table_info(payouts)');
    if (!payoutColumns.some((column) => column.name === 'organization_id')) {
      await client.exec(`
        ALTER TABLE payouts ADD COLUMN organization_id TEXT
          REFERENCES organizations(id) ON DELETE CASCADE;
      `);
    }

    await client.exec(`
      UPDATE invoices SET organization_id = 'personal:' || user_id
        WHERE organization_id IS NULL;
      UPDATE payouts SET organization_id = 'personal:' || user_id
        WHERE organization_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_organization_created
        ON invoices(organization_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_payouts_organization_created
        ON payouts(organization_id, created_at);
    `);
  }
};
