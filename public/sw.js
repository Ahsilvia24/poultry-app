/* PoultryTech home-screen cache.
 * First open needs a connection. After that, tap should paint the last
 * saved page immediately and refresh in the background.
 *
 * Network-first used to leave a black screen for several seconds on a
 * slow radio. Only wait on the network when this phone has never saved
 * that page.
 */
const CACHE = "poultrytech-offline-v8";
const NETWORK_MS = 1500;
const SIGNED_OUT_FLAG = "/__poultrytech-signed-out";

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

function isPublicAuthPath(path) {
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/support") ||
    path.startsWith("/privacy")
  );
}

async function isSignedOut() {
  const cache = await caches.open(CACHE);
  return Boolean(await cache.match(SIGNED_OUT_FLAG));
}

async function dropSignedInPages(cache) {
  const reqs = await cache.keys();
  await Promise.all(
    reqs.map(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === SIGNED_OUT_FLAG || isPublicAuthPath(path)) return;
      if (isStaticAsset(new URL(req.url))) return;
      if (
        path === "/manifest.webmanifest" ||
        path === "/offline.html" ||
        path.endsWith(".png") ||
        path.endsWith(".ico")
      ) {
        return;
      }
      await cache.delete(req);
    }),
  );
}

async function setSignedOut(on) {
  const cache = await caches.open(CACHE);
  if (on) {
    await cache.put(SIGNED_OUT_FLAG, new Response("1", { status: 200 }));
    await dropSignedInPages(cache);
    return;
  }
  await cache.delete(SIGNED_OUT_FLAG);
}

async function putOk(cache, request, response) {
  if (!response || !response.ok) return response;
  if (await isSignedOut()) {
    const path = new URL(request.url).pathname;
    if (!isPublicAuthPath(path) && !isStaticAsset(new URL(request.url))) return response;
  }
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
  if (await isSignedOut()) {
    const login = await cache.match("/login");
    if (login) return login;
  }
  const page = await matchCachedPage(cache, request);
  if (page) return page;
  if (isNavigation(request)) {
    if (await isSignedOut()) {
      const login = await cache.match("/login");
      if (login) return login;
    }
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

function ack(event) {
  try {
    event.ports?.[0]?.postMessage({ ok: true });
  } catch {
    /* no port */
  }
}

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "sign-out") {
    event.waitUntil(setSignedOut(true).then(() => ack(event)));
    return;
  }
  if (type === "sign-in") {
    event.waitUntil(setSignedOut(false).then(() => ack(event)));
    return;
  }
  const urls = event.data?.urls;
  if (event.data?.type !== "precache" || !Array.isArray(urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        urls.map(async (url) => {
          try {
            const parsed = new URL(String(url), self.location.origin);
            if (!sameOrigin(parsed) || skipRequest(parsed)) return;
            if (!isStaticAsset(parsed) && !PRECACHE.includes(parsed.pathname)) return;
            if (await cache.match(parsed.href)) return;
            await cache.add(parsed.href).catch(() => undefined);
          } catch {
            /* skip bad url */
          }
        }),
      );
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
    event.respondWith(
      (async () => {
        if ((await isSignedOut()) && !isPublicAuthPath(url.pathname)) {
          const cache = await caches.open(CACHE);
          const login = await cache.match("/login");
          if (login) return login;
          try {
            return await fetch("/login");
          } catch {
            return cachedFallback(request);
          }
        }
        return staleWhileRevalidate(request, event);
      })(),
    );
    return;
  }
  event.respondWith(networkFirst(request));
});
