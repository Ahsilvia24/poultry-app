import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardHome } from "@/components/DashboardHome";
import { listScheduleImports } from "@/lib/schedule-imports";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let data;
  try {
    data = await getDashboardData(session.user.id);
  } catch {
    data = null;
  }
  let scheduleImports: Awaited<ReturnType<typeof listScheduleImports>> = [];
  try {
    scheduleImports = await listScheduleImports();
  } catch {
    scheduleImports = [];
  }

  return <DashboardHome initial={data} scheduleImports={scheduleImports} />;
}
