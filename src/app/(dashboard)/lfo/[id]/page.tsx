import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackHeader, Card } from "@/components/ui";

type Params = Promise<{ id: string }>;

export default async function EditLfoPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await params;

  // LFOs live in this browser. OfflineNav fills the form from the snapshot.
  return (
    <div>
      <BackHeader href="/lfo" backLabel="LFOs" title="Last Feed Order" />
      <Card>
        <p className="text-sm text-stone-600">Opening Last Feed Order…</p>
      </Card>
    </div>
  );
}
