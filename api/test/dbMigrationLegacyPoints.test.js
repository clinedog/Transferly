const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-legacy-points-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'points-migration-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'points-migration-webhook';

const { db, close } = require('../db');
const { migrate } = require('../db/migrate');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration upgrades populated legacy point transactions idempotently', async () => {
  await db.exec(`
    CREATE TABLE points_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    INSERT INTO points_transactions (
      id, user_id, type, amount, description, metadata_json, created_at
    ) VALUES
      ('legacy-row-1', 'legacy-user', 'SIGNUP_BONUS', 50, 'Legacy signup bonus', '{}', '2025-01-01T00:00:00.000Z'),
      ('legacy-row-2', 'legacy-user', 'REFERRAL_BONUS', 20, 'Legacy referral bonus', '{}', '2025-01-02T00:00:00.000Z');
  `);

  await migrate();
  await migrate();

  const columns = await db.all('PRAGMA table_info(points_transactions)');
  const columnNames = new Set(columns.map((column) => column.name));

  assert.equal(columnNames.has('entry_key'), true);
  assert.equal(columnNames.has('reference_type'), true);
  assert.equal(columnNames.has('reference_id'), true);

  const rows = await db.all(`
    SELECT id, entry_key, reference_type, reference_id, balance_after
    FROM points_transactions
    ORDER BY created_at ASC, id ASC
  `);

  assert.deepEqual(rows, [
    {
      id: 'legacy-row-1',
      entry_key: 'legacy:legacy-row-1',
      reference_type: null,
      reference_id: null,
      balance_after: 50
    },
    {
      id: 'legacy-row-2',
      entry_key: 'legacy:legacy-row-2',
      reference_type: null,
      reference_id: null,
      balance_after: 70
    }
  ]);

  const indexes = await db.all('PRAGMA index_list(points_transactions)');
  const entryKeyIndex = indexes.find((index) => index.name === 'idx_points_transactions_entry_key');

  assert.equal(entryKeyIndex?.unique, 1);

  const idempotentEntry = await pointTransactionRepository.create({
    entryKey: 'legacy:legacy-row-1',
    userId: 'legacy-user',
    type: 'SIGNUP_BONUS',
    amount: 50
  });
  assert.equal(idempotentEntry.id, 'legacy-row-1');

  await assert.rejects(
    pointTransactionRepository.create({
      entryKey: 'legacy:legacy-row-1',
      userId: 'legacy-user',
      type: 'SIGNUP_BONUS',
      amount: 500
    }),
    (error) => error?.code === 'POINT_TRANSACTION_ENTRY_CONFLICT' && error?.statusCode === 409
  );

  await assert.rejects(
    db.run(
      "UPDATE points_transactions SET entry_key = 'legacy:legacy-row-1' WHERE id = 'legacy-row-2'"
    ),
    /SQLITE_CONSTRAINT/
  );
});
