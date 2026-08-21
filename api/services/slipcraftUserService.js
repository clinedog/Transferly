const { createHash } = require('node:crypto');

const { transaction } = require('../db');
const { pointTransactionRepository } = require('../repositories/pointTransactionRepository');
const { profileRepository } = require('../repositories/profileRepository');
const { receiptRepository } = require('../repositories/receiptRepository');
const { userRepository } = require('../repositories/userRepository');
const { AUDIT_ACTOR_TYPE, POINT_TRANSACTION_TYPE, RISK_DOMAIN } = require('../utils/constants');
const { AppError } = require('../utils/errors');
const { auditLogService } = require('./auditLogService');
const { pointLedgerService } = require('./pointLedgerService');
const { riskEngineService } = require('./riskEngineService');

async function getUserOrThrow(userId, client) {
  const user = await userRepository.findById(userId, client);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  return user;
}

async function getUserWithAuthoritativePoints(userId, client) {
  const user = await getUserOrThrow(userId, client);
  const points = await pointLedgerService.getBalance(userId, client);

  return {
    ...user,
    points,
    profile: user.profile
      ? {
          ...user.profile,
          points
        }
      : null
  };
}

async function getPointsSummary(userId) {
  const user = await getUserOrThrow(userId);
  const points = await pointLedgerService.getBalance(userId);
  const transactions = await pointTransactionRepository.findByUserId(userId);
  const receipts = await receiptRepository.findByUserId(userId);

  return {
    user_id: user.id,
    points,
    referral_count: user.profile?.referralCount ?? 0,
    receipt_count: receipts.length,
    recent_transactions: transactions.slice(0, 10)
  };
}

async function listUsers() {
  const users = await userRepository.findAll();
  const balances = await pointTransactionRepository.getBalancesByUserIds(
    users.map((user) => user.id)
  );

  return users.map((user) => {
    const ledgerBalance = balances.get(user.id) ?? 0;
    const projectionBalance = Number(user.profile?.points || 0);
    const difference = projectionBalance - ledgerBalance;

    return {
      ...user,
      points: ledgerBalance,
      pointBalance: {
        ledgerBalance,
        projectionBalance,
        difference,
        reconciled: difference === 0
      },
      profile: user.profile
        ? {
            ...user.profile,
            points: ledgerBalance
          }
        : null
    };
  });
}

async function updateProfile(userId, input) {
  return transaction(async (client) => {
    const user = await getUserOrThrow(userId, client);
    const name = input.name.trim();

    await userRepository.upsert(
      {
        id: userId,
        email: user.email,
        displayName: name,
        countryCode: user.countryCode
      },
      client
    );
    await profileRepository.updateByUserId(userId, { name }, client);
    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        action: 'slipcraft.user.profile_updated',
        metadata: { name }
      },
      client
    );

    return getUserWithAuthoritativePoints(userId, client);
  });
}

async function deleteAccount(userId) {
  return transaction(async (client) => {
    await getUserOrThrow(userId, client);
    await auditLogService.log(
      {
        actorType: AUDIT_ACTOR_TYPE.USER,
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        action: 'slipcraft.user.account_deleted',
        metadata: {}
      },
      client
    );
    await userRepository.deleteById(userId, client);

    return { user_id: userId, deleted: true };
  });
}

function buildAdminAdjustmentEntryKey(adminActorId, idempotencyKey) {
  if (!idempotencyKey) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }

  const digest = createHash('sha256').update(String(idempotencyKey), 'utf8').digest('hex');
  return `point-ledger:admin-adjustment:${adminActorId}:${digest}`;
}

function hashIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }

  return createHash('sha256').update(String(idempotencyKey), 'utf8').digest('hex');
}

function buildPointReconciliationEntryKey(adminActorId, idempotencyKey) {
  return `point-ledger:projection-reconciliation:${adminActorId}:${hashIdempotencyKey(idempotencyKey)}`;
}

