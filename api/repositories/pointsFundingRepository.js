const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapPackage(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    points: row.points,
    priceMinor: row.price_minor,
    price_minor: row.price_minor,
    currency: row.currency,
    minAmountMinor: row.min_amount_minor,
    min_amount_minor: row.min_amount_minor,
    maxAmountMinor: row.max_amount_minor,
    max_amount_minor: row.max_amount_minor,
    bonusPoints: row.bonus_points,
    bonus_points: row.bonus_points,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    sort_order: row.sort_order,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

function mapDestination(row, { revealAccountNumber = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    accountName: row.account_name,
    account_name: row.account_name,
    accountNumber: revealAccountNumber ? row.account_number : maskAccountNumber(row.account_number),
    account_number: revealAccountNumber ? row.account_number : maskAccountNumber(row.account_number),
    accountNumberMasked: maskAccountNumber(row.account_number),
    account_number_masked: maskAccountNumber(row.account_number),
    currency: row.currency,
    instructions: row.instructions,
    active: Boolean(row.active),
    primary: Boolean(row.is_primary),
    is_primary: Boolean(row.is_primary),
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

function mapRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    publicReference: row.public_reference,
    public_reference: row.public_reference,
    userId: row.user_id,
    user_id: row.user_id,
    userName: row.user_name || null,
    user_name: row.user_name || null,
    userEmail: row.user_email || null,
    user_email: row.user_email || null,
    telegramUsername: row.telegram_username || null,
    telegram_username: row.telegram_username || null,
    packageId: row.package_id,
    package_id: row.package_id,
    requestedPoints: row.requested_points,
    requested_points: row.requested_points,
    expectedAmountMinor: row.expected_amount_minor,
    expected_amount_minor: row.expected_amount_minor,
    currency: row.currency,
    paymentMethod: row.payment_method,
    payment_method: row.payment_method,
    paymentDestinationId: row.payment_destination_id,
    payment_destination_id: row.payment_destination_id,
    paymentReference: row.payment_reference,
    payment_reference: row.payment_reference,
    destinationSnapshot: parseJson(row.destination_snapshot_json, {}),
    destination_snapshot: parseJson(row.destination_snapshot_json, {}),
    userTransactionReference: row.user_transaction_reference,
    user_transaction_reference: row.user_transaction_reference,
    userNote: row.user_note,
    user_note: row.user_note,
    evidenceFileId: row.evidence_file_id,
    evidence_file_id: row.evidence_file_id,
    evidenceStorageKey: row.evidence_storage_key,
    evidence_storage_key: row.evidence_storage_key,
    evidenceMetadata: parseJson(row.evidence_metadata_json, {}),
    evidence_metadata: parseJson(row.evidence_metadata_json, {}),
    status: row.status,
    riskStatus: row.risk_status,
    risk_status: row.risk_status,
    possibleDuplicate: Boolean(row.possible_duplicate),
    possible_duplicate: Boolean(row.possible_duplicate),
    submittedAt: row.submitted_at,
    submitted_at: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewed_at: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewed_by: row.reviewed_by,
    assignedTo: row.assigned_to,
    assigned_to: row.assigned_to,
    assignedBy: row.assigned_by,
    assigned_by: row.assigned_by,
    assignedAt: row.assigned_at,
    assigned_at: row.assigned_at,
    rejectionReason: row.rejection_reason,
    rejection_reason: row.rejection_reason,
    adminNote: row.admin_note,
    admin_note: row.admin_note,
    creditedAt: row.credited_at,
    credited_at: row.credited_at,
    ledgerEntryKey: row.ledger_entry_key,
    ledger_entry_key: row.ledger_entry_key,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

function maskAccountNumber(value) {
  const normalized = String(value || '').replace(/\s+/g, '');
  if (!normalized) return '';
  const suffix = normalized.slice(-4);
  return `${'*'.repeat(Math.max(normalized.length - 4, 4))}${suffix}`;
}

async function listActivePackages(client = db) {
  const rows = await client.all(
    'SELECT * FROM points_funding_packages WHERE active = 1 ORDER BY sort_order ASC, points ASC'
  );
  return rows.map(mapPackage);
}

async function findPackageById(packageId, client = db) {
  const row = await client.get('SELECT * FROM points_funding_packages WHERE id = ?', [packageId]);
  return mapPackage(row);
}

async function findPrimaryDestination(currency = 'NGN', client = db) {
  const row = await client.get(
    `
      SELECT * FROM payment_destinations
      WHERE active = 1 AND upper(currency) = upper(?)
      ORDER BY is_primary DESC, created_at DESC
      LIMIT 1
    `,
    [currency]
  );
  return mapDestination(row, { revealAccountNumber: true });
}

async function findDestinationById(destinationId, client = db) {
  const row = await client.get('SELECT * FROM payment_destinations WHERE id = ?', [destinationId]);
  return mapDestination(row, { revealAccountNumber: true });
}

async function createRequest(data, client = db) {
  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();
  await client.run(
    `
      INSERT INTO points_funding_requests (
        id, public_reference, user_id, package_id, requested_points, expected_amount_minor,
        currency, payment_method, payment_destination_id, payment_reference,
        destination_snapshot_json, user_transaction_reference, user_note, evidence_file_id,
        evidence_storage_key, evidence_metadata_json, status, risk_status, possible_duplicate,
        submitted_at, reviewed_at, reviewed_by, assigned_to, assigned_by, assigned_at,
        rejection_reason, admin_note, credited_at,
        ledger_entry_key, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.publicReference,
      data.userId,
      data.packageId,
      data.requestedPoints,
      data.expectedAmountMinor,
      data.currency,
      data.paymentMethod,
      data.paymentDestinationId,
      data.paymentReference,
      serializeJson(data.destinationSnapshot || {}),
      data.userTransactionReference || null,
      data.userNote || null,
      data.evidenceFileId || null,
      data.evidenceStorageKey || null,
      serializeJson(data.evidenceMetadata || {}),
      data.status,
      data.riskStatus || 'NORMAL',
      data.possibleDuplicate ? 1 : 0,
      data.submittedAt || null,
      data.reviewedAt || null,
      data.reviewedBy || null,
      data.assignedTo || null,
      data.assignedBy || null,
      data.assignedAt || null,
      data.rejectionReason || null,
      data.adminNote || null,
      data.creditedAt || null,
      data.ledgerEntryKey || null,
      serializeJson(data.metadata || {}),
      now,
      now
    ]
  );
  return findRequestById(id, client);
}

async function findRequestById(id, client = db) {
  const row = await client.get(
    `
      SELECT r.*, u.email AS user_email, COALESCE(p.name, u.display_name) AS user_name, p.telegram_username
      FROM points_funding_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN profiles p ON p.user_id = r.user_id
      WHERE r.id = ?
    `,
    [id]
  );
  return mapRequest(row);
}

async function findRequestByReference(reference, client = db) {
  const row = await client.get(
    `
      SELECT r.*, u.email AS user_email, COALESCE(p.name, u.display_name) AS user_name, p.telegram_username
      FROM points_funding_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN profiles p ON p.user_id = r.user_id
      WHERE r.public_reference = ? OR r.payment_reference = ?
    `,
    [reference, reference]
  );
  return mapRequest(row);
}

async function listUserRequests(userId, options = {}, client = db) {
  const limit = Math.min(Number(options.limit || 50), 100);
  const rows = await client.all(
    'SELECT * FROM points_funding_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows.map(mapRequest);
}

async function listRequests(filters = {}, client = db) {
  const where = [];
  const params = [];
  if (filters.status) {
    where.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.userId) {
    where.push('r.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.query) {
    where.push('(r.public_reference LIKE ? OR r.payment_reference LIKE ? OR r.user_transaction_reference LIKE ? OR u.email LIKE ? OR p.name LIKE ? OR p.telegram_username LIKE ?)');
    const term = `%${filters.query}%`;
    params.push(term, term, term, term, term, term);
  }
  const limit = Math.min(Number(filters.limit || 100), 250);
  const rows = await client.all(
    `
      SELECT r.*, u.email AS user_email, COALESCE(p.name, u.display_name) AS user_name, p.telegram_username
      FROM points_funding_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN profiles p ON p.user_id = r.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY r.created_at DESC
      LIMIT ?
    `,
    [...params, limit]
  );
  return rows.map(mapRequest);
}

async function updateRequest(id, updates, client = db) {
  const existing = await findRequestById(id, client);
  if (!existing) return null;
  const now = new Date().toISOString();
  await client.run(
    `
      UPDATE points_funding_requests
      SET
        user_transaction_reference = ?, user_note = ?, evidence_file_id = ?, evidence_storage_key = ?,
        evidence_metadata_json = ?, status = ?, risk_status = ?, possible_duplicate = ?, submitted_at = ?,
        reviewed_at = ?, reviewed_by = ?, assigned_to = ?, assigned_by = ?, assigned_at = ?,
        rejection_reason = ?, admin_note = ?, credited_at = ?,
        ledger_entry_key = ?, metadata_json = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      updates.userTransactionReference ?? existing.userTransactionReference,
      updates.userNote ?? existing.userNote,
      updates.evidenceFileId ?? existing.evidenceFileId,
      updates.evidenceStorageKey ?? existing.evidenceStorageKey,
      serializeJson(updates.evidenceMetadata ?? existing.evidenceMetadata),
      updates.status ?? existing.status,
      updates.riskStatus ?? existing.riskStatus,
      updates.possibleDuplicate ?? existing.possibleDuplicate ? 1 : 0,
      updates.submittedAt ?? existing.submittedAt,
      updates.reviewedAt ?? existing.reviewedAt,
      updates.reviewedBy ?? existing.reviewedBy,
      updates.assignedTo ?? existing.assignedTo,
      updates.assignedBy ?? existing.assignedBy,
      updates.assignedAt ?? existing.assignedAt,
      updates.rejectionReason ?? existing.rejectionReason,
      updates.adminNote ?? existing.adminNote,
      updates.creditedAt ?? existing.creditedAt,
      updates.ledgerEntryKey ?? existing.ledgerEntryKey,
      serializeJson(updates.metadata ?? existing.metadata),
      now,
      id
    ]
  );
  return findRequestById(id, client);
}

async function findDuplicateSignals({ userTransactionReference, expectedAmountMinor, excludeRequestId }, client = db) {
  if (!userTransactionReference) return [];
  const rows = await client.all(
    `
      SELECT * FROM points_funding_requests
      WHERE user_transaction_reference = ?
        AND expected_amount_minor = ?
        AND id <> ?
      ORDER BY created_at DESC
      LIMIT 10
    `,
    [userTransactionReference, expectedAmountMinor, excludeRequestId || '']
  );
  return rows.map(mapRequest);
}

async function countPending(client = db) {
  const row = await client.get(
    `SELECT COUNT(*) AS count FROM points_funding_requests WHERE status IN ('PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION')`
  );
  return Number(row?.count || 0);
}

module.exports = {
  pointsFundingRepository: {
    countPending,
    createRequest,
    findDestinationById,
    findDuplicateSignals,
    findPackageById,
    findPrimaryDestination,
    findRequestById,
    findRequestByReference,
    listActivePackages,
    listRequests,
    listUserRequests,
    maskAccountNumber,
    updateRequest
  }
};