import { auth } from "@/lib/auth";
import { DashboardHome } from "@/components/DashboardHome";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Farms live in this browser. Do not read Prisma on first paint.
  return <DashboardHome initial={null} scheduleImports={[]} />;
}
