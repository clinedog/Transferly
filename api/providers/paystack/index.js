const { paystackProviderAdapter } = require('../../adapters/paymentProviders/paystackProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');
const { fixtures } = require('./fixtures');

module.exports = createProviderWorkspaceModule({
  key: 'paystack',
  order: 40,
  adapter: paystackProviderAdapter,
  fixtures
});
