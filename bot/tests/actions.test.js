const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ADMIN_TELEGRAM_ID ||= "1001";
process.env.ADMIN_TELEGRAM_USERNAME ||= "admin";
process.env.API_URL ||= "http://localhost:3000";
process.env.BOT_TOKEN ||= "123456:test-token";
process.env.ADMIN_API_TOKEN ||= "admin-token";
process.env.MINI_APP_URL ||= "https://mini.transferly.test";

const { buildCallbackData, validateCallback, cleanupCallbackRegistry } = require("../utils/actions");
const { initialSessionState } = require("../utils/sessionState");

test("long callback actions are signed through session references", () => {
  const ctx = { session: initialSessionState() };
  const action = `PROVIDER_CUSTOM:${"x".repeat(90)}`;
  const data = buildCallbackData(ctx, action);

  assert.ok(data.startsWith("cb|REF:"));
  assert.ok(data.length <= 64);

  const validation = validateCallback(ctx, data);
  assert.equal(validation.status, "ok");
  assert.equal(validation.action, action);
});

test("expired callback references are rejected", () => {
  const ctx = { session: initialSessionState() };
  const action = `SERVICE:${"x".repeat(90)}`;
  const data = buildCallbackData(ctx, action);

  Object.values(ctx.session.callbackRegistry).forEach((entry) => {
    entry.expiresAt = Date.now() - 1;
  });
  cleanupCallbackRegistry(ctx);

  const validation = validateCallback(ctx, data);
  assert.equal(validation.status, "expired");
  assert.equal(validation.reason, "reference");
});
