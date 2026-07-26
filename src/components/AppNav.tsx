"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions/auth";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/farms", label: "Farms" },
  { href: "/mortality", label: "Mortality" },
  { href: "/lfo", label: "LFO" },
  { href: "/tools", label: "Tools" },
  { href: "/settlement", label: "Settlement" },
  { href: "/reports", label: "Reports" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

export function AppNav({ userName }: { userName?: string | null }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#f7f4ef]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
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
          <div className="flex items-center gap-3 md:ml-auto">
            <span className="hidden text-sm text-stone-600 sm:inline">{userName}</span>
            <form action={signOutAction}>
              <button type="submit" className="text-sm font-semibold text-stone-700 underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white md:hidden">
        <div className="grid grid-cols-5 gap-1 px-1 py-2">
          {nav.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-1 py-3 text-center text-xs font-bold leading-tight sm:text-sm",
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "bg-emerald-700 text-white"
                  : "text-stone-700",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