function presentPointReconciliation(reconciliation) {
  return {
    user_id: reconciliation.userId,
    ledger_balance: reconciliation.ledgerBalance,
    projection_balance: reconciliation.projectionBalance,
    difference: reconciliation.difference,
    reconciled: reconciliation.reconciled
  };
}

async function getPointReconciliation(targetUserId) {
  await getUserOrThrow(targetUserId);
  return presentPointReconciliation(await pointLedgerService.getReconciliation(targetUserId));
}

async function reconcilePointProjection({ targetUserId, reason, adminActorId, idempotencyKey }) {
  return transaction(async (client) => {
    await getUserOrThrow(targetUserId, client);
    const idempotencyKeyHash = hashIdempotencyKey(idempotencyKey);
    const result = await pointLedgerService.reconcileProjection(targetUserId, client);
    const ledgerEvent = await pointLedgerService.recordEvent(
      {
        entryKey: buildPointReconciliationEntryKey(adminActorId, idempotencyKey),
        userId: targetUserId,
        type: POINT_TRANSACTION_TYPE.POINT_PROJECTION_RECONCILIATION,
        amount: 0,
        description: reason,
        referenceType: 'POINT_PROJECTION_RECONCILIATION',
        referenceId: targetUserId,
        metadata: { admin_actor_id: adminActorId }
      },
      client
    );

    if (ledgerEvent.applied) {
      await auditLogService.log(
        {
          actorType: AUDIT_ACTOR_TYPE.ADMIN,
          actorId: adminActorId,
          entityType: 'user',
          entityId: targetUserId,
          action: 'slipcraft.admin.points_reconciled',
          metadata: {
            reason,
            previousProjectionBalance: result.before.projectionBalance,
            ledgerBalance: result.after.ledgerBalance,
            difference: result.before.difference,
            idempotencyKeyHash
          }
        },
        client
      );
    }

    return presentPointReconciliation(result.after);
  });
}

async function adjustUserPoints({ targetUserId, delta, reason, adminActorId, idempotencyKey }) {
  return transaction(async (client) => {
    await getUserOrThrow(targetUserId, client);
    const ledgerResult = await pointLedgerService.applyEntry(
      {
        entryKey: buildAdminAdjustmentEntryKey(adminActorId, idempotencyKey),
        userId: targetUserId,
        type: POINT_TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
        amount: delta,
        description: reason,
        referenceType: 'ADMIN_POINT_ADJUSTMENT',
        referenceId: targetUserId,
        metadata: { admin_actor_id: adminActorId }
      },
      client
    );

    if (ledgerResult.applied) {
      await riskEngineService.evaluateEvent(
        {
          eventType: 'ADMIN_ADJUSTMENT',
          domain: RISK_DOMAIN.ADMIN,
          userId: targetUserId,
          source: 'admin-points-adjustment',
          resourceType: 'ADMIN_POINT_ADJUSTMENT',
          resourceId: targetUserId,
          correlationId: `admin-adjustment:${adminActorId}:${idempotencyKey}`,
          metadata: {
            adminActorId,
            adjustmentPoints: Math.abs(Number(delta || 0))
          }
        },
        { actorId: adminActorId, client }
      );

      await auditLogService.log(
        {
          actorType: AUDIT_ACTOR_TYPE.ADMIN,
          actorId: adminActorId,
          entityType: 'user',
          entityId: targetUserId,
          action: 'slipcraft.admin.points_adjusted',
          metadata: { delta, reason, points: ledgerResult.profile.points }
        },
        client
      );
    }

    return getUserWithAuthoritativePoints(targetUserId, client);
  });
}

module.exports = {
  slipcraftUserService: {
    adjustUserPoints,
    deleteAccount,
    getPointReconciliation,
    getPointsSummary,
    listUsers,
    reconcilePointProjection,
    updateProfile
  }
};
