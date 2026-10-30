import { isReplicaHref } from "@/lib/offline/hasFarmGraph";

/**
 * Write a replica URL without Next.js ACTION_RESTORE.
 * Passing the current history.state keeps `__NA`, so the patched
 * pushState/replaceState skip the RSC fetch that fails offline.
 */
function replicaHistoryState() {
  const current = window.history.state;
  // __NA tells Next to skip the RSC fetch. A bad connection must not block the page.
  if (current && (current.__NA || current._N)) return current;
  return { ...(current ?? {}), __NA: true };
}

export function writeReplicaUrl(href: string, mode: "push" | "replace") {
  if (typeof window === "undefined" || !isReplicaHref(href)) return false;
  const state = replicaHistoryState();
  if (mode === "replace") window.history.replaceState(state, "", href);
  else window.history.pushState(state, "", href);
  return true;
}
