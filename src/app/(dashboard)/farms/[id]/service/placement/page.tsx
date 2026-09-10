import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PlacementFormView } from "@/components/serviceForms/PlacementFormView";
import {
  getServiceFormDraftPayload,
  getStoredServiceForm,
  loadServiceFarmContext,
} from "@/lib/serviceForms/farmContext";
import type { PlacementForm } from "@/lib/serviceForms/types";

type Params = Promise<{ id: string }>;
type Search = Promise<{ formId?: string; visitId?: string; fresh?: string }>;

export default async function PlacementChecklistPage({
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
  const context = await loadServiceFarmContext(id, session.user.id);
  if (!context) notFound();

  const existing = await getStoredServiceForm(id, {
    kind: "placement",
    formId: query.formId,
    visitId: query.visitId,
  });
  const fresh = query.fresh === "1";
  const draftPayload =
    !existing && !fresh ? await getServiceFormDraftPayload(id, "placement") : null;
  const draft =
    draftPayload && typeof draftPayload === "object" && (draftPayload as { kind?: string }).kind === "placement"
      ? (draftPayload as PlacementForm)
      : null;

  return (
    <PlacementFormView
      farmId={id}
      context={context}
      existing={existing}
      draft={draft}
      fresh={fresh}
    />
  );
}
