const config = require('../config');
const {
  AVAILABLE_SERVICE_STATUSES,
  SANDBOX_REQUIRED_MARKINGS
} = require('../constants/serviceCatalogue');
const { seedDefaultCatalogue } = require('../db/seeds/serviceCatalogueSeed');
const { serviceRepository } = require('../repositories/serviceRepository');
const { serviceTemplateRepository } = require('../repositories/serviceTemplateRepository');
const { AppError } = require('../utils/errors');
const { hasPermission, roleRank, ROLE_VALUES } = require('../utils/roles');
const { pointPricingService } = require('./pointPricingService');

const SANDBOX_WARNING = `Sandbox and training outputs must keep these permanent markings: ${SANDBOX_REQUIRED_MARKINGS.join(', ')}.`;

function getServiceWarnings(service) {
  return ['sandbox', 'training'].includes(service.executionMode)
    ? [SANDBOX_WARNING]
    : [];
}

function satisfiesPermission(auth, requirement) {
  const permission = String(requirement || '').trim();
  if (!permission) {
    return false;
  }

  if (permission === 'authenticated') {
    return Boolean(auth?.userId);
  }

  if (permission.startsWith('role:')) {
    const requiredRole = permission.slice('role:'.length).trim().toUpperCase();
    if (!ROLE_VALUES.includes(requiredRole)) {
      return false;
    }

    return roleRank(auth?.role) >= roleRank(requiredRole);
  }

  const normalizedPermission = permission.startsWith('permission:')
    ? permission.slice('permission:'.length).trim()
    : permission;

  return hasPermission(auth, normalizedPermission);
}

function isServiceAvailableToActor(service, auth, options = {}) {
  const enabledFeatureFlags = options.enabledFeatureFlags || config.ENABLED_SERVICE_FEATURE_FLAGS;
  const permissions = Array.isArray(service.permissions) ? service.permissions : null;

  return Boolean(
    auth?.userId &&
    permissions &&
    AVAILABLE_SERVICE_STATUSES.includes(service.status) &&
    (!service.featureFlag || enabledFeatureFlags.has(service.featureFlag)) &&
    permissions.every((permission) => satisfiesPermission(auth, permission))
  );
}

function toServicePayload(service) {
  const warnings = getServiceWarnings(service);
  const pointCost = pointPricingService.getServicePointCost(service);

  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    title: service.title,
    category: service.category,
    description: service.description,
    point_price: pointCost,
    configured_point_price: service.pointPrice,
    default_service_point_charge: config.DEFAULT_SERVICE_POINT_CHARGE,
    points_value_note: config.POINTS_ECONOMY.valueNote,
    badge: service.badge,
    status: service.status,
    availability: {
      available: true,
      status: service.status
    },
    input_schema: service.inputSchema,
    output_type: service.outputType,
    generator_key: service.generatorKey,
    generator_version: service.generatorVersion,
    permissions: service.permissions,
    requires_authenticated_user: true,
    retention_days: service.retentionDays,
    execution_mode: service.executionMode,
    sandbox: service.executionMode !== 'production',
    required_markings: service.executionMode !== 'production' ? SANDBOX_REQUIRED_MARKINGS : [],
    version: service.version,
    warnings,
    receipt_type: service.receipt_type,
    payment_provider: service.is_payment_provider,
    display_order: service.display_order,
    metadata: service.metadata
  };
}

function toTemplatePayload(template) {
  return {
    id: template.id,
    service_id: template.service_id,
    template_key: template.template_key,
    title: template.title,
    description: template.description,
    status: template.status,
    receipt_type: template.receipt_type,
    cost_points: template.cost_points,
    input_schema: template.input_schema,
    renderer_config: template.renderer_config,
    preview_asset: template.preview_asset,
    version: template.version,
    metadata: template.metadata
  };
}

async function listServices(input = {}) {
  const services = await serviceRepository.findMany({ statuses: AVAILABLE_SERVICE_STATUSES });
  return {
    services: services
      .filter((service) => isServiceAvailableToActor(service, input.auth))
      .map(toServicePayload),
    economy: pointPricingService.getEconomySummary()
  };
}

async function findAccessibleService(slug, auth) {
  const service = await serviceRepository.findAvailableBySlug(slug);

  if (!service || !isServiceAvailableToActor(service, auth)) {
    throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  }

  return service;
}

async function getServiceBySlug(slug, input = {}) {
  const service = await findAccessibleService(slug, input.auth);
  const templates = await serviceTemplateRepository.findManyByServiceId(service.id, { status: 'active' });

  return {
    service: toServicePayload(service),
    templates: templates.map(toTemplatePayload),
    economy: pointPricingService.getEconomySummary()
  };
}

async function getServiceTemplates(slug, input = {}) {
  return getServiceBySlug(slug, input);
}

module.exports = {
  catalogueService: {
    seedDefaultCatalogue,
    listServices,
    getServiceBySlug,
    getServiceTemplates,
    isServiceAvailableToActor
  },
  SANDBOX_WARNING
};
