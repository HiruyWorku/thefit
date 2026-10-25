const VERSION = "__BUILD_VERSION__";
const SHELL = "__PRECACHE_FILES__";
const CACHE = `the-fit-shell-${VERSION}`;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      /^(the-fit-|open-wardrobe-shell-|wardrobe-images-)/.test(key) && key !== CACHE
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  // Activate an update only after the user chooses Update app.
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // Private records and photos must never survive sign-out in a shared cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.method !== "GET") return;
  // Only public build files are cached, never image proxies or signed URLs.
  if (request.mode === "navigate" && ["/", "/app"].includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match("/index.html")) || fetch(request)));
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
  }
});
