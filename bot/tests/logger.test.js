const assert = require("node:assert/strict");
const test = require("node:test");

const { redactValue } = require("../utils/logger");

test("logger redacts sensitive metadata recursively", () => {
  const redacted = redactValue({
    authorization: "Bearer secret",
    nested: {
      botToken: "123456:secret",
      hmacSecret: "secret",
      signature: "signature",
      safe: "visible",
    },
  });

  assert.equal(redacted.authorization, "[redacted]");
  assert.equal(redacted.nested.botToken, "[redacted]");
  assert.equal(redacted.nested.hmacSecret, "[redacted]");
  assert.equal(redacted.nested.signature, "[redacted]");
  assert.equal(redacted.nested.safe, "visible");
});

test("logger serializes errors without raw response bodies", () => {
  const error = new Error("request failed");
  error.code = "ECONNRESET";
  error.response = {
    status: 503,
    headers: { "x-request-id": "req_123" },
    data: { access_token: "secret" },
  };

  assert.deepEqual(redactValue(error), {
    name: "Error",
    message: "request failed",
    code: "ECONNRESET",
    status: 503,
    requestId: "req_123",
  });
});

test("logger truncates long strings", () => {
  const redacted = redactValue({ body: "x".repeat(300) });
  assert.equal(redacted.body.length, 243);
  assert.match(redacted.body, /\.\.\.$/);
});
