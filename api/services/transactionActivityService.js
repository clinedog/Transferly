const { transactionActivityRepository } = require('../repositories/transactionActivityRepository');
const { AppError } = require('../utils/errors');

async function listUserActivity({ userId, query, kind, status, limit, repository = transactionActivityRepository }) {
  return { data: await repository.listForUser(userId, { query, kind, status, limit }) };
}

async function getUserActivityDetail({ userId, activityId, repository = transactionActivityRepository }) {
  const activity = await repository.findForUser(userId, activityId);
  if (!activity) {
    throw new AppError(404, 'TRANSACTION_ACTIVITY_NOT_FOUND', 'Transaction activity not found.');
  }
  return { activity };
}

module.exports = { transactionActivityService: { listUserActivity, getUserActivityDetail } };
