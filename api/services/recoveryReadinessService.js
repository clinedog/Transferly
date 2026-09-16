'use strict';

const fs = require('node:fs');
const config = require('../config');

function buildRecoveryReadiness() {
  const databasePath = String(config.SQLITE_DATABASE_PATH || '');
  const databaseConfigured = Boolean(databasePath);
  const backupVerifiedAt = process.env.TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT || null;
  const backupLocationConfigured = Boolean(process.env.TRANSFERLY_BACKUP_LOCATION);
  const status = !databaseConfigured
    ? 'FAIL'
    : !backupLocationConfigured
      ? 'NOT_CONFIGURED'
      : !backupVerifiedAt
        ? 'VERIFICATION_REQUIRED'
        : 'READY';

  return {
    status,
    database: {
      engine: 'sqlite',
      configured: databaseConfigured,
      pathPresent: databaseConfigured,
      filePresent: databaseConfigured && fs.existsSync(databasePath)
    },
    backup: {
      locationConfigured: backupLocationConfigured,
      restoreVerifiedAt: backupVerifiedAt,
      evidence: backupVerifiedAt ? 'operator-supplied restore verification timestamp' : null
    },
    targets: {
      rpo: process.env.TRANSFERLY_BACKUP_RPO || 'Not configured',
      rto: process.env.TRANSFERLY_BACKUP_RTO || 'Not configured'
    },
    nextActions: status === 'READY'
      ? []
      : [
        'Configure an approved backup location and retention policy.',
        'Perform a controlled restore test and record TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT.',
        'Document RPO and RTO targets for the deployment.'
      ]
  };
}

module.exports = { recoveryReadinessService: { buildRecoveryReadiness } };
