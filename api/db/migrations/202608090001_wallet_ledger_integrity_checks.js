module.exports = {
  id: '202608090001',
  name: 'wallet_ledger_integrity_checks',
  async up(client) {
    await client.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_wallets_non_negative_insert
      BEFORE INSERT ON wallets
      WHEN NEW.pending_balance_cents < 0
        OR NEW.available_balance_cents < 0
        OR NEW.frozen_balance_cents < 0
        OR NEW.paid_out_balance_cents < 0
      BEGIN
        SELECT RAISE(ABORT, 'wallet balance buckets must be non-negative');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_wallets_non_negative_update
      BEFORE UPDATE OF pending_balance_cents, available_balance_cents, frozen_balance_cents, paid_out_balance_cents ON wallets
      WHEN NEW.pending_balance_cents < 0
        OR NEW.available_balance_cents < 0
        OR NEW.frozen_balance_cents < 0
        OR NEW.paid_out_balance_cents < 0
      BEGIN
        SELECT RAISE(ABORT, 'wallet balance buckets must be non-negative');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_ledger_entries_integrity_insert
      BEFORE INSERT ON ledger_entries
      WHEN NEW.amount_cents <= 0
        OR (NEW.debit_bucket IS NULL AND NEW.credit_bucket IS NULL)
        OR (NEW.debit_bucket IS NOT NULL AND NEW.debit_bucket NOT IN ('PENDING', 'AVAILABLE', 'FROZEN', 'PAID_OUT'))
        OR (NEW.credit_bucket IS NOT NULL AND NEW.credit_bucket NOT IN ('PENDING', 'AVAILABLE', 'FROZEN', 'PAID_OUT'))
      BEGIN
        SELECT RAISE(ABORT, 'ledger entry violates bucket invariants');
      END;
    `);
  },
  async down(client) {
    await client.exec(`
      DROP TRIGGER IF EXISTS trg_wallets_non_negative_insert;
      DROP TRIGGER IF EXISTS trg_wallets_non_negative_update;
      DROP TRIGGER IF EXISTS trg_ledger_entries_integrity_insert;
    `);
  }
};