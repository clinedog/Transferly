const {
  PAYMENT_PROVIDER_SLUGS,
  SERVICE_CATALOGUE_SEED
} = require('../../constants/serviceCatalogue');
const { serviceRepository } = require('../../repositories/serviceRepository');

async function seedDefaultCatalogue(client) {
  const seeded = [];

  for (const [index, service] of SERVICE_CATALOGUE_SEED.entries()) {
    const record = await serviceRepository.upsert(
      {
        ...service,
        displayOrder: index,
        isPaymentProvider: PAYMENT_PROVIDER_SLUGS.has(service.slug),
        metadata: {
          ...(service.metadata || {}),
          seeded: true
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
