const { randomUUID } = require('node:crypto');

const { db } = require('../db');
const { parseJson, serializeJson } = require('../utils/records');

function mapOrderEvent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    order_id: row.order_id,
    previousStatus: row.previous_status,
    previous_status: row.previous_status,
    nextStatus: row.next_status,
    next_status: row.next_status,
    eventType: row.event_type,
    event_type: row.event_type,
    actorType: row.actor_type,
    actor_type: row.actor_type,
    actorId: row.actor_id,
    actor_id: row.actor_id,
    reason: row.reason,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

async function create(data, client = db) {
  const id = data.id || randomUUID();
  const now = data.createdAt || new Date().toISOString();

  await client.run(
    `
      INSERT INTO order_events (
        id, order_id, previous_status, next_status, event_type, actor_type,
        actor_id, reason, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      data.orderId,
      data.previousStatus || null,
      data.nextStatus,
      data.eventType,
      data.actorType,
      data.actorId || null,
      data.reason || null,
      serializeJson(data.metadata || {}),
      now
    ]
  );

  return findById(id, client);
}

async function findById(id, client = db) {
  const row = await client.get('SELECT * FROM order_events WHERE id = ?', [id]);
  return mapOrderEvent(row);
}

async function findManyByOrderId(orderId, client = db) {
  const rows = await client.all(
    'SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC',
    [orderId]
  );
  return rows.map(mapOrderEvent);
}

module.exports = {
  orderEventRepository: {
    create,
    findById,
    findManyByOrderId
  }
};
