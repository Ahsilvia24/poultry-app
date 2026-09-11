import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LfoPageClient } from "@/components/LfoPageClient";

type SearchParams = Promise<{ farmId?: string }>;

export default async function LfoPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = searchParams ? await searchParams : {};
  return <LfoPageClient initialFarmId={typeof sp.farmId === "string" ? sp.farmId : undefined} />;
}
