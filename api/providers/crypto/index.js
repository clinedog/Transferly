const { cryptoProviderAdapter } = require('../../adapters/paymentProviders/cryptoProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');
const { fixtures } = require('./fixtures');

module.exports = createProviderWorkspaceModule({
  key: 'crypto',
  order: 60,
  adapter: cryptoProviderAdapter,
  fixtures
});
