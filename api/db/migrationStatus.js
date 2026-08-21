const {
  close,
  initializeDatabase,
  sqliteDatabasePath
} = require('./index');
const { getMigrationStatus } = require('./migrationRunner');

function formatStatus(rows) {
  const lines = rows.map((row) => {
    const appliedAt = row.applied_at || '-';
    return `${row.id}  ${row.status.padEnd(7)}  ${row.name}  ${appliedAt}`;
  });

  return [
    `SQLite migration status for ${sqliteDatabasePath}`,
    'ID            STATUS   NAME  APPLIED AT',
    ...lines
  ].join('\n');
}

async function migrationStatus() {
  await initializeDatabase();
  return getMigrationStatus();
}

if (require.main === module) {
  migrationStatus()
    .then(async (rows) => {
      await close();
      const output = process.argv.includes('--json')
        ? JSON.stringify(rows, null, 2)
        : formatStatus(rows);
      process.stdout.write(`${output}\n`);
    })
    .catch(async (error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      try {
        await close();
      } catch (_closeError) {
        // Ignore close failures during status shutdown.
      }
      process.exit(1);
    });
}

module.exports = {
  formatStatus,
  migrationStatus
};
