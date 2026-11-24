const CACHE_NAME = "virtual-shop-v20";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./styles.css",
  "./motion.css",
  "./motion.js",
  "./js/data.js",
  "./js/storage.js",
  "./js/app.js",
  "./js/auth.js",
  "./seller.html",
  "./seller.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache each asset independently: one missing optional file must not
    // prevent the service worker from installing.
    await Promise.allSettled(FILES.map(file => cache.add(file)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key.startsWith("virtual-shop-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
  }
});
