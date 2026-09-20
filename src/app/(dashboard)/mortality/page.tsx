import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

type SearchParams = Promise<{ farmId?: string; houseFlockId?: string }>;

export default async function MortalityPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await searchParams;

  // Mortality lives in this browser. OfflineNav fills the form from the snapshot.
  return (
    <div>
      <PageHeader title="Mortality Entry" />
      <p className="text-stone-600">Add an active farm with a flock to enter mortality.</p>
    </div>
  );
}
