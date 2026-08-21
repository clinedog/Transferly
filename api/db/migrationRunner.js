const { db, transaction } = require('./index');
const { loadMigrations } = require('./migrations');

function migrationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateMigrationDefinitions(migrations) {
  const ids = new Set();
  let previousId = null;

  for (const migration of migrations) {
    if (!/^\d{12}$/.test(migration.id)) {
      throw migrationError(
        'MIGRATION_DEFINITION_INVALID',
        `Migration id ${migration.id} must contain exactly 12 digits.`
      );
    }

    if (ids.has(migration.id)) {
      throw migrationError(
        'MIGRATION_DEFINITION_INVALID',
        `Migration id ${migration.id} is duplicated.`
      );
    }

    if (previousId && migration.id <= previousId) {
      throw migrationError(
        'MIGRATION_DEFINITION_INVALID',
        'Migrations must be strictly ordered by id.'
      );
    }

    if (!migration.name || !migration.checksum || typeof migration.up !== 'function') {
      throw migrationError(
        'MIGRATION_DEFINITION_INVALID',
        `Migration ${migration.id} is missing a name, checksum, or up function.`
      );
    }

    ids.add(migration.id);
    previousId = migration.id;
  }
}

async function readAppliedMigrations(client) {
  const table = await client.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
  );

  if (!table) {
    return [];
  }

  return client.all(
    'SELECT id, name, checksum, applied_at FROM schema_migrations ORDER BY id ASC'
  );
}

function verifyAppliedMigrations(migrations, appliedMigrations) {
  const definitions = new Map(migrations.map((migration) => [migration.id, migration]));

  for (const applied of appliedMigrations) {
    const definition = definitions.get(applied.id);
    if (!definition) {
      throw migrationError(
        'MIGRATION_HISTORY_DIVERGED',
        `Applied migration ${applied.id} is missing from the current migration set.`
      );
    }

    if (definition.name !== applied.name || definition.checksum !== applied.checksum) {
      throw migrationError(
        'MIGRATION_CHECKSUM_MISMATCH',
        `Applied migration ${applied.id} no longer matches ${definition.fileName || definition.name}.`
      );
    }
  }
}

async function applyWithClient(client, migrations) {
  validateMigrationDefinitions(migrations);
  const appliedMigrations = await readAppliedMigrations(client);
  verifyAppliedMigrations(migrations, appliedMigrations);
  const appliedIds = new Set(appliedMigrations.map((migration) => migration.id));
  const appliedNow = [];

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    await migration.up(client);
    const appliedAt = new Date().toISOString();
    await client.run(
      `
        INSERT INTO schema_migrations (id, name, checksum, applied_at)
        VALUES (?, ?, ?, ?)
      `,
      [migration.id, migration.name, migration.checksum, appliedAt]
    );
    appliedNow.push({
      id: migration.id,
      name: migration.name,
      checksum: migration.checksum,
      applied_at: appliedAt
    });
  }

  return {
    applied: appliedNow,
    total: migrations.length
  };
}

async function runPendingMigrations(options = {}) {
  const migrations = options.migrations || loadMigrations();
  if (options.client) {
    return applyWithClient(options.client, migrations);
  }

  return transaction((client) => applyWithClient(client, migrations));
}

async function getMigrationStatus(options = {}) {
  const client = options.client || db;
  const migrations = options.migrations || loadMigrations();
  validateMigrationDefinitions(migrations);
  const appliedMigrations = await readAppliedMigrations(client);
  verifyAppliedMigrations(migrations, appliedMigrations);
  const appliedById = new Map(appliedMigrations.map((migration) => [migration.id, migration]));

  return migrations.map((migration) => ({
    id: migration.id,
    name: migration.name,
    checksum: migration.checksum,
    status: appliedById.has(migration.id) ? 'applied' : 'pending',
    applied_at: appliedById.get(migration.id)?.applied_at || null
  }));
}

module.exports = {
  getMigrationStatus,
  runPendingMigrations,
  validateMigrationDefinitions,
  verifyAppliedMigrations
};
