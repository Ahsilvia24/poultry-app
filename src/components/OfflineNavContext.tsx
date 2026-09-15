"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { hrefHasHouseFocus, resetAppScroll } from "@/lib/app-scroll";
import { replicaHrefsMatch } from "@/lib/offline/hasFarmGraph";

type OfflineNavValue = {
  viewHref: string;
  navigate: (href: string) => void;
  replace: (href: string) => void;
};

const OfflineNavContext = createContext<OfflineNavValue | null>(null);

function liveHref(pathname: string) {
  if (typeof window === "undefined") return pathname;
  return `${window.location.pathname}${window.location.search}`;
}

export function OfflineNavProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    const onPop = () => setPendingHref(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!pendingHref) return;
    if (replicaHrefsMatch(pendingHref, liveHref(pathname))) setPendingHref(null);
  }, [pathname, pendingHref]);

  const navigate = useCallback(
    (href: string) => {
      if (!hrefHasHouseFocus(href)) resetAppScroll();
      setPendingHref(href);
      router.push(href);
    },
    [router],
  );

  const replace = useCallback(
    (href: string) => {
      setPendingHref(href);
      router.replace(href);
    },
    [router],
  );

  const viewHref = pendingHref ?? liveHref(pathname);
  const value = useMemo(() => ({ viewHref, navigate, replace }), [viewHref, navigate, replace]);

  return <OfflineNavContext.Provider value={value}>{children}</OfflineNavContext.Provider>;
}

export function useOfflineNav() {
  return useContext(OfflineNavContext);
}
