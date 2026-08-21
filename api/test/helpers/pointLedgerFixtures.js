const { randomUUID } = require('node:crypto');
const { pointLedgerService } = require('../../services/pointLedgerService');
const { POINT_TRANSACTION_TYPE } = require('../../utils/constants');

async function setPointBalance(userId, targetBalance) {
  const normalizedTarget = Number(targetBalance);
  if (!Number.isSafeInteger(normalizedTarget) || normalizedTarget < 0) {
    throw new TypeError('Test point balance must be a non-negative safe integer.');
  }

  let reconciliation = await pointLedgerService.getReconciliation(userId);
  if (!reconciliation.reconciled) {
    await pointLedgerService.reconcileProjectionInTransaction(userId);
    reconciliation = await pointLedgerService.getReconciliation(userId);
  }

  const amount = normalizedTarget - reconciliation.ledgerBalance;
  if (amount === 0) {
    return reconciliation.profile;
  }

  const result = await pointLedgerService.applyEntryInTransaction({
    entryKey: `test-fixture:${userId}:${randomUUID()}`,
    userId,
    type: POINT_TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
    amount,
    description: 'Test fixture point balance',
    referenceType: 'TEST_FIXTURE',
    referenceId: userId,
    metadata: { source: 'test-fixture' }
  });

  return result.profile;
}

module.exports = { setPointBalance };
