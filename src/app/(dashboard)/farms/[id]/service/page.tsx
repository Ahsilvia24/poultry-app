import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ServiceFarmPicker } from "@/components/serviceForms/ServiceFarmPicker";

type Params = Promise<{ id: string }>;

export default async function ServiceFarmPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  // Checklists live in this browser. OfflineNav fills drafts from the snapshot.
  return <ServiceFarmPicker farmId={id} draftKinds={[]} completed={[]} />;
}
