const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  attachHmacAuth,
  buildSignature,
  normalizeBody,
  stableStringify,
} = require("../utils/apiAuth");

test("bot API HMAC helpers normalize payloads deterministically", () => {
  assert.equal(stableStringify({ z: 1, a: 2, omit: undefined }), '{"a":2,"z":1}');
  assert.equal(normalizeBody({ z: 1, a: 2 }, "POST"), '{"a":2,"z":1}');
  assert.equal(normalizeBody('{"z":1,"a":2}', "POST"), '{"a":2,"z":1}');
  assert.equal(normalizeBody({ z: 1 }, "GET"), "");

  const signature = buildSignature("secret", "1700000000000", "POST", "/api/admin/jobs", '{"a":2,"z":1}');
  assert.match(signature, /^[a-f0-9]{64}$/);
});

test("bot API HMAC interceptor signs only approved API origins", async (t) => {
  const originalDateNow = Date.now;
  t.after(() => {
    Date.now = originalDateNow;
  });
  Date.now = () => 1_700_000_000_000;

  let interceptor;
  const axiosInstance = {
    interceptors: {
      request: {
        use(fn) {
          interceptor = fn;
        },
      },
    },
  };

  attachHmacAuth(axiosInstance, {
    secret: "secret",
    defaultBaseUrl: "https://api.transferly.example",
    allowedOrigins: new Set(["https://api.transferly.example"]),
  });

  const signed = interceptor({
    method: "post",
    url: "/api/admin/jobs",
    data: { b: 2, a: 1 },
    headers: {},
  });

  assert.equal(signed.headers[TIMESTAMP_HEADER], "1700000000000");
  assert.equal(
    signed.headers[SIGNATURE_HEADER],
    buildSignature("secret", "1700000000000", "POST", "/api/admin/jobs", '{"a":1,"b":2}'),
  );

  const skipped = interceptor({
    method: "post",
    url: "https://frontend.transferly.example/api/admin/jobs",
    data: { b: 2, a: 1 },
    headers: {},
  });

  assert.equal(skipped.headers[TIMESTAMP_HEADER], undefined);
  assert.equal(skipped.headers[SIGNATURE_HEADER], undefined);
});
