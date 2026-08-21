const { wiseProviderAdapter } = require('../../adapters/paymentProviders/wiseProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');
const { fixtures } = require('./fixtures');

module.exports = createProviderWorkspaceModule({
  key: 'wise',
  order: 30,
  adapter: wiseProviderAdapter,
  fixtures
});
