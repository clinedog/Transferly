const { randomUUID } = require('node:crypto');
const { db } = require('../db');

function parseContext(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function mapSupportTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    details: row.details || '',
    context: parseContext(row.context_json),
    transactionReference: row.transaction_reference || '',
    provider: row.provider || '',
    operation: row.operation || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const supportTicketRepository = {
  async create({ userId, subject, category, details, context, transactionReference, provider, operation }, client = db) {
    const id = `support:${randomUUID()}`;
    const now = new Date().toISOString();
    await client.run(
      `INSERT INTO support_tickets (
        id, user_id, subject, category, status, priority, details, context_json,
        transaction_reference, provider, operation, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'OPEN', 'NORMAL', ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, subject, category, details, JSON.stringify(context), transactionReference || null, provider || null, operation || null, now, now]
    );
    return mapSupportTicket(await client.get('SELECT * FROM support_tickets WHERE id = ?', [id]));
  },

  async listForUser(userId, { limit = 50 } = {}, client = db) {
    const rows = await client.all(
      'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, Math.min(Math.max(Number(limit) || 50, 1), 100)]
    );
    return rows.map(mapSupportTicket);
  }
};

module.exports = { supportTicketRepository, mapSupportTicket };
