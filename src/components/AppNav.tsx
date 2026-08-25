"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useKeypadNav } from "@/components/KeypadNavContext";

const tabs = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/farms", label: "Farms", icon: "barn" },
  { href: "/mortality", label: "Mortality", icon: "plus" },
  { href: "/lfo", label: "LFO", icon: "feed-bin" },
  { href: "/tools", label: "Tools", icon: "tools" },
] as const;

const extra = [
  { href: "/settlement", label: "Settlement" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

const desktopNav = [...tabs, ...extra];

function TabIcon({ name, className }: { name: string; className?: string }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" {...stroke} />
          <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.2" {...stroke} />
          <rect x="13.5" y="10.5" width="7" height="10" rx="1.2" {...stroke} />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" {...stroke} />
        </svg>
      );
    case "barn":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M4 20V10.5L12 4l8 6.5V20" {...stroke} />
          <path d="M9 20v-6h6v6" {...stroke} />
          <path d="M4 10.5h16" {...stroke} />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.25" {...stroke} />
          <path d="M12 8.5v7M8.5 12h7" {...stroke} />
        </svg>
      );
    case "feed-bin":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="6.2" y="3.2" width="11.6" height="2" rx="0.4" fill="currentColor" />
          <rect x="6.2" y="5.2" width="11.6" height="7.2" fill="currentColor" />
          <path d="M6.2 12.4h11.6L12 21.2z" fill="currentColor" />
        </svg>
      );
    case "tools":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M14.5 6.2 17.8 9.5l-7.2 7.2H7.3v-3.3z" {...stroke} />
          <path d="M8.2 5.8a3.4 3.4 0 0 0 4.1 4.1" {...stroke} />
          <path d="M5.5 18.5 9 15" {...stroke} />
        </svg>
      );
    default:
      return null;
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
            {desktopNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-base font-semibold",
                  isActive(pathname, item.href)
                    ? "bg-emerald-700 text-white"
                    : "text-stone-700 hover:bg-stone-200",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {keypadOpen ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white md:hidden">
          <div className="flex gap-1 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {tabs.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-0.5 py-1.5 text-center text-[11px] font-extrabold leading-tight",
                    active ? "bg-emerald-700 text-white" : "text-stone-700",
                  )}
                >
                  <TabIcon name={item.icon} className="h-5 w-5" />
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
