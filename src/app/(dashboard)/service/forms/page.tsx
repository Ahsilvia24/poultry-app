import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AllServiceFormsPageClient } from "@/components/serviceForms/AllServiceFormsPageClient";

type Search = Promise<{ fromFarm?: string }>;

export default async function AllServiceFormsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = await searchParams;
  return <AllServiceFormsPageClient fromFarmId={params.fromFarm ?? null} />;
}
