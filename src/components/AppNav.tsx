"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useKeypadNav } from "@/components/KeypadNavContext";

const tabs = [
  { href: "/reports", label: "Reports", icon: "reports" },
  { href: "/lfo", label: "LFO", icon: "feed-bin" },
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/farms", label: "Farms", icon: "barn" },
  { href: "/tools", label: "Tools", icon: "tools" },
] as const;

const selectedTabClass =
  "border-emerald-700/35 bg-emerald-50/70 text-stone-700";

const extra = [
  { href: "/settlement", label: "Settlement" },
  { href: "/settings", label: "Settings" },
] as const;

const desktopNav = [...tabs, ...extra];

function TabIcon({
  name,
  size = 20,
}: {
  name: (typeof tabs)[number]["icon"];
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" fill="currentColor" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" fill="currentColor" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
        </svg>
      );
    case "barn":
      return (
        <svg {...common}>
          <path d="M4 20V10l8-6 8 6v10" />
          <path d="M9 20v-6h6v6" />
          <path d="M4 10h16" />
        </svg>
      );
    case "feed-bin":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <rect x="6" y="3" width="12" height="2" rx="0.5" />
          <rect x="6" y="5" width="12" height="7" />
          <path d="M6 12h12L12 21z" />
        </svg>
      );
    case "tools":
      return (
        <svg {...common}>
          <path d="M14.7 6.3 18 9.6l-7.4 7.4H7.3v-3.3z" />
          <path d="M8 6.2a3.2 3.2 0 0 0 4 4" />
          <path d="M6 18.5 9.2 15.3" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="4" height="8" rx="0.5" />
          <rect x="10" y="6" width="4" height="12" rx="0.5" />
          <rect x="16" y="3" width="4" height="15" rx="0.5" />
        </svg>
      );
  }
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function AppNav() {
  const pathname = usePathname();
  const { keypadOpen } = useKeypadNav();

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b border-stone-200 bg-[#f7f4ef]/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <nav className="flex items-center gap-1">
            {desktopNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-base font-semibold",
                    active
                      ? "border border-emerald-700/35 bg-emerald-50/70 text-stone-700"
                      : "text-stone-700 hover:bg-stone-200",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {keypadOpen ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white md:hidden">
          <div className="flex items-center gap-1 px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
            {tabs.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] border px-0.5 py-1.5 text-center text-[10px] font-extrabold leading-none text-stone-700",
                    active ? selectedTabClass : "border-transparent",
                  )}
                >
                  <TabIcon name={item.icon} size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
