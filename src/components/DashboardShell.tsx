"use client";

import { KeypadNavProvider } from "@/components/KeypadNavContext";
import { AppNav } from "@/components/AppNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineRoutes } from "@/components/OfflineNav";

function ShellBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#f3efe6]">
      <div
        aria-hidden
        className="shrink-0 bg-white"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <OfflineBanner />
      <main
        data-app-scroll
        className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto overscroll-none px-4 pt-4 md:pt-6"
      >
        <OfflineRoutes>{children}</OfflineRoutes>
      </main>
      <AppNav />
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
