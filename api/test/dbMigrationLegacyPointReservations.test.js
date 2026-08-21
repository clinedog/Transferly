const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-legacy-point-reservation-migration-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.PAYPAL_CLIENT_ID = 'point-reservation-migration-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'point-reservation-migration-webhook';

const { close, db } = require('../db');
const { migrate } = require('../db/migrate');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

test('migration adds nullable expiry fields without expiring legacy reservations', async () => {
  await db.exec(`
    CREATE TABLE point_reservations (
      id TEXT PRIMARY KEY,
      reservation_key TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      amount INTEGER NOT NULL,
      available_points_before INTEGER NOT NULL,
      available_points_after INTEGER NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT,
      metadata_json TEXT,
      reserved_at TEXT NOT NULL,
      committed_at TEXT,
      released_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO point_reservations (
      id, reservation_key, user_id, status, amount,
      available_points_before, available_points_after,
      reference_type, reference_id, metadata_json,
      reserved_at, committed_at, released_at, created_at, updated_at
    ) VALUES (
      'legacy-reservation', 'legacy:reservation', 'legacy-user', 'RESERVED', 5,
      10, 5, 'ORDER', 'legacy-order', '{}',
      '2025-01-01T00:00:00.000Z', NULL, NULL,
      '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
    );
  `);

  await migrate();
  await migrate();

  const columns = new Set(
    (await db.all('PRAGMA table_info(point_reservations)')).map((column) => column.name)
  );
  assert.equal(columns.has('expires_at'), true);
  assert.equal(columns.has('expired_at'), true);

  const legacyReservation = await db.get(
    'SELECT status, expires_at, expired_at FROM point_reservations WHERE id = ?',
    ['legacy-reservation']
  );
  assert.deepEqual(legacyReservation, {
    status: 'RESERVED',
    expires_at: null,
    expired_at: null
  });

  const expiryIndex = await db.get(
    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_point_reservations_expiry'"
  );
  assert.match(expiryIndex.sql, /status, expires_at/i);
});
