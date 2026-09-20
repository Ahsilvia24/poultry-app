import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackHeader, Card } from "@/components/ui";

export default async function NewLfoFarmSelectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Farms live in this browser. OfflineNav fills the picker from the snapshot.
  return (
    <div>
      <BackHeader href="/lfo" backLabel="LFOs" title="New LFO" />
      <Card>
        <p className="text-sm text-stone-600">
          No farms with an active flock and houses. Add a flock on a farm first.
        </p>
      </Card>
    </div>
  );
}
