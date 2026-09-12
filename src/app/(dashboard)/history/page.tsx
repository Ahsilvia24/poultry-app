import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmHistoryPageClient } from "@/components/FarmHistoryPageClient";

type SearchParams = Promise<{ farmId?: string }>;

export default async function FarmHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = await searchParams;
  return <FarmHistoryPageClient farmId={params.farmId} />;
}
