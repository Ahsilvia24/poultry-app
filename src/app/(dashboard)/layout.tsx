import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { OfflineNavProvider } from "@/components/OfflineNavContext";
import { OfflineProvider } from "@/components/OfflineProvider";
import { cookieNamesHaveSessionToken } from "@/lib/session-cookie";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    const jar = await cookies();
    redirect(cookieNamesHaveSessionToken(jar.getAll().map((cookie) => cookie.name)) ? "/login?replaced=1" : "/login");
  }

  return (
    <OfflineProvider>
      <OfflineNavProvider>
        <DashboardShell>{children}</DashboardShell>
      </OfflineNavProvider>
    </OfflineProvider>
  );
}
