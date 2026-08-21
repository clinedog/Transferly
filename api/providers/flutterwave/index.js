const { flutterwaveProviderAdapter } = require('../../adapters/paymentProviders/flutterwaveProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');
const { fixtures } = require('./fixtures');

module.exports = createProviderWorkspaceModule({
  key: 'flutterwave',
  order: 50,
  adapter: flutterwaveProviderAdapter,
  fixtures
});
