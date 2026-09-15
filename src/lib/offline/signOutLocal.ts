import { clearLocalReplica } from "@/lib/offline/idb";
import { markCachesSignedOut } from "@/lib/offline/signedOut";

function postWorker(type: "sign-out" | "sign-in"): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    const timer = window.setTimeout(done, 800);
    void (async () => {
      try {
        if (!("serviceWorker" in navigator)) {
          window.clearTimeout(timer);
          done();
          return;
        }
        const ready = await navigator.serviceWorker.ready;
        const worker = ready.active;
        if (!worker) {
          window.clearTimeout(timer);
          done();
          return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          window.clearTimeout(timer);
          done();
        };
        worker.postMessage({ type }, [channel.port2]);
      } catch {
        window.clearTimeout(timer);
        done();
      }
    })();
  });
}

export async function tellWorkerSignedIn() {
  await markCachesSignedOut(false);
  await postWorker("sign-in");
}

export async function keepSignedOutOnLogin() {
  await markCachesSignedOut(true);
  await postWorker("sign-out");
}

/**
 * Clear replica, cookie, and cached dashboard, then open the static
 * leave page. That file cannot be a cached dashboard.
 */
export async function signOutLocalApp() {
  await markCachesSignedOut(true);
  await clearLocalReplica();
  await postWorker("sign-out");
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    /* Offline: local replica + SW flag still leave the app. */
  }
  window.location.replace("/signed-out.html");
}
