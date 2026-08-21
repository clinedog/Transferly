'use strict';

function safeUrlMetadata(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { configured: false };
  }

  try {
    const parsed = new URL(raw);
    return {
      configured: true,
      protocol: parsed.protocol.replace(/:$/, ''),
      host: parsed.host,
      pathname: parsed.pathname || '/',
    };
  } catch (_) {
    return {
      configured: true,
      invalid: true,
    };
  }
}

function buildRuntimeStatus(config, state = {}) {
  const updates = config.updates || {};
  const runtime = config.runtime || {};
  return {
    ok: Boolean(state.apiReadiness?.ok),
    service: 'transferly-bot',
    nodeEnv: config.nodeEnv || 'development',
    production: Boolean(config.isProduction),
    miniApp: {
      ...safeUrlMetadata(config.miniAppUrl),
      primarySection: state.primaryMiniAppSection || 'dashboard',
    },
    updates: {
      mode: updates.mode || 'polling',
      port: updates.port || null,
      webhook: safeUrlMetadata(updates.webhookUrl),
      webhookPath: updates.webhookPath || null,
      webhookVerificationConfigured: Boolean(updates.webhookSecret),
      allowedUpdates: Array.isArray(updates.allowedUpdates) ? updates.allowedUpdates : [],
      dropPendingUpdates: Boolean(updates.dropPendingUpdates),
    },
    runtime: {
      requireApiReady: Boolean(runtime.requireApiReady),
      configureMenuButton: Boolean(runtime.configureMenuButton),
      runSubscriptionAlertSweep: Boolean(runtime.runSubscriptionAlertSweep),
      runSessionCleanup: Boolean(runtime.runSessionCleanup),
    },
    telegram: {
      menuButton: state.menuButton || { status: 'unknown' },
    },
    api: state.apiReadiness || null,
    updateDedupe: state.updateDedupe || null,
  };
}

module.exports = {
  safeUrlMetadata,
  buildRuntimeStatus,
};
