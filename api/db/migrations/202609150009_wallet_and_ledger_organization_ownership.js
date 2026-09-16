module.exports = {
  id: '202609150009',
  name: 'wallet_and_ledger_organization_ownership',
  async up(client) {
    const walletColumns = await client.all('PRAGMA table_info(wallets)');
    if (!walletColumns.some((column) => column.name === 'organization_id')) {
      await client.exec('ALTER TABLE wallets ADD COLUMN organization_id TEXT');
    }

    const ledgerColumns = await client.all('PRAGMA table_info(ledger_entries)');
    if (!ledgerColumns.some((column) => column.name === 'organization_id')) {
      await client.exec('ALTER TABLE ledger_entries ADD COLUMN organization_id TEXT');
    }

    await client.exec(`
      UPDATE wallets
      SET organization_id = 'personal:' || user_id
      WHERE organization_id IS NULL;

      UPDATE ledger_entries
      SET organization_id = COALESCE(
        (SELECT w.organization_id FROM wallets w WHERE w.id = ledger_entries.wallet_id),
        'personal:' || user_id
      )
      WHERE organization_id IS NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_organization
        ON wallets(user_id, organization_id);
      CREATE INDEX IF NOT EXISTS idx_wallets_organization_created
        ON wallets(organization_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_ledger_entries_organization_created
        ON ledger_entries(organization_id, created_at);
    `);
  }
};
