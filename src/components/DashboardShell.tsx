"use client";

import { cn } from "@/lib/utils";
import { KeypadNavProvider, useKeypadNav } from "@/components/KeypadNavContext";
import { AppNav } from "@/components/AppNav";

function ShellBody({ children }: { children: React.ReactNode }) {
  const { keypadOpen } = useKeypadNav();
  return (
    <div className={cn("min-h-screen", keypadOpen ? "pb-0" : "pb-24 md:pb-8")}>
      <AppNav />
      <main className="mx-auto max-w-7xl px-3 py-3 md:px-4 md:py-6">{children}</main>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <KeypadNavProvider>
      <ShellBody>{children}</ShellBody>
    </KeypadNavProvider>
  );
}
