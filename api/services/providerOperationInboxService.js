const { transaction } = require('../db');
const { providerOperationInboxRepository } = require('../repositories/providerOperationInboxRepository');

function normalizedPayoutPayload(observation) {
  return {
    providerBatchId: observation.providerBatchId || null,
    providerItemId: observation.providerItemId || null,
    status: observation.providerStatus || null,
    amountCents: Number.isInteger(observation.amountCents) ? observation.amountCents : null,
    currencyCode: observation.currencyCode || null,
    issueCode: observation.issueCode || null,
    reversed: observation.reversed === true
  };
}

function payoutObservationSemanticKey(observation) {
  const resourceIdentity = observation.providerResourceId || observation.payoutId;
  const status = String(observation.providerStatus || 'unknown').toLowerCase();
  return [
    observation.provider,
    'payout',
    observation.source,
    resourceIdentity,
    status
  ].join(':');
}

function createProviderOperationInboxService({
  repository = providerOperationInboxRepository,
  transact = transaction,
  now = () => new Date().toISOString()
} = {}) {
  async function recordPayoutObservation(observation, client) {
    const persist = (targetClient) => repository.createOrGet({
      semanticKey: observation.semanticKey || payoutObservationSemanticKey(observation),
      provider: observation.provider,
      operationType: 'payout.status_observed',
      aggregateType: 'payout',
      aggregateId: observation.payoutId,
      source: observation.source,
      providerResourceType: observation.providerResourceType || null,
      providerResourceId: observation.providerResourceId || null,
      providerStatus: observation.providerStatus || null,
      payload: normalizedPayoutPayload(observation),
      correlationId: observation.correlationId || observation.payoutId,
      receivedAt: observation.receivedAt || now()
    }, targetClient);
    return client ? persist(client) : transact(persist);
  }

  async function consume(id, consumedBy, client) {
    const consumedAt = now();
    const persist = (targetClient) => repository.markConsumed({
      id,
      consumedAt,
      consumedBy
    }, targetClient);
    return client ? persist(client) : transact(persist);
  }

  return {
    consume,
    findUnconsumed: (options) => repository.findUnconsumed(options),
    recordPayoutObservation
  };
}

const providerOperationInboxService = createProviderOperationInboxService();

module.exports = {
  createProviderOperationInboxService,
  normalizedPayoutPayload,
  payoutObservationSemanticKey,
  providerOperationInboxService
};