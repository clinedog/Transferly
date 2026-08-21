const { AppError } = require('../utils/errors');

const POINT_RESERVATION_EXPIRY_SCHEDULER_ID = 'expire-stale-point-reservations';
const POINT_RESERVATION_EXPIRY_JOB_NAME = 'expire-stale-point-reservations';

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(500, 'POINT_RESERVATION_EXPIRY_CONFIG_INVALID', `${fieldName} must be a positive integer.`);
  }
}

function createExpirePointReservationJob({ orderService, batchSize, now = () => new Date() }) {
  if (!orderService?.expireStalePointReservations) {
    throw new AppError(500, 'POINT_RESERVATION_EXPIRY_SERVICE_INVALID', 'Point reservation expiry service is unavailable.');
  }
  assertPositiveInteger(batchSize, 'Point reservation expiry batch size');

  return async function expirePointReservationJob(job = {}) {
    const before = job.data?.before ?? now();
    const limit = job.data?.limit ?? batchSize;
    return orderService.expireStalePointReservations({ before, limit });
  };
}

async function registerPointReservationExpirySchedule(queue, { intervalMs, batchSize }) {
  if (!queue?.upsertJobScheduler) {
    throw new AppError(500, 'POINT_RESERVATION_EXPIRY_QUEUE_INVALID', 'Point reservation expiry queue is unavailable.');
  }
  assertPositiveInteger(intervalMs, 'Point reservation expiry interval');
  assertPositiveInteger(batchSize, 'Point reservation expiry batch size');

  return queue.upsertJobScheduler(
    POINT_RESERVATION_EXPIRY_SCHEDULER_ID,
    { every: intervalMs },
    {
      name: POINT_RESERVATION_EXPIRY_JOB_NAME,
      data: { limit: batchSize }
    }
  );
}

module.exports = {
  POINT_RESERVATION_EXPIRY_JOB_NAME,
  POINT_RESERVATION_EXPIRY_SCHEDULER_ID,
  createExpirePointReservationJob,
  registerPointReservationExpirySchedule
};
