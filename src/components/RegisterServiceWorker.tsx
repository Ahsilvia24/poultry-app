"use client";

import { useEffect } from "react";
import { collectWarmAssetUrls, warmOfflineAssets } from "@/lib/offline/warmOfflineAssets";

function collectAppAssetUrls() {
  return collectWarmAssetUrls();
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
      () => {
        void precacheAppAssets();
        void warmOfflineAssets();
      },
      () => undefined,
    );
  }, []);
  return null;
}
