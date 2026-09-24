const { auditLogService } = require('./auditLogService');
const { supportTicketRepository } = require('../repositories/supportTicketRepository');

async function createTicket({ userId, subject, category, details, context, transactionReference, provider, operation, repository = supportTicketRepository, audit = auditLogService }) {
  const ticket = await repository.create({ userId, subject, category, details, context, transactionReference, provider, operation });
  await audit.log({
    actorType: 'user',
    actorId: userId,
    action: 'support_ticket.created',
    entityType: 'support_ticket',
    entityId: ticket.id,
    metadata: {
      category: ticket.category,
      hasTransactionContext: Boolean(ticket.transactionReference),
      provider: ticket.provider || undefined,
      operation: ticket.operation || undefined
    }
  });
  return ticket;
}

async function listTickets({ userId, limit, repository = supportTicketRepository }) {
  return repository.listForUser(userId, { limit });
}

module.exports = { supportTicketService: { createTicket, listTickets } };
