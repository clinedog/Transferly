const { stripeProviderAdapter } = require('../../adapters/paymentProviders/stripeProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');
const { fixtures } = require('./fixtures');
const schemas = require('./schemas');

module.exports = {
  ...createProviderWorkspaceModule({
    key: 'stripe',
    order: 20,
    adapter: stripeProviderAdapter,
    fixtures
  }),
  schemas
};
