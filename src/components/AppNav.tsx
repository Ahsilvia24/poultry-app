"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { isKeypadGuardActive } from "@/lib/keypadPointerGuard";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { replicaPath } from "@/lib/offline/hasFarmGraph";
import { reportsTabHref } from "@/lib/reports/lastHref";
import { TabGlyph } from "@/components/TabGlyph";
import type { TabIconName } from "@/lib/tab-icon-glyphs";

const tabs = [
  { href: "/reports", label: "Reports", icon: "reports" },
  { href: "/lfo", label: "LFO", icon: "lfo" },
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/farms", label: "Farms", icon: "farms" },
  { href: "/tools", label: "Tools", icon: "tools" },
] as const satisfies readonly { href: string; label: string; icon: TabIconName }[];

const selectedTabClass =
  "border-emerald-700/35 bg-emerald-50/70 text-stone-700";

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function pathOnly(href: string) {
  return replicaPath(href).pathname;
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const offlineNav = useOfflineNav();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [reportsHref, setReportsHref] = useState("/reports");
  const viewPath = offlineNav ? pathOnly(offlineNav.viewHref) : pathname;
  const viewHref = offlineNav?.viewHref ?? pathname;

  useEffect(() => {
    setReportsHref(reportsTabHref(viewHref));
  }, [viewHref]);

  useEffect(() => {
    setPendingHref(null);
  }, [viewPath]);

  useEffect(() => {
    const prefetchTabs = () => {
      for (const item of tabs) {
        router.prefetch(item.href);
      }
    };
    prefetchTabs();
    window.addEventListener("online", prefetchTabs);
    return () => window.removeEventListener("online", prefetchTabs);
  }, [router]);

  function tabIsActive(href: string) {
    if (pendingHref) return isActive(pathOnly(pendingHref), href);
    return isActive(viewPath, href);
  }

  function prefetchTab(href: string) {
    router.prefetch(href);
  }

  function onTabPress(href: string) {
    if (isKeypadGuardActive()) return;
    router.prefetch(href);
    if (!isActive(viewPath, pathOnly(href))) setPendingHref(href);
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-1 pt-1.5 pb-[calc(0.7rem+env(safe-area-inset-bottom,0px))]">
        {tabs.map((item) => {
          const href = item.href === "/reports" ? reportsHref : item.href;
          const active = tabIsActive(item.href);
          return (
            <ReplicaLink
              key={item.href}
              href={href}
              prefetch
              onPointerEnter={() => prefetchTab(href)}
              onTouchStart={() => onTabPress(href)}
              onClick={() => onTabPress(href)}
              className={cn(
                "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] border px-0.5 py-1.5 text-center text-[12px] font-extrabold leading-none text-stone-700",
                active ? selectedTabClass : "border-transparent",
              )}
            >
              <TabGlyph name={item.icon} size={22} />
              {item.label}
            </ReplicaLink>
          );
        })}
      </div>
    </nav>
  );
}
