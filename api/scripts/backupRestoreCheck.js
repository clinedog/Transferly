'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

function openDatabase(filePath, mode) {
  return new sqlite3.Database(filePath, mode);
}

function runQuery(database, sql) {
  return new Promise((resolve, reject) => {
    database.all(sql, (error, rows) => (error ? reject(error) : resolve(rows)));
  });
}

function closeDatabase(database) {
  return new Promise((resolve, reject) => database.close((error) => (error ? reject(error) : resolve())));
}

function backupDatabase(sourcePath, destinationPath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SQLite source database does not exist: ${sourcePath}`);
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const source = openDatabase(sourcePath, sqlite3.OPEN_READONLY);
  return new Promise((resolve, reject) => {
    source.backup(destinationPath, async (error) => {
      await closeDatabase(source).catch(() => undefined);
      if (error) {
        reject(error);
        return;
      }
      try {
        const result = await verifyDatabase(destinationPath);
        const evidencePath = `${destinationPath}.manifest.json`;
        const manifest = {
          operation: 'backup',
          sourcePath,
          databasePath: result.databasePath,
          checksum: result.checksum,
          verifiedAt: result.verifiedAt
        };
        fs.writeFileSync(evidencePath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
        resolve({ ...result, evidencePath });
      } catch (verificationError) {
        reject(verificationError);
      }
    });
  });
}

async function verifyDatabase(databasePath) {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`SQLite database does not exist: ${databasePath}`);
  }
  const database = openDatabase(databasePath, sqlite3.OPEN_READONLY);
  try {
    const [integrity, foreignKeys] = await Promise.all([
      runQuery(database, 'PRAGMA integrity_check'),
      runQuery(database, 'PRAGMA foreign_key_check')
    ]);
    if (integrity[0]?.integrity_check !== 'ok') {
      throw new Error(`SQLite integrity check failed for ${databasePath}`);
    }
    if (foreignKeys.length > 0) {
      throw new Error(`SQLite foreign-key check found ${foreignKeys.length} violation(s)`);
    }
    const checksum = await checksumFile(databasePath);
    const evidencePath = `${databasePath}.manifest.json`;
    if (fs.existsSync(evidencePath)) {
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      } catch (error) {
        throw new Error(`Backup evidence manifest is invalid: ${error.message}`);
      }
      if (
        manifest.operation !== 'backup' ||
        manifest.databasePath !== databasePath ||
        manifest.checksum !== checksum
      ) {
        throw new Error(`Backup evidence manifest does not match ${databasePath}`);
      }
    }
    return {
      databasePath,
      checksum,
      verifiedAt: new Date().toISOString(),
      evidencePath: fs.existsSync(evidencePath) ? evidencePath : null
    };
  } finally {
    await closeDatabase(database);
  }
}

function checksumFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function pruneBackupManifests(directoryPath, maxBackups) {
  const limit = Number(maxBackups);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Backup retention count must be a positive integer.');
  }
  const directory = path.resolve(directoryPath);
  const manifests = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.manifest.json'))
    .map((entry) => {
      const manifestPath = path.join(directory, entry.name);
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const databasePath = path.resolve(manifest.databasePath);
        if (path.dirname(databasePath) !== directory || manifest.operation !== 'backup') return null;
        return { manifestPath, databasePath, verifiedAt: new Date(manifest.verifiedAt).getTime() || 0 };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.verifiedAt - left.verifiedAt);

  const removed = [];
  manifests.slice(limit).forEach(({ manifestPath, databasePath }) => {
    fs.rmSync(manifestPath);
    if (fs.existsSync(databasePath)) fs.rmSync(databasePath);
    removed.push(databasePath);
  });
  return { retained: Math.min(limit, manifests.length), removed };
}

async function main() {
  const [, , command, sourcePath, destinationPath] = process.argv;
  if (!['backup', 'verify', 'prune'].includes(command)) {
    throw new Error('Usage: node api/scripts/backupRestoreCheck.js <backup|verify|prune> <source> [destination|retention]');
  }
  if (command === 'backup') {
    if (!destinationPath) throw new Error('Backup destination is required.');
    const result = await backupDatabase(path.resolve(sourcePath), path.resolve(destinationPath));
    console.log(JSON.stringify({ operation: 'backup', ...result }));
  } else if (command === 'verify') {
    const result = await verifyDatabase(path.resolve(sourcePath));
    console.log(JSON.stringify({ operation: 'verify', ...result }));
  } else {
    if (!destinationPath) throw new Error('Backup retention count is required.');
    const result = pruneBackupManifests(path.resolve(sourcePath), Number(destinationPath));
    console.log(JSON.stringify({ operation: 'prune', ...result }));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Backup/restore check failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { backupDatabase, verifyDatabase, checksumFile, pruneBackupManifests };
