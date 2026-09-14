"use client";

import { useEffect } from "react";

function collectAppAssetUrls() {
  const urls = new Set<string>();
  for (const el of document.querySelectorAll("script[src]")) {
    if (el instanceof HTMLScriptElement && el.src) urls.add(el.src);
  }
  for (const el of document.querySelectorAll("link[href]")) {
    if (!(el instanceof HTMLLinkElement) || !el.href) continue;
    if (el.rel === "stylesheet" || el.rel === "modulepreload" || el.rel === "preload") {
      urls.add(el.href);
    }
  }
  return [...urls];
}

async function precacheAppAssets() {
  const ready = await navigator.serviceWorker.ready;
  ready.active?.postMessage({ type: "precache", urls: collectAppAssetUrls() });
}

/** Save the app files on the phone so Home Screen can open without service. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(
      () => precacheAppAssets(),
      () => undefined,
    );
  }, []);
  return null;
}
