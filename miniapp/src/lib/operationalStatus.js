export function countPendingOrders(topUpOrders = []) {
  if (!Array.isArray(topUpOrders)) {
    return 0;
  }

  return topUpOrders.filter((order) => {
    const status = String(order?.status || '').toLowerCase();
    return !['completed', 'released', 'success', 'successful'].includes(status);
  }).length;
}

export function summarizeOperationalStatus({ paymentIssues = [], topUpOrders = [] } = {}) {
  const issueCount = Array.isArray(paymentIssues) ? paymentIssues.length : 0;
  const pendingOrders = countPendingOrders(topUpOrders);

  if (issueCount || pendingOrders) {
    return {
      label: 'Needs attention',
      tone: 'amber',
      detail: `${issueCount || 0} issue${issueCount === 1 ? '' : 's'} · ${pendingOrders} order${pendingOrders === 1 ? '' : 's'} in motion`
    };
  }

  return {
    label: 'Operationally stable',
    tone: 'emerald',
    detail: 'No blocking alerts or order follow-ups'
  };
}
