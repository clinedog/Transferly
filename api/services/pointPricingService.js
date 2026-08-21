const config = require('../config');
const { AppError } = require('../utils/errors');

function normalizePointCost(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new AppError(500, 'INVALID_SERVICE_POINT_COST', 'Service point cost must be a non-negative integer.');
  }
  return normalized;
}

function readOverride(service) {
  const configuredOverride =
    service?.configuration?.pointPriceOverride ??
    service?.configuration?.point_price_override ??
    service?.configuration?.costPointsOverride ??
    service?.configuration?.cost_points_override;
  if (configuredOverride !== undefined && configuredOverride !== null) {
    return normalizePointCost(configuredOverride);
  }

  const legacyMetadataCost =
    service?.metadata?.pointCost ??
    service?.metadata?.point_cost ??
    service?.metadata?.cost_points;
  if (legacyMetadataCost !== undefined && legacyMetadataCost !== null && Number(legacyMetadataCost) > 0) {
    return normalizePointCost(legacyMetadataCost);
  }

  return null;
}

function getServicePointCost(service) {
  const override = readOverride(service);
  if (override !== null) {
    return override;
  }

  if (Number(service?.pointPrice || 0) > 0) {
    return normalizePointCost(service.pointPrice);
  }

  return normalizePointCost(config.DEFAULT_SERVICE_POINT_CHARGE);
}

function getEconomySummary() {
  return {
    points_to_naira_rate: config.POINTS_TO_NAIRA_RATE,
    default_service_point_charge: config.DEFAULT_SERVICE_POINT_CHARGE,
    value_note: config.POINTS_ECONOMY?.valueNote || '1 Transferly Point = ₦1'
  };
}

module.exports = {
  pointPricingService: {
    getEconomySummary,
    getServicePointCost
  }
};