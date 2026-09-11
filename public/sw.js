/* PoultryTech home-screen cache.
 * First open needs a connection. After that, the saved app can open
 * without phone service and reuse the last downloaded files / pages.
 *
 * Poor signal used to freeze the app because fetch waited until the
 * radio timed out. Wait a few seconds, then open the last saved page.
 */
const CACHE = "poultrytech-offline-v2";
const NETWORK_MS = 4000;

const PRECACHE = [
  "/login",
  "/offline.html",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
];

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  const path = url.pathname;
  return (
    path.startsWith("/_next/static/") ||
    /\.(?:js|mjs|css|png|ico|woff2|webmanifest)$/.test(path)
  );
}

function skipRequest(url) {
  const path = url.pathname;
  return (
    path === "/sw.js" ||
    path.startsWith("/api/") ||
    path.startsWith("/_next/webpack") ||
    path.startsWith("/_next/src")
  );
}

async function putOk(cache, request, response) {
  if (!response || !response.ok) return response;
  if (response.redirected) {
    const finalPath = new URL(response.url).pathname;
    const reqPath = new URL(request.url).pathname;
    if (finalPath !== reqPath) {
      await cache.put(new Request(response.url), response.clone());
      return response;
    }
  }
  await cache.put(request, response.clone());
  return response;
}

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function cachedFallback(request) {
  const cache = await caches.open(CACHE);
  const exact = await cache.match(request);
  if (exact) return exact;
  if (request.mode === "navigate") {
    const page =
      (await cache.match("/")) ||
      (await cache.match("/login")) ||
      (await cache.match("/offline.html"));
    if (page) return page;
    return new Response(
      "PoultryTech needs to download once on Wi-Fi, then it can open without service.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  return Response.error();
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  if (self.navigator && self.navigator.onLine === false) {
    return cachedFallback(request);
  }
  try {
    const fresh = await fetchWithTimeout(request, NETWORK_MS);
    return putOk(cache, request, fresh);
  } catch {
    return cachedFallback(request);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetchWithTimeout(request, NETWORK_MS);
    return putOk(cache, request, fresh);
  } catch {
    return cachedFallback(request);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!sameOrigin(url) || skipRequest(url)) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
