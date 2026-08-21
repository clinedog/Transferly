const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-legacy-users-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'users-migration-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'users-migration-webhook';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { userRepository } = require('../repositories/userRepository');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration adds and enforces account status without reactivating malformed values', async () => {
  await db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      country_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO users (
      id, email, display_name, country_code, created_at, updated_at
    ) VALUES (
      'legacy-user', 'legacy@example.test', 'Legacy User', 'US',
      '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
    );
  `);

  await migrate();
  await migrate();

  const columns = await db.all('PRAGMA table_info(users)');
  const statusColumn = columns.find((column) => column.name === 'status');
  assert.ok(statusColumn);
  assert.equal(statusColumn.notnull, 1);
  assert.equal(statusColumn.dflt_value, "'active'");

  const user = await userRepository.findById('legacy-user');
  assert.equal(user.status, 'active');

  await db.run("UPDATE users SET status = 'suspended' WHERE id = 'legacy-user'");
  assert.equal((await userRepository.findById('legacy-user')).status, 'suspended');

  await assert.rejects(
    db.run("UPDATE users SET status = 'unknown' WHERE id = 'legacy-user'"),
    /users\.status is invalid/
  );
  assert.equal((await userRepository.findById('legacy-user')).status, 'suspended');
});
