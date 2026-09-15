import { clearLocalReplica } from "@/lib/offline/idb";

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
  await postWorker("sign-in");
}

/** Clear replica, cookie, and cached dashboard, then open login. */
export async function signOutLocalApp() {
  await clearLocalReplica();
  await postWorker("sign-out");
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
    });
  } catch {
    /* Offline: local replica + SW flag still leave the app. */
  }
  window.location.replace("/login");
}