const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    providerTransactionId: row.provider_transaction_id,
    provider_transaction_id: row.provider_transaction_id,
    providerReference: row.provider_reference,
    provider_reference: row.provider_reference,
    eventId: row.event_id,
    event_id: row.event_id,
    amountMinor: row.amount_minor,
    amount_minor: row.amount_minor,
    currency: row.currency,
    status: row.status,
    destination: parseJson(row.destination_json, {}),
    sender: parseJson(row.sender_json, {}),
    transactionTime: row.transaction_time,
    transaction_time: row.transaction_time,
    verificationStatus: row.verification_status,
    verification_status: row.verification_status,
    matchStatus: row.match_status,
    match_status: row.match_status,
    riskLevel: row.risk_level,
    risk_level: row.risk_level,
    fundingRequestId: row.funding_request_id,
    funding_request_id: row.funding_request_id,
    matchResult: parseJson(row.match_result_json, {}),
    match_result: parseJson(row.match_result_json, {}),
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at
  };
}

async function findByProviderTransactionId(provider, providerTransactionId, client = db) {
  const row = await client.get(
    'SELECT * FROM payment_provider_transactions WHERE provider = ? AND provider_transaction_id = ?',
    [provider, providerTransactionId]
  );
  return mapTransaction(row);
}

async function findByEventId(provider, eventId, client = db) {
  const row = await client.get(
    'SELECT * FROM payment_provider_transactions WHERE provider = ? AND event_id = ?',
    [provider, eventId]
  );
  return mapTransaction(row);
}

async function createOrGet(data, client = db) {
  const existing = await findByProviderTransactionId(data.provider, data.providerTransactionId, client);
  if (existing) return { transaction: existing, duplicate: true };
  if (data.eventId) {
    const existingEvent = await findByEventId(data.provider, data.eventId, client);
    if (existingEvent) return { transaction: existingEvent, duplicate: true };
  }

  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();
  await client.run(
    `
      INSERT INTO payment_provider_transactions (
        id, provider, provider_transaction_id, provider_reference, event_id,
        amount_minor, currency, status, destination_json, sender_json, transaction_time,
        verification_status, match_status, risk_level, funding_request_id,
        match_result_json, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.provider,
      data.providerTransactionId,
      data.providerReference || null,
      data.eventId || null,
      data.amountMinor,
      data.currency,
      data.status,
      serializeJson(data.destination || {}),
      serializeJson(data.sender || {}),
      data.transactionTime || null,
      data.verificationStatus,
      data.matchStatus,
      data.riskLevel,
      data.fundingRequestId || null,
      serializeJson(data.matchResult || {}),
      serializeJson(data.metadata || {}),
      now,
      now
    ]
  );
  return { transaction: await findByProviderTransactionId(data.provider, data.providerTransactionId, client), duplicate: false };
}

async function update(id, updates, client = db) {
  const existing = await client.get('SELECT * FROM payment_provider_transactions WHERE id = ?', [id]);
  if (!existing) return null;
  await client.run(
    `
      UPDATE payment_provider_transactions
      SET verification_status = ?, match_status = ?, risk_level = ?, funding_request_id = ?,
          match_result_json = ?, metadata_json = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      updates.verificationStatus ?? existing.verification_status,
      updates.matchStatus ?? existing.match_status,
      updates.riskLevel ?? existing.risk_level,
      updates.fundingRequestId ?? existing.funding_request_id,
      serializeJson(updates.matchResult ?? parseJson(existing.match_result_json, {})),
      serializeJson(updates.metadata ?? parseJson(existing.metadata_json, {})),
      new Date().toISOString(),
      id
    ]
  );
  const row = await client.get('SELECT * FROM payment_provider_transactions WHERE id = ?', [id]);
  return mapTransaction(row);
}

async function list(filters = {}, client = db) {
  const where = [];
  const params = [];
  if (filters.matchStatus) {
    where.push('match_status = ?');
    params.push(filters.matchStatus);
  }
  if (filters.provider) {
    where.push('provider = ?');
    params.push(filters.provider);
  }
  if (filters.query) {
    where.push('(provider_transaction_id LIKE ? OR provider_reference LIKE ? OR funding_request_id LIKE ?)');
    const term = `%${filters.query}%`;
    params.push(term, term, term);
  }
  const limit = Math.min(Number(filters.limit || 100), 250);
  const rows = await client.all(
    `SELECT * FROM payment_provider_transactions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
  return rows.map(mapTransaction);
}

module.exports = {
  paymentProviderTransactionRepository: {
    createOrGet,
    findByEventId,
    findByProviderTransactionId,
    list,
    update
  }
};