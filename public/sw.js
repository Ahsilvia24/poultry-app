/* PoultryTech home-screen cache.
 * First open needs a connection. After that, tap should paint the last
 * saved page immediately and refresh in the background.
 *
 * Network-first used to leave a black screen for several seconds on a
 * slow radio. Only wait on the network when this phone has never saved
 * that page.
 */
const CACHE = "poultrytech-offline-v5";
const NETWORK_MS = 1500;

const PRECACHE = [
  "/",
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

function isNavigation(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isRsc(request, url) {
  return (
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-State-Tree") != null ||
    (request.headers.get("accept") || "").includes("text/x-component")
  );
}

function skipRequest(url) {
  const path = url.pathname;
  return (
    path === "/sw.js" ||
    path.startsWith("/support") ||
    path.startsWith("/privacy") ||
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

async function matchCachedPage(cache, request) {
  const exact = await cache.match(request);
  if (exact) return exact;
  if (!isNavigation(request)) return null;
  const path = new URL(request.url).pathname;
  return (await cache.match(path)) || (await cache.match("/")) || null;
}

async function cachedFallback(request) {
  const cache = await caches.open(CACHE);
  const page = await matchCachedPage(cache, request);
  if (page) return page;
  if (isNavigation(request)) {
    const fallback =
      (await cache.match("/")) || (await cache.match("/offline.html"));
    if (fallback) return fallback;
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

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await matchCachedPage(cache, request);
  const refresh = (async () => {
    try {
      const fresh = await fetch(request);
      await putOk(cache, request, fresh);
    } catch {
      /* keep showing the saved page */
    }
  })();
  event.waitUntil(refresh);
  if (cached) return cached;
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

async function adoptOldCaches(cache) {
  const keys = await caches.keys();
  for (const key of keys) {
    if (key === CACHE || !key.startsWith("poultrytech-offline-")) continue;
    const old = await caches.open(key);
    const reqs = await old.keys();
    await Promise.all(
      reqs.map(async (req) => {
        if (await cache.match(req)) return;
        const res = await old.match(req);
        if (res) await cache.put(req, res);
      }),
    );
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
      const cache = await caches.open(CACHE);
      await adoptOldCaches(cache);
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
  if (isNavigation(request) || isRsc(request, url)) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }
  event.respondWith(networkFirst(request));
});
