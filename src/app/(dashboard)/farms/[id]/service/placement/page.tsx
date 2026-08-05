import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageTitleBackLink } from "@/components/PageTitleBackLink";
import { PlacementForm } from "@/components/serviceForms/PlacementForm";
import { PAGE_TITLE_CLASS } from "@/components/ui";
import {
  getServiceFormById,
  getServiceFormForVisit,
  loadServiceFarmDetail,
} from "@/lib/serviceForms/loadFarmDetail";
import type { PlacementForm as PlacementFormData } from "@/lib/serviceForms/types";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ formId?: string; visitId?: string }>;

export default async function PlacementServicePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const detail = await loadServiceFarmDetail(id, session.user.id);
  if (!detail) notFound();

  let existing = sp.formId
    ? await getServiceFormById(id, sp.formId)
    : sp.visitId
      ? await getServiceFormForVisit(id, sp.visitId)
      : null;
  if (existing && existing.formKind !== "placement") existing = null;

  const initialPayload =
    existing?.payload && typeof existing.payload === "object"
      ? (existing.payload as PlacementFormData)
      : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageTitleBackLink href={`/farms/${id}/service`} label="Service" />
        <h1 className={cn(PAGE_TITLE_CLASS, "min-w-0 truncate text-right")}>
          {existing ? "Edit Placement" : "Placement Checklist"}
        </h1>
      </div>
      <p className="mb-4 text-sm text-stone-600">{detail.farm.farmName}</p>
      <PlacementForm
        farmId={id}
        detail={detail}
        initialPayload={initialPayload}
        serviceFormId={existing?.id ?? null}
        existingVisitId={existing ? null : sp.visitId ?? null}
      />
    </div>
  );
}
