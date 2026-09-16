import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmDetailClient } from "@/components/FarmDetailClient";

type Params = Promise<{ id: string }>;
type Search = Promise<{ focusHouseFlockId?: string; focusHouseId?: string }>;

export default async function FarmDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const query = await searchParams;
  return (
    <FarmDetailClient
      farmId={id}
      focusHouseFlockId={query.focusHouseFlockId}
      focusHouseId={query.focusHouseId}
    />
  );
}
