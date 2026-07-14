const CACHE_NAME = "taipei-garbage-map-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=120",
  "./script.js?v=120"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  // Google Maps、Analytics 等第三方資源先交給瀏覽器處理。
  if (url.origin !== self.location.origin) {
    return;
  }

  // garbage.json 下一階段再加入 Network First。
  if (url.pathname.endsWith("/garbage.json")) {
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});