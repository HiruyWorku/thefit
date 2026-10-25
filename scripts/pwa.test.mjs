import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("./pwa-worker.js", import.meta.url), "utf8"))
  .replace('"__BUILD_VERSION__"', '"test"')
  .replace('"__PRECACHE_FILES__"', '["/index.html","/assets/app.js"]');

function setup(fetcher) {
  const handlers = {};
  const stores = new Map();
  const key = (request) => typeof request === "string" ? new URL(request, "https://fit.test").href : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        async put(request, response) { data.set(key(request), response.clone()); },
        async match(request) { return data.get(key(request))?.clone(); },
        async delete(request) { return data.delete(key(request)); },
        async keys() { return [...data.keys()].map((url) => new Request(url)); },
        async addAll(urls) { for (const url of urls) data.set(key(url), new Response(`cached ${url}`)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  vm.runInNewContext(source, {
    self: { location: { origin: "https://fit.test" }, clients: { claim: async () => {} }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches, fetch: fetcher, URL, Response, Set, Promise,
  });
  return {
    caches,
    async lifecycle(name) { let pending; handlers[name]({ waitUntil(promise) { pending = promise; } }); await pending; },
    async request(path, options = {}) {
      let response;
      handlers.fetch({ request: { url: `https://fit.test${path}`, method: "GET", ...options }, respondWith(promise) { response = promise; } });
      return response;
    },
  };
}

test("offline navigation and hashed assets use the installed shell", async () => {
  const app = setup(async () => { throw new Error("offline"); });
  await app.lifecycle("install");
  assert.equal(await (await app.request("/", { mode: "navigate" })).text(), "cached /index.html");
  assert.equal(await (await app.request("/assets/app.js")).text(), "cached /assets/app.js");
  assert.equal(await app.request("/api/try-on"), undefined);
});

test("private wardrobe data is never intercepted or cached", async () => {
  let offline = false;
  const app = setup(async () => {
    if (offline) throw new Error("offline");
    return Response.json([{ id: "shirt" }]);
  });
  assert.equal(await app.request("/api/import/wardrobe"), undefined);
  offline = true;
  assert.equal(await app.request("/api/import/wardrobe"), undefined);
  assert.equal(await app.request("/api/import/wardrobe/shirt", { method: "DELETE" }), undefined);
});

test("activation preserves unrelated caches and purges old private wardrobe snapshots", async () => {
  const app = setup(async () => Response.json([]));
  for (const name of ["another-app", "the-fit-shell-old", "open-wardrobe-shell-v1", "the-fit-images-v1", "the-fit-data-v1"]) await app.caches.open(name);
  await app.lifecycle("install");
  await app.lifecycle("activate");
  const keys = await app.caches.keys();
  assert.ok(keys.includes("another-app"));
  assert.ok(!keys.includes("the-fit-images-v1"));
  assert.ok(!keys.includes("the-fit-data-v1"));
  assert.ok(!keys.includes("the-fit-shell-old"));
  assert.ok(!keys.includes("open-wardrobe-shell-v1"));
});

test("private library images are never intercepted or cached", async () => {
  let calls = 0;
  const app = setup(async () => { calls++; return new Response("photo", { headers: { "Content-Type": "image/png" } }); });
  const url = "/api/import/library/shirt.png";
  await app.request(url);
  assert.equal(await app.request(url), undefined);
  assert.equal(calls, 0);
});

test("writes never create an offline wardrobe snapshot", async () => {
  let calls = 0;
  const app = setup(async () => { calls++; return Response.json(calls === 1 ? { ok: true } : [{ id: "new-shirt" }]); });
  await app.request("/api/import/wardrobe", { method: "POST" });
  assert.equal(calls, 0);
  assert.ok(!(await app.caches.keys()).includes('the-fit-data-v1'));
});
