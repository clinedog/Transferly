const { paypalProviderAdapter } = require('../../adapters/paymentProviders/paypalProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');
const { fixtures } = require('./fixtures');
const {
  PAYPAL_RESOURCE_DEFINITIONS,
  buildPayPalResourceReadiness,
  listPayPalResourceReadiness
} = require('./readiness');
const statusMapper = require('./statusMapper');
const webhookMapper = require('./webhookMapper');
const schemas = require('./schemas');

module.exports = {
  ...createProviderWorkspaceModule({
    key: 'paypal',
    order: 10,
    adapter: paypalProviderAdapter,
    fixtures
  }),
  PAYPAL_RESOURCE_DEFINITIONS,
  buildPayPalResourceReadiness,
  listPayPalResourceReadiness,
  schemas,
  statusMapper,
  webhookMapper
};
