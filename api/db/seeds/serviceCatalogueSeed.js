const {
  PAYMENT_PROVIDER_SLUGS,
  PRODUCTION_SERVICE_CATALOGUE,
  SERVICE_CATALOGUE_SEED
} = require('../../constants/serviceCatalogue');
const { serviceRepository } = require('../../repositories/serviceRepository');

async function seedDefaultCatalogue(client) {
  const seeded = [];
  const paypalOnlyRelease = process.env.PAYPAL_ONLY_PRODUCTION_MVP !== 'false' && process.env.NODE_ENV !== 'test';
  const catalogue = paypalOnlyRelease ? PRODUCTION_SERVICE_CATALOGUE : SERVICE_CATALOGUE_SEED;

  for (const [index, releaseService] of catalogue.entries()) {
    const record = await serviceRepository.upsert(
      {
        ...releaseService,
        displayOrder: index,
        isPaymentProvider: PAYMENT_PROVIDER_SLUGS.has(releaseService.slug),
        metadata: {
          ...(releaseService.metadata || {}),
          seeded: true,
          production_release: paypalOnlyRelease ? 'paypal-only' : 'full-test-contract'
        }
      },
      client
    );

    seeded.push(record);
  }

  return seeded;
}

module.exports = {
  seedDefaultCatalogue
};
