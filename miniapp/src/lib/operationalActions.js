export function countPendingOrders(topUpOrders = []) {
  if (!Array.isArray(topUpOrders)) {
    return 0;
  }

  return topUpOrders.filter((order) => {
    const status = String(order?.status || '').toLowerCase();
    return !['completed', 'released', 'success', 'successful'].includes(status);
  }).length;
}

export function buildRecommendedActions({ paymentIssues = [], topUpOrders = [] } = {}) {
  const issueCount = Array.isArray(paymentIssues) ? paymentIssues.length : 0;
  const pendingOrders = countPendingOrders(topUpOrders);
  const actions = [];

  if (issueCount > 0) {
    actions.push({
      title: `Review ${issueCount} alert${issueCount === 1 ? '' : 's'}`,
      description: 'Open provider ops and triage the current issue before it blocks the next order.',
      to: '/miniapp/ops',
      tone: 'warn'
    });
  }

  if (pendingOrders > 0) {
    actions.push({
      title: `Clear ${pendingOrders} pending order${pendingOrders === 1 ? '' : 's'}`,
      description: 'Check the latest funding flow and confirm the next action needed for the queue.',
      to: '/miniapp/orders',
      tone: 'accent'
    });
  }

  if (actions.length < 2) {
    actions.push({
      title: 'Open support desk',
      description: 'Attach the current wallet and provider context before requesting a follow-up.',
      to: '/miniapp/support?from=home',
      tone: 'neutral'
    });
  }

  if (actions.length < 3) {
    actions.push({
      title: 'Buy points',
      description: 'Top up the wallet so your next provider or service action is ready to go.',
      to: '/miniapp/wallet',
      tone: 'primary'
    });
  }

  return actions.slice(0, 3);
}
