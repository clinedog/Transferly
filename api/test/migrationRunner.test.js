const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-migration-runner-'));
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');

const { loadMigrations } = require('../db/migrations');
const { close } = require('../db');
const {
  validateMigrationDefinitions,
  verifyAppliedMigrations
} = require('../db/migrationRunner');

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

function definition(overrides = {}) {
  return {
    id: '202607160001',
    name: 'example_migration',
    checksum: 'a'.repeat(64),
    fileName: '202607160001_example_migration.js',
    async up() {},
    ...overrides
  };
}

test('loads immutable migration definitions in identifier order', () => {
  const migrations = loadMigrations();
  const ids = migrations.map((migration) => migration.id);

  assert.deepEqual(ids, [...ids].sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(migrations.length > 0);
  assert.ok(migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.checksum)));
  assert.doesNotThrow(() => validateMigrationDefinitions(migrations));
});

test('rejects duplicate and out-of-order migration identifiers', () => {
  assert.throws(
    () => validateMigrationDefinitions([definition(), definition()]),
    (error) => error.code === 'MIGRATION_DEFINITION_INVALID'
  );

  assert.throws(
    () => validateMigrationDefinitions([
      definition({ id: '202607160002' }),
      definition({ id: '202607160001' })
    ]),
    (error) => error.code === 'MIGRATION_DEFINITION_INVALID'
  );
});

test('fails closed when applied migration history is missing or has changed', () => {
  const migrations = [definition()];

  assert.throws(
    () => verifyAppliedMigrations(migrations, [{
      id: '202607150001',
      name: 'removed_migration',
      checksum: 'b'.repeat(64)
    }]),
    (error) => error.code === 'MIGRATION_HISTORY_DIVERGED'
  );

  assert.throws(
    () => verifyAppliedMigrations(migrations, [{
      id: migrations[0].id,
      name: migrations[0].name,
      checksum: 'b'.repeat(64)
    }]),
    (error) => error.code === 'MIGRATION_CHECKSUM_MISMATCH'
  );
});
