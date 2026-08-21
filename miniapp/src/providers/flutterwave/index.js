import Overview from './Overview';
import Transactions from './Transactions';

const flutterwaveProvider = {
  id: 'flutterwave',
  name: 'Flutterwave',
  components: { Overview, Transactions },
  metadata: {
    displayName: 'Flutterwave',
    supportedFeatures: ['invoices', 'payouts', 'transactions', 'recipients', 'quotes']
  }
};

export default flutterwaveProvider;
