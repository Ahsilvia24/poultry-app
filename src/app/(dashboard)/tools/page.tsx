import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ToolsPageClient } from "@/components/ToolsPageClient";

type SearchParams = Promise<{ farmId?: string }>;

export default async function ToolsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = searchParams ? await searchParams : {};
  return <ToolsPageClient initialFarmId={typeof sp.farmId === "string" ? sp.farmId : undefined} />;
}
