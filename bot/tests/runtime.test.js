const assert = require("node:assert/strict");
const test = require("node:test");

const { createUpdateDeduper } = require("../utils/updateDeduper");
const { safeUrlMetadata, buildRuntimeStatus } = require("../utils/runtimeStatus");

test("update deduper tracks duplicates and expiry", () => {
  const deduper = createUpdateDeduper({ ttlMs: 1000, maxEntries: 10 });

  assert.deepEqual(deduper.check(42, 1000), {
    duplicate: false,
    tracked: true,
    updateId: "42",
  });
  assert.deepEqual(deduper.check(42, 1001), {
    duplicate: true,
    tracked: true,
    updateId: "42",
  });
  assert.deepEqual(deduper.check(42, 2501), {
    duplicate: false,
    tracked: true,
    updateId: "42",
  });

  assert.equal(deduper.stats(2501).acceptedCount, 2);
  assert.equal(deduper.stats(2501).duplicateCount, 1);
});

test("update deduper trims old entries when max size is reached", () => {
  const deduper = createUpdateDeduper({ ttlMs: 10000, maxEntries: 2 });
  deduper.check(1, 1000);
  deduper.check(2, 1001);
  deduper.check(3, 1002);

  const stats = deduper.stats(1003);
  assert.equal(stats.tracked, 2);
  assert.equal(stats.cleanupCount, 1);
});

test("runtime status exposes safe operational metadata only", () => {
  const payload = buildRuntimeStatus({
    nodeEnv: "production",
    isProduction: true,
    miniAppUrl: "https://mini.transferly.example/miniapp?token=do-not-echo",
    updates: {
      mode: "webhook",
      webhookUrl: "https://bot.transferly.example/telegram/webhook?secret=hidden",
      webhookPath: "/telegram/webhook",
      webhookSecret: "configured-secret",
      port: 8080,
      allowedUpdates: ["message", "callback_query"],
      dropPendingUpdates: false,
    },
    runtime: {
      requireApiReady: true,
      configureMenuButton: true,
      runSubscriptionAlertSweep: false,
      runSessionCleanup: true,
    },
  }, {
    apiReadiness: { ok: true, status: "ready" },
    menuButton: { status: "configured" },
    primaryMiniAppSection: "dashboard",
    updateDedupe: { tracked: 1 },
  });

  assert.equal(payload.ok, true);
  assert.deepEqual(payload.miniApp, {
    configured: true,
    protocol: "https",
    host: "mini.transferly.example",
    pathname: "/miniapp",
    primarySection: "dashboard",
  });
  assert.equal(payload.updates.webhook.host, "bot.transferly.example");
  assert.equal(payload.updates.webhook.pathname, "/telegram/webhook");
  assert.equal(payload.updates.webhookVerificationConfigured, true);
  assert.equal(JSON.stringify(payload).includes("do-not-echo"), false);
  assert.equal(JSON.stringify(payload).includes("configured-secret"), false);
});

test("safe URL metadata handles missing and invalid URLs", () => {
  assert.deepEqual(safeUrlMetadata(""), { configured: false });
  assert.deepEqual(safeUrlMetadata("not a url"), { configured: true, invalid: true });
});
