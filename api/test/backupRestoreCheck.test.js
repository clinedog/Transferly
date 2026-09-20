'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3').verbose();

const { backupDatabase, verifyDatabase, pruneBackupManifests } = require('../scripts/backupRestoreCheck');

function createDatabase(filePath) {
  const database = new sqlite3.Database(filePath);
  return new Promise((resolve, reject) => {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO accounts (name) VALUES ('backup-fixture');
    `, (error) => {
      database.close((closeError) => {
        if (error || closeError) reject(error || closeError);
        else resolve();
      });
    });
  });
}

test('backup creates a verified, checksummed SQLite copy', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-backup-'));
  const source = path.join(directory, 'source.sqlite');
  const destination = path.join(directory, 'backups', 'verified.sqlite');
  try {
    await createDatabase(source);
    const backup = await backupDatabase(source, destination);
    assert.equal(backup.databasePath, destination);
    assert.equal(backup.evidencePath, `${destination}.manifest.json`);
    const manifest = JSON.parse(fs.readFileSync(backup.evidencePath, 'utf8'));
    assert.equal(manifest.checksum, backup.checksum);
    assert.match(backup.checksum, /^[a-f0-9]{64}$/);
    const verification = await verifyDatabase(destination);
    assert.equal(verification.checksum, backup.checksum);
    assert.equal(verification.evidencePath, backup.evidencePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('verification rejects a tampered backup evidence manifest', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-backup-manifest-'));
  const source = path.join(directory, 'source.sqlite');
  const destination = path.join(directory, 'backup.sqlite');
  try {
    await createDatabase(source);
    const backup = await backupDatabase(source, destination);
    fs.writeFileSync(backup.evidencePath, JSON.stringify({
      databasePath: destination,
      checksum: '0'.repeat(64)
    }));
    await assert.rejects(() => verifyDatabase(destination), /does not match/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('retention pruning removes only older manifest-backed backups', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-backup-retention-'));
  try {
    const backups = [];
    for (const [index, verifiedAt] of ['2026-09-16T00:00:00.000Z', '2026-09-16T01:00:00.000Z', '2026-09-16T02:00:00.000Z'].entries()) {
      const source = path.join(directory, `source-${index}.sqlite`);
      const destination = path.join(directory, `backup-${index}.sqlite`);
      await createDatabase(source);
      const backup = await backupDatabase(source, destination);
      const manifest = JSON.parse(fs.readFileSync(backup.evidencePath, 'utf8'));
      manifest.verifiedAt = verifiedAt;
      fs.writeFileSync(backup.evidencePath, `${JSON.stringify(manifest)}\n`);
      backups.push(backup);
    }
    const result = pruneBackupManifests(directory, 2);
    assert.equal(result.retained, 2);
    assert.equal(result.removed.length, 1);
    assert.equal(fs.existsSync(backups[0].databasePath), false);
    assert.equal(fs.existsSync(backups[1].databasePath), true);
    assert.equal(fs.existsSync(backups[2].databasePath), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
