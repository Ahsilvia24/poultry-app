/* PoultryTech home-screen cache.
 * First open needs a connection. After that, tap should paint the last
 * saved page immediately and refresh in the background.
 *
 * Network-first used to leave a black screen for several seconds on a
 * slow radio. Only wait on the network when this phone has never saved
 * that page.
 */
const CACHE = "poultrytech-offline-v11";
const NETWORK_MS = 1500;
const SIGNED_OUT_FLAG = "/__poultrytech-signed-out";
const LEAVE_PAGE = "/signed-out.html";

const PRECACHE = [
  "/signed-out.html",
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
    path === "/signed-out" ||
    path === "/signed-out.html" ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/support") ||
    path.startsWith("/privacy")
  );
}

function isLeavePath(path) {
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/signed-out" ||
    path === "/signed-out.html"
  );
}

function responseLooksLikeLogin(res) {
  if (!res) return false;
  try {
    const path = new URL(res.url).pathname;
    return (
      path === "/login" ||
      path.startsWith("/login/") ||
      path === "/signed-out" ||
      path === "/signed-out.html" ||
      path === "/api/leave"
    );
  } catch {
    return false;
  }
}

async function isSignedOut() {
  const cache = await caches.open(CACHE);
  return Boolean(await cache.match(SIGNED_OUT_FLAG));
}

function keepWhenSignedOut(path, url) {
  if (path === SIGNED_OUT_FLAG || path === LEAVE_PAGE || path === "/offline.html") return true;
  if (isStaticAsset(url)) return true;
  return (
    path === "/manifest.webmanifest" ||
    path.endsWith(".png") ||
    path.endsWith(".ico")
  );
}

async function dropSignedInPages(cache) {
  const reqs = await cache.keys();
  await Promise.all(
    reqs.map(async (req) => {
      const parsed = new URL(req.url);
      if (keepWhenSignedOut(parsed.pathname, parsed)) return;
      await cache.delete(req);
    }),
  );
}

async function setSignedOut(on) {
  const cache = await caches.open(CACHE);
  if (on) {
    await cache.put(SIGNED_OUT_FLAG, new Response("1", { status: 200 }));
    await dropSignedInPages(cache);
    await cache.add(LEAVE_PAGE).catch(() => undefined);
    return;
  }
  await cache.delete(SIGNED_OUT_FLAG);
}

async function serveLeave() {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(LEAVE_PAGE);
  if (cached) return cached;
  try {
    const fresh = await fetch(LEAVE_PAGE, { cache: "reload" });
    if (fresh && fresh.ok) {
      await cache.put(LEAVE_PAGE, fresh.clone());
      return fresh;
    }
  } catch {
    /* last-resort page */
  }
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PoultryTech</title></head><body style="font-family:system-ui;background:#f3efe6;color:#1c1917;padding:2rem;text-align:center"><h1>Signed out</h1><p>Connect to Wi-Fi and open PoultryTech again to sign in.</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html;charset=utf-8" } },
  );
}

async function putOk(cache, request, response) {
  if (!response || !response.ok) return response;
  if (await isSignedOut()) {
    const path = new URL(request.url).pathname;
    if (path !== LEAVE_PAGE && !isStaticAsset(new URL(request.url))) return response;
  }
  if (response.redirected || responseLooksLikeLogin(response)) {
    const finalPath = new URL(response.url).pathname;
    const reqPath = new URL(request.url).pathname;
    if (finalPath !== reqPath || responseLooksLikeLogin(response)) {
      if (!responseLooksLikeLogin(response)) {
        await cache.put(new Request(response.url), response.clone());
      }
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

async function matchCachedPage(cache, request, homeFallback = true) {
  const exact = await cache.match(request);
  if (exact && !responseLooksLikeLogin(exact)) return exact;
  if (!isNavigation(request)) return null;
  const path = new URL(request.url).pathname;
  const byPath = await cache.match(path);
  if (byPath && !responseLooksLikeLogin(byPath)) return byPath;
  if (!homeFallback) return null;
  const home = await cache.match("/");
  if (home && !responseLooksLikeLogin(home)) return home;
  return null;
}

async function cachedFallback(request) {
  if (await isSignedOut()) return serveLeave();
  const cache = await caches.open(CACHE);
  const page = await matchCachedPage(cache, request);
  if (page) return page;
  if (isNavigation(request)) {
    const home = await cache.match("/");
    const fallback =
      (home && !responseLooksLikeLogin(home) ? home : null) ||
      (await cache.match("/offline.html"));
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

async function staleWhileRevalidate(request, event, homeFallback = true) {
  const cache = await caches.open(CACHE);
  const cached = await matchCachedPage(cache, request, homeFallback);
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
    if (await old.match(SIGNED_OUT_FLAG)) {
      await cache.put(SIGNED_OUT_FLAG, new Response("1", { status: 200 }));
    }
    const signedOut = Boolean(await cache.match(SIGNED_OUT_FLAG));
    const reqs = await old.keys();
    await Promise.all(
      reqs.map(async (req) => {
        const path = new URL(req.url).pathname;
        if (path === "/login" || path.startsWith("/login/")) return;
        if (signedOut && (path === "/" || path === "/signed-out")) return;
        const res = await old.match(req);
        if (!res || responseLooksLikeLogin(res)) return;
        const existing = await cache.match(req);
        if (existing && !responseLooksLikeLogin(existing)) return;
        await cache.put(req, res);
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
      if (await isSignedOut()) await dropSignedInPages(cache);
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
  event.respondWith(
    (async () => {
      if (await isSignedOut()) {
        if (isPublicAuthPath(url.pathname) && !isLeavePath(url.pathname)) {
          return staleWhileRevalidate(request, event, false);
        }
        return serveLeave();
      }
      if (isNavigation(request) || isRsc(request, url)) {
        return staleWhileRevalidate(request, event);
      }
      return networkFirst(request);
    })(),
  );
});
