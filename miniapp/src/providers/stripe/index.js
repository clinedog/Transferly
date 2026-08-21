import Overview from './Overview';
import Transactions from './Transactions';

const stripeProvider = {
  id: 'stripe',
  name: 'Stripe Connect',
  components: { Overview, Transactions },
  metadata: {
    displayName: 'Stripe Connect',
    supportedFeatures: ['invoices', 'payouts', 'transactions', 'disputes', 'refunds']
  }
};

export default stripeProvider;
