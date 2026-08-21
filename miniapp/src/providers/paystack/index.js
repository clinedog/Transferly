import Overview from './Overview';
import Transactions from './Transactions';

const paystackProvider = {
  id: 'paystack',
  name: 'Paystack',
  components: { Overview, Transactions },
  metadata: {
    displayName: 'Paystack',
    supportedFeatures: ['invoices', 'payouts', 'transactions', 'recipients', 'refunds']
  }
};

export default paystackProvider;
