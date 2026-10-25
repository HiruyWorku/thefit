import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Script } from "node:vm";
import { createServer } from "vite";
import wardrobeConfig from "../vite.config.mjs";

test("Vite serves the actual Decart video worker instead of a missing prebundle asset", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "wardrobe-worker-test-"));
  let server;
  t.after(async () => {
    await server?.close();
    await rm(dir, { recursive: true, force: true });
  });
  const config = wardrobeConfig({ mode: "test" });
  assert.ok(config.optimizeDeps.exclude.includes("@decartai/sdk"));
  assert.ok(config.optimizeDeps.include.includes("@decartai/sdk > p-retry"),
    "the excluded SDK's CommonJS retry dependency still needs prebundling");
  // Exercise Vite's module and asset transforms without starting background
  // dependency builds or loading the storage and metered-provider middleware.
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    plugins: [config.plugins[0]],
    optimizeDeps: { exclude: config.optimizeDeps.exclude, noDiscovery: true, include: [] },
    cacheDir: path.join(dir, "vite-cache"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false, warmup: { clientFiles: [] } },
  });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const app = await fetch(`${origin}/src/LiveTryOn.jsx`).then(response => response.text());
  assert.match(app, /\/node_modules\/@decartai\/sdk\/dist\/index\.js/,
    "SDK must keep its original location so relative worker URLs remain valid");

  const moduleUrl = `${origin}/node_modules/@decartai/sdk/dist/realtime/browser/frame-metadata-diagnostics.js`;
  const source = await fetch(moduleUrl).then(response => response.text());
  const workerPath = source.match(/new URL\("([^"]*frame-metadata-worker\.js)"/);
  assert.ok(workerPath, "the transformed SDK must resolve a frame worker URL");
  const response = await fetch(new URL(workerPath[1], moduleUrl));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  const workerSource = await response.text();
  assert.doesNotThrow(() => new Script(workerSource), "worker response must be executable JavaScript, not fallback HTML");
  assert.match(workerSource, /initAck/);
});
