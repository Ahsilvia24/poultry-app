import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { OfflineProvider } from "@/components/OfflineProvider";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <OfflineProvider>
      <DashboardShell>{children}</DashboardShell>
    </OfflineProvider>
  );
}
