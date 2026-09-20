'use strict';

const fs = require('node:fs');
const config = require('../config');

function buildRecoveryReadiness() {
  const databasePath = String(config.SQLITE_DATABASE_PATH || '');
  const databaseConfigured = Boolean(databasePath);
  const backupVerifiedAt = process.env.TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT || null;
  const backupLocation = String(process.env.TRANSFERLY_BACKUP_LOCATION || '').trim();
  const backupLocationConfigured = Boolean(backupLocation);
  const backupLastSuccessAt = process.env.TRANSFERLY_BACKUP_LAST_SUCCESS_AT || null;
  const rpo = String(process.env.TRANSFERLY_BACKUP_RPO || '').trim();
  const rto = String(process.env.TRANSFERLY_BACKUP_RTO || '').trim();
  const restoreDate = parseDate(backupVerifiedAt);
  const backupDate = parseDate(backupLastSuccessAt);
  const evidenceMaxAgeHours = Number(process.env.TRANSFERLY_BACKUP_EVIDENCE_MAX_AGE_HOURS || 168);
  const now = Date.now();
  const databaseFilePresent = databaseConfigured && fs.existsSync(databasePath);
  const restoreEvidenceFresh = Boolean(restoreDate && now - restoreDate.getTime() <= evidenceMaxAgeHours * 3600000);
  const backupFresh = Boolean(backupDate && now - backupDate.getTime() <= evidenceMaxAgeHours * 3600000);
  const status = !databaseConfigured || !databaseFilePresent
    ? 'FAIL'
    : !backupLocationConfigured || !rpo || !rto
      ? 'NOT_CONFIGURED'
      : !restoreDate || !backupDate
        ? 'VERIFICATION_REQUIRED'
        : !restoreEvidenceFresh || !backupFresh
          ? 'STALE'
          : 'READY';

  return {
    status,
    database: {
      engine: 'sqlite',
      configured: databaseConfigured,
      pathPresent: databaseConfigured,
      filePresent: databaseFilePresent
    },
    backup: {
      location: backupLocation || null,
      locationConfigured: backupLocationConfigured,
      lastSuccessAt: backupLastSuccessAt,
      fresh: backupFresh,
      restoreVerifiedAt: backupVerifiedAt,
      restoreEvidenceFresh,
      evidence: backupVerifiedAt ? 'operator-supplied restore verification timestamp' : null,
      evidenceMaxAgeHours
    },
    targets: {
      rpo: rpo || 'Not configured',
      rto: rto || 'Not configured'
    },
    nextActions: status === 'READY'
      ? []
      : buildNextActions({ status, backupLocationConfigured, rpo, rto, restoreDate, backupDate, restoreEvidenceFresh, backupFresh })
  };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildNextActions({ status, backupLocationConfigured, rpo, rto, restoreDate, backupDate, restoreEvidenceFresh, backupFresh }) {
  const actions = [];
  if (status === 'FAIL') actions.push('Ensure the configured SQLite database path exists and is readable.');
  if (!backupLocationConfigured) actions.push('Configure an approved backup location and retention policy.');
  if (!rpo || !rto) actions.push('Document RPO and RTO targets for the deployment.');
  if (!backupDate || !backupFresh) actions.push('Record a recent successful database backup timestamp.');
  if (!restoreDate || !restoreEvidenceFresh) actions.push('Perform a controlled restore test and record a recent TRANSFERLY_BACKUP_RESTORE_VERIFIED_AT timestamp.');
  if (status === 'VERIFICATION_REQUIRED' && actions.length === 0) actions.push('Complete controlled backup and restore verification.');
  return actions;
}

module.exports = { recoveryReadinessService: { buildRecoveryReadiness } };
