import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmLitterFormPageClient } from "@/components/FarmLitterFormPageClient";

type Params = Promise<{ id: string; eventId: string }>;

export default async function EditFarmLitterPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, eventId } = await params;
  return <FarmLitterFormPageClient farmId={id} eventId={eventId} />;
}
