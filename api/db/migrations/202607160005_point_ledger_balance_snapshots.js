async function backfillPointLedgerBalanceSnapshots(client) {
  await client.run(`
    UPDATE points_transactions
    SET balance_after = (
      SELECT COALESCE(SUM(source.amount), 0)
      FROM points_transactions AS source
      WHERE source.user_id = points_transactions.user_id
        AND (
          source.created_at < points_transactions.created_at
          OR (
            source.created_at = points_transactions.created_at
            AND source.id <= points_transactions.id
          )
        )
    )
    WHERE balance_after IS NULL
  `);
}

module.exports = {
  id: '202607160005',
  name: 'point_ledger_balance_snapshots',
  up: backfillPointLedgerBalanceSnapshots
};
