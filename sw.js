// =========================================================
// 台北垃圾車即時查詢  Service Worker
// 每次發布新版，只要修改下面的 APP_VERSION
// =========================================================

const APP_VERSION = "1.6.0";

const APP_CACHE = `app-v${APP_VERSION}`;
const DATA_CACHE = "data";
const TILE_CACHE = "tiles";
const MAX_TILES = 1500;        // 最多保留約 1500 張地圖圖磚（約 30 MB）
const DATA_TIMEOUT_MS = 4000;  // 抓最新班次最多等 4 秒

// 安裝時存到手機上的檔案
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
];


// =========================
// 安裝：下載這個版本的所有檔案
// =========================
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })));

      // 順便存一份班次資料
      try {
        const res = await fetch("./garbage.json", { cache: "reload" });
        if (res.ok) {
          const dataCache = await caches.open(DATA_CACHE);
          await dataCache.put("./garbage.json", res);
        }
      } catch (err) {
        // 沒網路就算了，下次再抓
      }

      await self.skipWaiting();
    })()
  );
});


// =========================
// 啟用：刪掉舊版本的檔案
// =========================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("app-") && key !== APP_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});


// =========================
// 回報版本號給網頁
// =========================
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "GET_VERSION") {
    event.source?.postMessage({ type: "VERSION", version: APP_VERSION });
  }
});


// =========================
// 讀取檔案
// =========================
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 地圖圖磚：有存過就用存的，沒有再下載並存起來
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(tileFirst(req));
    return;
  }

  // Leaflet 地圖套件：用手機上的
  if (url.hostname === "unpkg.com") {
    event.respondWith(cacheFirst(req, APP_CACHE));
    return;
  }

  // Google 地圖、Google Analytics 等：不處理
  if (url.origin !== self.location.origin) return;

  // 班次資料：先試著抓最新的，抓不到用手機上的
  if (url.pathname.endsWith("/garbage.json")) {
    event.respondWith(dataNetworkFirst(req));
    return;
  }

  // 網頁本身：用手機上的
  if (req.mode === "navigate") {
    event.respondWith(
      (async () =>
        (await caches.match(req, { ignoreSearch: true })) ||
        (await caches.match("./index.html")) ||
        fetch(req))()
    );
    return;
  }

  // CSS、JS、圖示：用手機上的
  event.respondWith(cacheFirst(req, APP_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function dataNetworkFirst(req) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const res = await withTimeout(fetch(req), DATA_TIMEOUT_MS);
    if (res.ok) {
      cache.put("./garbage.json", res.clone());
      return res;
    }
  } catch (err) {
    // 沒網路或太慢，改用手機上的
  }

  const cached = await cache.match("./garbage.json");
  return cached || Response.error();
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

let tilePutCount = 0;

async function tileFirst(req) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok && res.type !== "opaque") {
      await cache.put(req, res.clone());
      tilePutCount++;
      if (tilePutCount % 50 === 0) trimCache(cache, MAX_TILES);
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function trimCache(cache, maxItems) {
  const keys = await cache.keys();
  const extra = keys.length - maxItems;
  for (let i = 0; i < extra; i++) {
    await cache.delete(keys[i]);
  }
}