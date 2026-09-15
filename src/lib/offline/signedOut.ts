/** Must stay in sync with public/sw.js SIGNED_OUT_FLAG. */
export const SIGNED_OUT_FLAG = "/__poultrytech-signed-out";
export const SIGNED_OUT_STORAGE = "poultrytech-signed-out";

export function isPublicAuthPath(path: string) {
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/signed-out" ||
    path === "/signed-out.html" ||
    path === "/api/leave" ||
    path.startsWith("/api/leave/") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/support") ||
    path.startsWith("/privacy")
  );
}

function isStaticAssetPath(path: string) {
  return (
    path.startsWith("/_next/static/") ||
    /\.(?:js|mjs|css|png|ico|woff2|webmanifest)$/.test(path)
  );
}

function keepWhenSignedOut(path: string) {
  if (path === SIGNED_OUT_FLAG || path === "/signed-out.html" || path === "/offline.html") {
    return true;
  }
  if (isStaticAssetPath(path)) return true;
  return path === "/manifest.webmanifest" || path.endsWith(".png") || path.endsWith(".ico");
}

/** Page-side flag + cache wipe so Sign out does not wait on a worker message. */
export async function markCachesSignedOut(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(SIGNED_OUT_STORAGE, "1");
    else window.localStorage.removeItem(SIGNED_OUT_STORAGE);
  } catch {
    /* Private mode. */
  }
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("poultrytech-offline-"))
        .map(async (key) => {
          const cache = await caches.open(key);
          if (!on) {
            await cache.delete(SIGNED_OUT_FLAG);
            return;
          }
          await cache.put(SIGNED_OUT_FLAG, new Response("1", { status: 200 }));
          const reqs = await cache.keys();
          await Promise.all(
            reqs.map(async (req) => {
              const path = new URL(req.url).pathname;
              if (keepWhenSignedOut(path)) return;
              await cache.delete(req);
            }),
          );
        }),
    );
  } catch {
    /* Cookie + worker still leave the session. */
  }
}

export async function phoneIsSignedOut() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(SIGNED_OUT_STORAGE) === "1") return true;
  } catch {
    /* Private mode. */
  }
  if (!("caches" in window)) return false;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      if (!key.startsWith("poultrytech-offline-")) continue;
      const cache = await caches.open(key);
      if (await cache.match(SIGNED_OUT_FLAG)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
