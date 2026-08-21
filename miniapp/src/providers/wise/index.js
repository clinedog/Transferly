import Overview from './Overview';
import Transactions from './Transactions';

const wiseProvider = {
  id: 'wise',
  name: 'Wise Platform',
  components: { Overview, Transactions },
  metadata: {
    displayName: 'Wise Platform',
    supportedFeatures: ['payouts', 'transfers', 'balance', 'quotes']
  }
};

export default wiseProvider;
