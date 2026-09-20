const assert = require('node:assert/strict');
const test = require('node:test');

const { recoveryReadinessService } = require('../services/recoveryReadinessService');
const config = require('../config');

const now = Date.now();
const recent = new Date(now - 60 * 60 * 1000).toISOString();
const stale = new Date(now - 200 * 60 * 60 * 1000).toISOString();

function withEnvironment(values, callback) {
  const previous = {};
  Object.keys(values).forEach((key) => {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  });
  try {
    return callback();
  } finally {
    Object.keys(values).forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

test('recovery readiness requires backup location, targets, and current evidence', () => {
  withEnvironment({
    TRANSFERLY_BACKUP_LOCATION: 's3://transferly/backups',
    TRANSFERLY_BACKUP_LAST_SUCCESS_AT: recent,
    TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT: recent,
    TRANSFERLY_BACKUP_RPO: '15m',
    TRANSFERLY_BACKUP_RTO: '1h'
  }, () => {
    const report = recoveryReadinessService.buildRecoveryReadiness();
    assert.equal(report.status, 'READY');
    assert.equal(report.backup.fresh, true);
    assert.equal(report.backup.restoreEvidenceFresh, true);
    assert.deepEqual(report.nextActions, []);
  });
});

test('recovery readiness reports stale evidence instead of treating it as ready', () => {
  withEnvironment({
    TRANSFERLY_BACKUP_LOCATION: 's3://transferly/backups',
    TRANSFERLY_BACKUP_LAST_SUCCESS_AT: stale,
    TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT: stale,
    TRANSFERLY_BACKUP_RPO: '15m',
    TRANSFERLY_BACKUP_RTO: '1h'
  }, () => {
    const report = recoveryReadinessService.buildRecoveryReadiness();
    assert.equal(report.status, 'STALE');
    assert.ok(report.nextActions.length >= 2);
  });
});

test('recovery readiness identifies missing configuration', () => {
  withEnvironment({
    TRANSFERLY_BACKUP_LOCATION: undefined,
    TRANSFERLY_BACKUP_LAST_SUCCESS_AT: undefined,
    TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT: undefined,
    TRANSFERLY_BACKUP_RPO: undefined,
    TRANSFERLY_BACKUP_RTO: undefined
  }, () => {
    const report = recoveryReadinessService.buildRecoveryReadiness();
    assert.equal(report.status, 'NOT_CONFIGURED');
    assert.ok(report.nextActions.some((action) => action.includes('backup location')));
    assert.ok(report.nextActions.some((action) => action.includes('RPO and RTO')));
  });

  test('recovery readiness fails when the configured database file is absent', () => {
    const previousPath = config.SQLITE_DATABASE_PATH;
    config.SQLITE_DATABASE_PATH = '/tmp/transferly-database-that-does-not-exist.sqlite';
    try {
      withEnvironment({
        TRANSFERLY_BACKUP_LOCATION: 's3://transferly/backups',
        TRANSFERLY_BACKUP_LAST_SUCCESS_AT: recent,
        TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT: recent,
        TRANSFERLY_BACKUP_RPO: '15m',
        TRANSFERLY_BACKUP_RTO: '1h'
      }, () => {
        const report = recoveryReadinessService.buildRecoveryReadiness();
        assert.equal(report.status, 'FAIL');
        assert.equal(report.database.filePresent, false);
        assert.ok(report.nextActions.some((action) => action.includes('database path')));
      });
    } finally {
      config.SQLITE_DATABASE_PATH = previousPath;
    }
  });
});
