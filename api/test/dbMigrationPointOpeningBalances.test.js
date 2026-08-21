const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-point-opening-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration imports the legacy profile projection as one idempotent opening entry', async () => {
  await db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      country_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE profiles (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT NOT NULL UNIQUE,
      referred_by_user_id TEXT,
      referral_count INTEGER NOT NULL DEFAULT 0,
      telegram_chat_id TEXT,
      telegram_username TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE points_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    INSERT INTO users (
      id, email, display_name, country_code, created_at, updated_at
    ) VALUES (
      'legacy-user', 'legacy@example.test', 'Legacy User', 'US',
      '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
    );
    INSERT INTO profiles (
      user_id, name, points, referral_code, created_at, updated_at
    ) VALUES (
      'legacy-user', 'Legacy User', 70, 'LEGACY70',
      '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
    );
    INSERT INTO points_transactions (
      id, user_id, type, amount, description, metadata_json, created_at
    ) VALUES (
      'legacy-credit', 'legacy-user', 'LEGACY_CREDIT', 20, 'Legacy credit', '{}',
      '2025-01-01T00:00:00.000Z'
    );
  `);

  await migrate();
  await migrate();

  const rows = await db.all(`
    SELECT entry_key, type, amount, balance_after, reference_type, reference_id
    FROM points_transactions
    WHERE user_id = 'legacy-user'
    ORDER BY created_at ASC
  `);
  assert.deepEqual(rows, [
    {
      entry_key: 'legacy:legacy-credit',
      type: 'LEGACY_CREDIT',
      amount: 20,
      balance_after: 20,
      reference_type: null,
      reference_id: null
    },
    {
      entry_key: 'point-ledger:opening-balance:legacy-user',
      type: 'LEDGER_OPENING_BALANCE',
      amount: 50,
      balance_after: 70,
      reference_type: 'PROFILE_MIGRATION',
      reference_id: 'legacy-user'
    }
  ]);
});
