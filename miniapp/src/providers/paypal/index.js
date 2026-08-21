import Overview from './Overview';
import Transactions from './Transactions';

const paypalProvider = {
  id: 'paypal',
  name: 'PayPal',
  components: {
    Overview,
    Transactions
  },
  metadata: {
    displayName: 'PayPal',
    supportedFeatures: ['invoices', 'payouts', 'transactions']
  }
};

export default paypalProvider;
