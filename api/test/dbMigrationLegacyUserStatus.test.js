const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-legacy-user-status-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration normalizes legacy account statuses once and installs closed status constraints', async () => {
  await db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      country_code TEXT,
      status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO users (
      id, email, display_name, country_code, status, created_at, updated_at
    ) VALUES
      (
        'legacy-suspended', 'suspended@example.test', 'Suspended User', 'US',
        ' SUSPENDED ', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
      ),
      (
        'legacy-unknown', 'unknown@example.test', 'Unknown User', 'US',
        'unknown', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
      );
  `);

  const result = await migrate();
  assert.ok(result.applied.some((migration) => migration.name === 'normalize_user_account_status'));

  const users = await db.all('SELECT id, status FROM users ORDER BY id ASC');
  assert.deepEqual(users, [
    { id: 'legacy-suspended', status: 'suspended' },
    { id: 'legacy-unknown', status: 'restricted' }
  ]);

  await assert.rejects(
    db.run("UPDATE users SET status = 'unknown' WHERE id = 'legacy-suspended'"),
    /users\.status is invalid/
  );
});
