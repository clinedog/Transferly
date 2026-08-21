const { cashappProviderAdapter } = require('../../adapters/paymentProviders/cashappProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');

module.exports = createProviderWorkspaceModule({
  key: 'cashapp',
  order: 80,
  adapter: cashappProviderAdapter,
  enabledByDefault: false,
  metadata: { category: 'merchant-payments', lifecycle: 'discovery-only' }
});
