import { isReplicaHref } from "@/lib/offline/hasFarmGraph";

/**
 * Write a replica URL without Next.js ACTION_RESTORE.
 * Passing the current history.state keeps `__NA`, so the patched
 * pushState/replaceState skip the RSC fetch that fails offline.
 */
export function writeReplicaUrl(href: string, mode: "push" | "replace") {
  if (typeof window === "undefined" || !isReplicaHref(href)) return false;
  const current = window.history.state;
  // __NA marks an app-router entry. Next.js then skips the RSC fetch, so a
  // dead service cannot leave the screen waiting on that request.
  const state = current?.__NA ? current : { ...(current ?? {}), __NA: true };
  if (mode === "replace") window.history.replaceState(state, "", href);
  else window.history.pushState(state, "", href);
  return true;
}
