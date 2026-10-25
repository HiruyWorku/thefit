import { test } from "node:test";
import assert from "node:assert/strict";
import { decartApi } from "./decart-api.mjs";

test("Decart token errors are actionable and never expose credentials or upstream bodies", async t => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  let handler;
  const apiKey = "test-server-only-secret";
  const plugin = decartApi({ env: { DECART_API_KEY: apiKey } });
  plugin.configResolved({});
  plugin.configureServer({ middlewares: { use(fn) { handler = fn; } } });

  for (const [upstreamStatus, expectedStatus, message] of [
    [401, 503, /rejected the API key/],
    [403, 503, /rejected the API key/],
    [402, 503, /credits are unavailable/],
    [429, 429, /request limit/],
    [500, 502, /Could not start/],
  ]) {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /\/v1\/client\/tokens$/);
      assert.equal(options.headers["X-API-KEY"], apiKey);
      const request = JSON.parse(options.body);
      assert.deepEqual(request.allowedModels, ["lucy-vton-3.6"]);
      assert.equal(request.constraints.realtime.maxSessionDuration, 90);
      return new Response(`private upstream details ${apiKey}`, { status: upstreamStatus });
    };
    let result;
    const res = { setHeader() {}, end(body) { result = { status: this.statusCode, body }; } };
    await handler({ url: "/api/decart/token", method: "POST" }, res, () => assert.fail("Unexpected fallthrough"));
    assert.equal(result.status, expectedStatus);
    assert.match(JSON.parse(result.body).error, message);
    assert.ok(!result.body.includes(apiKey));
    assert.ok(!result.body.includes("private upstream details"));
  }
});
