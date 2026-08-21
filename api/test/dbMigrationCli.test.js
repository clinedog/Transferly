const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { after, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-db-migration-cli-'));
const sqliteDatabasePath = path.join(testDir, 'transferly.sqlite');
const apiDirectory = path.resolve(__dirname, '..');
let childSequence = 0;

after(() => {
  fs.rmSync(testDir, { force: true, recursive: true });
});

function migrationEnvironment() {
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    SQLITE_DATABASE_PATH: sqliteDatabasePath
  };

  for (const key of Object.keys(environment)) {
    if (key === 'NODE_TEST_CONTEXT' || key === 'REDIS_URL' || key.startsWith('PAYPAL_')) {
      delete environment[key];
    }
  }

  return environment;
}

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    childSequence += 1;
    const stdoutPath = path.join(testDir, `child-${childSequence}.stdout`);
    const stderrPath = path.join(testDir, `child-${childSequence}.stderr`);
    const stdoutDescriptor = fs.openSync(stdoutPath, 'w');
    const stderrDescriptor = fs.openSync(stderrPath, 'w');
    const child = spawn(process.execPath, [script, ...args], {
      cwd: apiDirectory,
      env: migrationEnvironment(),
      stdio: ['ignore', stdoutDescriptor, stderrDescriptor]
    });
    child.on('error', reject);
    child.on('close', (code) => {
      fs.closeSync(stdoutDescriptor);
      fs.closeSync(stderrDescriptor);
      resolve({
        code,
        stdout: fs.readFileSync(stdoutPath, 'utf8'),
        stderr: fs.readFileSync(stderrPath, 'utf8')
      });
    });
  });
}

test('database-only CLI serializes concurrent migrations without provider configuration', { timeout: 15000 }, async () => {
  const initialStatus = await runNode('db/migrationStatus.js', ['--json']);
  assert.equal(initialStatus.code, 0, initialStatus.stderr);
  assert.ok(JSON.parse(initialStatus.stdout).every((migration) => migration.status === 'pending'));

  const results = await Promise.all([
    runNode('db/migrate.js'),
    runNode('db/migrate.js')
  ]);

  for (const result of results) {
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /SQLite schema is up to date/);
  }

  const appliedCounts = results.map((result) => Number(result.stdout.match(/applied (\d+)/)?.[1]));
  assert.equal(appliedCounts.filter((count) => count > 0).length, 1);
  assert.equal(appliedCounts.filter((count) => count === 0).length, 1);

  const finalStatus = await runNode('db/migrationStatus.js', ['--json']);
  assert.equal(finalStatus.code, 0, finalStatus.stderr);
  assert.ok(JSON.parse(finalStatus.stdout).every((migration) => migration.status === 'applied'));
});
