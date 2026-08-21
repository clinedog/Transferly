const { outboxEventRepository } = require('../repositories/outboxEventRepository');

const PAYOUT_PROCESS_QUEUE = 'payout-process';
const PAYOUT_PROCESS_JOB = 'process-payout';

function payoutProcessingSemanticKey(payoutId) {
  return `payout:process:${payoutId}`;
}

async function recordPayoutProcessingRequested(payoutId, client) {
  return outboxEventRepository.createOrGet({
    semanticKey: payoutProcessingSemanticKey(payoutId),
    eventType: 'payout.processing.requested',
    aggregateType: 'payout',
    aggregateId: payoutId,
    queueName: PAYOUT_PROCESS_QUEUE,
    jobName: PAYOUT_PROCESS_JOB,
    payload: {
      payoutId,
      correlationId: payoutId
    },
    correlationId: payoutId
  }, client);
}

module.exports = {
  PAYOUT_PROCESS_JOB,
  PAYOUT_PROCESS_QUEUE,
  payoutOutboxService: {
    payoutProcessingSemanticKey,
    recordPayoutProcessingRequested
  }
};