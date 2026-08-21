import Overview from './Overview';
import Transactions from './Transactions';

const cryptoProvider = {
  id: 'crypto',
  name: 'Crypto Commerce',
  components: { Overview, Transactions },
  metadata: {
    displayName: 'Crypto Commerce',
    supportedFeatures: ['invoices', 'charges', 'crypto_payments']
  }
};

export default cryptoProvider;
