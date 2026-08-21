const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeTelegramUserId,
  parseTelegramUserIds,
  resolveConfiguredTelegramRole,
} = require("../utils/telegramAuthorization");

test("bot Telegram authorization parses stable numeric ID allowlists", () => {
  const ids = parseTelegramUserIds("1001, 1002", "bad", "", "1001");

  assert.deepEqual([...ids].sort(), ["1001", "1002"]);
  assert.equal(normalizeTelegramUserId("@owner"), null);
  assert.equal(normalizeTelegramUserId(" 1003 "), "1003");
});

test("bot Telegram authorization resolves owner before admin and never trusts usernames", () => {
  const ownerIds = parseTelegramUserIds("1001");
  const adminIds = parseTelegramUserIds("1001,1002");

  assert.equal(resolveConfiguredTelegramRole("1001", { ownerIds, adminIds }), "OWNER");
  assert.equal(resolveConfiguredTelegramRole("1002", { ownerIds, adminIds }), "ADMIN");
  assert.equal(resolveConfiguredTelegramRole("owner_username", { ownerIds, adminIds }), "GUEST");
  assert.equal(resolveConfiguredTelegramRole("9999", { ownerIds, adminIds }), "GUEST");
});