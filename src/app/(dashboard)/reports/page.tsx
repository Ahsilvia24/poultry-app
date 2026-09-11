import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ReportsPageClient } from "@/components/ReportsPageClient";

type SearchParams = Promise<{
  farmId?: string;
  from?: string;
  to?: string;
  type?: string;
}>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = await searchParams;
  return (
    <ReportsPageClient
      type={params.type}
      farmId={params.farmId}
      from={params.from}
      to={params.to}
    />
  );
}
