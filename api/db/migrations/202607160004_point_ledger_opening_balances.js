async function importOpeningBalances(client) {
  const profiles = await client.all(`
    SELECT
      p.user_id,
      p.points AS profile_balance,
      COALESCE(SUM(t.amount), 0) AS ledger_balance
    FROM profiles p
    LEFT JOIN points_transactions t ON t.user_id = p.user_id
    GROUP BY p.user_id, p.points
  `);

  for (const profile of profiles) {
    const profileBalance = Number(profile.profile_balance);
    const previousLedgerBalance = Number(profile.ledger_balance);
    const difference = profileBalance - previousLedgerBalance;
    if (difference === 0) {
      continue;
    }

    const entryKey = `point-ledger:opening-balance:${profile.user_id}`;
    const existing = await client.get(
      'SELECT id FROM points_transactions WHERE entry_key = ?',
      [entryKey]
    );
    if (existing) {
      continue;
    }

    await client.run(
      `
        INSERT INTO points_transactions (
          id, entry_key, user_id, type, amount, description,
          reference_type, reference_id, balance_after, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        `opening-balance:${profile.user_id}`,
        entryKey,
        profile.user_id,
        'LEDGER_OPENING_BALANCE',
        difference,
        'Opening balance imported from the legacy points projection.',
        'PROFILE_MIGRATION',
        profile.user_id,
        profileBalance,
        JSON.stringify({
          source: 'migration.points_projection',
          previousLedgerBalance
        }),
        new Date().toISOString()
      ]
    );
  }
}

module.exports = {
  id: '202607160004',
  name: 'point_ledger_opening_balances',
  up: importOpeningBalances
};
