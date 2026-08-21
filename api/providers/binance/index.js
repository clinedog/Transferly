const { binanceProviderAdapter } = require('../../adapters/paymentProviders/binanceProviderAdapter');
const { createProviderWorkspaceModule } = require('../shared/createProviderWorkspaceModule');

module.exports = createProviderWorkspaceModule({
  key: 'binance',
  order: 70,
  adapter: binanceProviderAdapter,
  enabledByDefault: false,
  metadata: { category: 'digital-assets', lifecycle: 'discovery-only' }
});
