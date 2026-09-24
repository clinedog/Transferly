'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { supportTicketService } = require('../services/supportTicketService');

test('support tickets persist transaction context and audit metadata without ticket details', async () => {
  let created;
  let auditEntry;
  const ticket = await supportTicketService.createTicket({
    userId: 'user-1',
    subject: 'Funding is still processing',
    category: 'funding_or_points',
    details: 'My transfer was submitted yesterday.',
    transactionReference: 'TP-123',
    provider: 'transferly',
    operation: 'points funding',
    context: { source: 'wallet', status: 'PROCESSING' },
    repository: { async create(input) { created = input; return { id: 'support-1', ...input }; } },
    audit: { async log(entry) { auditEntry = entry; } }
  });

  assert.equal(ticket.id, 'support-1');
  assert.equal(created.transactionReference, 'TP-123');
  assert.equal(auditEntry.action, 'support_ticket.created');
  assert.deepEqual(auditEntry.metadata, {
    category: 'funding_or_points',
    hasTransactionContext: true,
    provider: 'transferly',
    operation: 'points funding'
  });
  assert.equal(JSON.stringify(auditEntry.metadata).includes('submitted yesterday'), false);
});

test('support ticket lists remain scoped to the authenticated user', async () => {
  let userId;
  const tickets = await supportTicketService.listTickets({
    userId: 'user-1',
    limit: 10,
    repository: { async listForUser(id, options) { userId = id; return [{ id: 'support-1', ...options }]; } }
  });

  assert.equal(userId, 'user-1');
  assert.equal(tickets[0].limit, 10);
});
