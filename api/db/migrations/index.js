const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_FILE_PATTERN = /^(\d{12})_([a-z0-9_]+)\.js$/;

function checksumFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadMigrations() {
  return fs.readdirSync(__dirname)
    .filter((fileName) => MIGRATION_FILE_PATTERN.test(fileName))
    .sort()
    .map((fileName) => {
      const filePath = path.join(__dirname, fileName);
      const definition = require(filePath);
      const match = fileName.match(MIGRATION_FILE_PATTERN);

      if (!definition || definition.id !== match[1] || definition.name !== match[2]) {
        throw new Error(`Migration ${fileName} must export matching id and name values.`);
      }

      if (typeof definition.up !== 'function') {
        throw new Error(`Migration ${fileName} must export an up(client) function.`);
      }

      return Object.freeze({
        ...definition,
        checksum: checksumFile(filePath),
        fileName
      });
    });
}

module.exports = {
  MIGRATION_FILE_PATTERN,
  loadMigrations
};
