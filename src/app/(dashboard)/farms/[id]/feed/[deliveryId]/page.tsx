import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FarmFeedFormPageClient } from "@/components/FarmFeedFormPageClient";

type Params = Promise<{ id: string; deliveryId: string }>;

export default async function EditFarmFeedPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, deliveryId } = await params;
  return <FarmFeedFormPageClient farmId={id} deliveryId={deliveryId} />;
}
