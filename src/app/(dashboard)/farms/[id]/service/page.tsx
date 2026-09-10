import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ServiceFarmPicker } from "@/components/serviceForms/ServiceFarmPicker";
import {
  listServiceFormDraftKinds,
  listStoredServiceForms,
  loadServiceFarmContext,
} from "@/lib/serviceForms/farmContext";

type Params = Promise<{ id: string }>;

export default async function ServiceFarmPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const context = await loadServiceFarmContext(id, session.user.id);
  if (!context) notFound();

  const [draftKinds, completed] = await Promise.all([
    listServiceFormDraftKinds(id),
    listStoredServiceForms(id),
  ]);

  return (
    <ServiceFarmPicker farmId={id} draftKinds={draftKinds} completed={completed} />
  );
}
