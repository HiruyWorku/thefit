const VERSION = "__BUILD_VERSION__";
const SHELL = "__PRECACHE_FILES__";
const CACHE = `the-fit-shell-${VERSION}`;
const IMAGE_CACHE = "the-fit-images-v2";
const ACTIVE = new Set([CACHE, IMAGE_CACHE]);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      /^(the-fit-|open-wardrobe-shell-|wardrobe-images-)/.test(key) && !ACTIVE.has(key)
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // Private records and photos must never survive sign-out in a shared cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.method !== "GET") return;
  if (url.pathname.startsWith("/_ipx/")) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.headers.get("content-type")?.startsWith("image/")) {
        try {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          await Promise.all(keys.slice(0, Math.max(0, keys.length - 300)).map(key => cache.delete(key)));
        } catch { /* Cache failure must not prevent online use. */ }
      }
      return response;
    })());
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match("/index.html")) || fetch(request)));
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
  }
});
