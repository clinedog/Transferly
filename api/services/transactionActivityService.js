const { transactionActivityRepository } = require('../repositories/transactionActivityRepository');

async function listUserActivity({ userId, query, kind, status, limit, repository = transactionActivityRepository }) {
  return { data: await repository.listForUser(userId, { query, kind, status, limit }) };
}

module.exports = { transactionActivityService: { listUserActivity } };
