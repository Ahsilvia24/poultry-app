"use client";

import { cn } from "@/lib/utils";
import { KeypadNavProvider, useKeypadNav } from "@/components/KeypadNavContext";
import { AppNav } from "@/components/AppNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineRoutes } from "@/components/OfflineNav";

function ShellBody({ children }: { children: React.ReactNode }) {
  const { keypadOpen } = useKeypadNav();
  return (
    <div
      className={cn(
        "min-h-screen bg-[#f3efe6]",
        keypadOpen ? "pb-0" : "pb-28 md:pb-8",
      )}
    >
      <div className="fixed inset-x-0 top-0 z-[60] bg-white">
        <div className="h-[env(safe-area-inset-top,0px)] bg-white" />
        <div className="h-0.5 bg-white" />
      </div>
      <div className="h-[env(safe-area-inset-top,0px)]" />
      <OfflineBanner />
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-4 md:py-6">
        <OfflineRoutes>{children}</OfflineRoutes>
      </main>
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
