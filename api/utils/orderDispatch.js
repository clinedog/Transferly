const { buildQueueJobId } = require('./queueJobId');

function normalizeDispatchGeneration(value) {
  const generation = Number(value);
  return Number.isSafeInteger(generation) && generation > 0 ? generation : 1;
}

function getOrderDispatchGeneration(order) {
  return normalizeDispatchGeneration(order?.metadata?.dispatchGeneration);
}

function isCurrentOrderDispatch(order, dispatchGeneration) {
  return getOrderDispatchGeneration(order) === normalizeDispatchGeneration(dispatchGeneration);
}

function buildOrderDispatchIdentity(order) {
  const dispatchGeneration = getOrderDispatchGeneration(order);
  const correlationId = buildQueueJobId('order-correlation', order.id, 'dispatch', dispatchGeneration);

  return {
    dispatchGeneration,
    correlationId,
    jobId: buildQueueJobId('order', order.id, 'dispatch', dispatchGeneration),
    payload: {
      orderId: order.id,
      dispatchGeneration,
      attempt: 1,
      correlationId
    }
  };
}

module.exports = {
  buildOrderDispatchIdentity,
  getOrderDispatchGeneration,
  isCurrentOrderDispatch,
  normalizeDispatchGeneration
};
