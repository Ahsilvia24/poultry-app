import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { OfflineNavProvider } from "@/components/OfflineNavContext";
import { OfflineProvider } from "@/components/OfflineProvider";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <OfflineProvider>
      <OfflineNavProvider>
        <DashboardShell>{children}</DashboardShell>
      </OfflineNavProvider>
    </OfflineProvider>
  );
}
