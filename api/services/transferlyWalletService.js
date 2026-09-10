const { walletRepository } = require('../repositories/walletRepository');
const { AppError } = require('../utils/errors');
const { paymentProviderRegistry } = require('./paymentProviderRegistry');
const { providerBalanceService } = require('./providerBalanceService');

/**
 * Universal Wallet Service
 *
 * Aggregates internal ledger balances (the Transferly Wallet) with external
 * provider balances into a single, unified view. The Transferly Wallet is the
 * authoritative balance; provider balances are supplementary observation data.
 */

/**
 * Get the Transferly Wallet aggregation for a user.
 */
async function getTransferlyWallet(input = {}) {
  const userId = String(input.userId || '').trim();
  if (!userId) {
    throw new AppError(400, 'INVALID_REQUEST', 'userId is required for wallet lookup.');
  }

  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found for user.', { userId });
  }

  const currencyCode = input.currencyCode || wallet.currencyCode;
  if (currencyCode !== wallet.currencyCode) {
    throw new AppError(409, 'WALLET_CURRENCY_MISMATCH', 'Requested currency does not match wallet currency.', {
      requested: currencyCode,
      wallet: wallet.currencyCode
    });
  }

  // Aggregate provider balances (best-effort; failures are reported per-provider)
  const providers = paymentProviderRegistry.listProviders();
  const providerBalances = [];

  for (const provider of providers) {
    try {
      const balance = await providerBalanceService.getProviderBalance({
        provider: provider.key,
        actorId: input.actorId,
        actorType: input.actorType
      });
      providerBalances.push({
        provider: provider.key,
        displayName: provider.name,
        status: balance.status || 'retrieved',
        available: balance.available || [],
        pending: balance.pending || [],
        reserved: balance.reserved || [],
        error: null
      });
    } catch (err) {
      providerBalances.push({
        provider: provider.key,
        displayName: provider.name,
        status: 'error',
        available: [],
        pending: [],
        reserved: [],
        error: err.code || 'BALANCE_RETRIEVAL_FAILED'
      });
    }
  }

  // Build the Transferly Wallet bucket summary
  const transferlyWallet = {
    provider: 'transferly',
    displayName: 'Transferly Wallet',
    currencyCode,
    buckets: {
      available: Number(wallet.availableBalanceCents || 0),
      pending: Number(wallet.pendingBalanceCents || 0),
      frozen: Number(wallet.frozenBalanceCents || 0),
      paid_out: Number(wallet.paidOutBalanceCents || 0),
      incoming: 0,
      outgoing: 0
    },
    total_balance: Number(
      (wallet.availableBalanceCents || 0) +
      (wallet.pendingBalanceCents || 0) +
      (wallet.frozenBalanceCents || 0)
    ),
    provider_balances: providerBalances
  };

  // Compute incoming from provider pending balances
  let incomingCents = 0;
  providerBalances.forEach((pb) => {
    if (pb.pending && Array.isArray(pb.pending)) {
      pb.pending.forEach((entry) => {
        if (entry.currency?.toUpperCase() === currencyCode.toUpperCase()) {
          incomingCents += Number(entry.amount || entry.amount_cents || 0);
        }
      });
    }
  });

  transferlyWallet.buckets.incoming = incomingCents;
  transferlyWallet.buckets.outgoing = 0;
  transferlyWallet.total_balance =
    transferlyWallet.buckets.available +
    transferlyWallet.buckets.pending +
    transferlyWallet.buckets.frozen +
    transferlyWallet.buckets.incoming;

  return transferlyWallet;
}

/**
 * Get the wallet balance for a specific provider.
 */
async function getProviderWallet(input = {}) {
  const provider = String(input.provider || '').trim().toLowerCase();
  if (!provider) {
    throw new AppError(400, 'INVALID_REQUEST', 'Provider is required.', { provider });
  }

  const balance = await providerBalanceService.getProviderBalance({
    provider,
    actorId: input.actorId,
    actorType: input.actorType
  });

  return {
    provider,
    displayName: balance.display_name || provider,
    status: balance.status || 'retrieved',
    mode: balance.mode || 'live',
    buckets: {
      available: balance.available || [],
      pending: balance.pending || [],
      reserved: balance.reserved || [],
      incoming: balance.instant_available || [],
      outgoing: balance.connect_reserved || []
    },
    raw: balance
  };
}

/**
 * Compute the total spendable balance for a user.
 */
async function getSpendableBalance(userId, currencyCode) {
  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found for user.', { userId });
  }

  if (currencyCode !== wallet.currencyCode) {
    throw new AppError(409, 'WALLET_CURRENCY_MISMATCH', 'Currency mismatch.', {
      requested: currencyCode,
      wallet: wallet.currencyCode
    });
  }

  return Number(wallet.availableBalanceCents || 0);
}

module.exports = {
  transferlyWalletService: {
    getTransferlyWallet,
    getProviderWallet,
    getSpendableBalance
  }
};