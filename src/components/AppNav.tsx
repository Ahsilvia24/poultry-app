"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DashboardTabIcon,
  FarmsTabIcon,
  LfoTabIcon,
  MortalityTabIcon,
  ToolsTabIcon,
} from "@/components/TabIcons";

const nav = [
  { href: "/", label: "Dashboard", Icon: DashboardTabIcon },
  { href: "/farms", label: "Farms", Icon: FarmsTabIcon },
  { href: "/mortality", label: "Mortality", Icon: MortalityTabIcon },
  { href: "/lfo", label: "LFO", Icon: LfoTabIcon },
  { href: "/tools", label: "Tools", Icon: ToolsTabIcon },
  { href: "/settlement", label: "Settlement" },
  { href: "/reports", label: "Reports" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#f7f4ef]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-base font-semibold",
                  pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white md:hidden">
        <div className="grid grid-cols-5 gap-1 px-1 py-2">
          {nav.slice(0, 5).map((item) => {
            const Icon = "Icon" in item ? item.Icon : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center text-[11px] font-bold leading-tight sm:text-xs",
                  pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                    ? "bg-emerald-700 text-white"
                    : "text-stone-700",
                )}
              >
                {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
