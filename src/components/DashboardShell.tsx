"use client";

import { cn } from "@/lib/utils";
import { KeypadNavProvider, useKeypadNav } from "@/components/KeypadNavContext";
import { AppNav } from "@/components/AppNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineRoutes } from "@/components/OfflineNav";

function ShellBody({ children }: { children: React.ReactNode }) {
  const { keypadOpen } = useKeypadNav();
  return (
    <div data-app-scroll className="min-h-dvh bg-[#f3efe6]">
      <div
        aria-hidden
        className="sticky top-0 z-[60] bg-white"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <OfflineBanner />
      <AppNav />
      <main
        className={cn(
          "mx-auto max-w-7xl px-4 py-4 md:py-6",
          keypadOpen ? "pb-4" : "pb-28",
        )}
      >
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
