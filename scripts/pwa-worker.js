const VERSION = "__BUILD_VERSION__";
const SHELL = "__PRECACHE_FILES__";
const CACHE = `the-fit-shell-${VERSION}`;
const IMAGE_CACHE = "the-fit-images-v1";
const DATA_CACHE = "the-fit-data-v1";
const ACTIVE = new Set([CACHE, IMAGE_CACHE, DATA_CACHE]);
const WARDROBE = "/api/import/wardrobe";

async function store(cache, request, response, limit) {
  try {
    await cache.put(request, response.clone());
    if (limit) {
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
    }
  } catch { /* A full cache must not prevent online use. */ }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  // Updates activate after existing windows close, keeping each shell consistent.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) =>
      /^(the-fit-|open-wardrobe-shell-|wardrobe-images-)/.test(key) && !ACTIVE.has(key),
    ).map((key) => caches.delete(key)));
    await self.clients.claim();
    // The initial page may have fetched its wardrobe before this worker took control.
    try {
      const response = await fetch(WARDROBE, { cache: "no-store" });
      if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
        await store(await caches.open(DATA_CACHE), WARDROBE, response);
      }
    } catch { /* First launch can finish without a wardrobe connection. */ }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") {
    // Invalidate the snapshot after successful writes; never queue mutations offline.
    if (url.pathname.startsWith(WARDROBE)) {
      event.respondWith((async () => {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(DATA_CACHE);
          await cache.delete(WARDROBE);
          try {
            const latest = await fetch(WARDROBE, { cache: "no-store" });
            if (latest.ok) await store(cache, WARDROBE, latest);
          } catch { /* Reload will retrieve a new snapshot when available. */ }
        }
        return response;
      })());
    }
    return;
  }
  if (url.pathname === WARDROBE) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await store(cache, WARDROBE, response);
        return response;
      } catch {
        return (await cache.match(WARDROBE)) || new Response('{"error":"Connect to load your wardrobe for the first time."}', {
          status: 503, headers: { "Content-Type": "application/json" },
        });
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/_ipx/") || url.pathname.startsWith("/api/import/library/")) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.headers.get("content-type")?.startsWith("image/")) {
        await store(cache, request, response, 300);
      }
      return response;
    })());
    return;
  }
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match("/index.html")) || fetch(request)));
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) || fetch(request)));
  }
});
