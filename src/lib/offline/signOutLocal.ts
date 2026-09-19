import { lockPhoneOwner } from "@/lib/offline/phoneUnlock";
import { markCachesSignedOut } from "@/lib/offline/signedOut";
import { LOGOUT_FETCH_MS, SIGN_OUT_OVERALL_MS, withTimeout } from "@/lib/offline/syncTimeout";

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

async function prepareLeave() {
  lockPhoneOwner();
  await markCachesSignedOut(true);
  await postWorker("sign-out");
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), LOGOUT_FETCH_MS);
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        keepalive: true,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    /* Offline or stalled: local replica + SW flag still leave the app. */
  }
}

/**
 * Clear the session cookie and cached dashboard, then open /api/leave.
 * Farms stay on this phone under that email. Never wipe IndexedDB.
 */
export async function signOutLocalApp() {
  try {
    await withTimeout(prepareLeave(), SIGN_OUT_OVERALL_MS);
  } catch {
    /* Still open the leave page. */
  }
  window.location.replace("/api/leave");
}
