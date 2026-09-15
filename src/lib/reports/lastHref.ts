import { replicaPath } from "@/lib/offline/hasFarmGraph";
import { reportsHref, resolveReportType } from "@/lib/reports/types";

export const LAST_REPORTS_HREF_KEY = "poultrytech.lastReportsHref";

function asReportsHref(href: string) {
  const { pathname, search } = replicaPath(href);
  if (pathname !== "/reports") return null;
  const params = new URLSearchParams(search);
  if (params.get("type") === "history") return null;
  return reportsHref({
    type: resolveReportType(params.get("type") ?? undefined),
    farmId: params.get("farmId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
}

export function rememberReportsHref(href: string) {
  const next = asReportsHref(href);
  if (!next || typeof window === "undefined") return next;
  try {
    window.sessionStorage.setItem(LAST_REPORTS_HREF_KEY, next);
  } catch {
    // Private mode / quota.
  }
  return next;
}

export function readLastReportsHref() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(LAST_REPORTS_HREF_KEY);
    return stored ? asReportsHref(stored) : null;
  } catch {
    return null;
  }
}

export function reportsTabHref(viewHref?: string | null) {
  if (viewHref) {
    const remembered = rememberReportsHref(viewHref);
    if (remembered) return remembered;
  }
  return readLastReportsHref() ?? "/reports";
}

export function mergeReportsInitial(initial: {
  type?: string;
  farmId?: string;
  from?: string;
  to?: string;
}) {
  if (initial.type) return initial;
  const last = readLastReportsHref();
  if (!last) return initial;
  const params = new URLSearchParams(replicaPath(last).search);
  return {
    type: params.get("type") ?? initial.type,
    farmId: params.get("farmId") ?? initial.farmId,
    from: params.get("from") ?? initial.from,
    to: params.get("to") ?? initial.to,
  };
}
