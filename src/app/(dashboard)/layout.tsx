import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <DashboardShell>{children}</DashboardShell>;
}
