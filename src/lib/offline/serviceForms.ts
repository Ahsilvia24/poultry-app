import { isLocalRecordId } from "@/lib/offline/formPairs";
import type { OfflineServiceForm, OfflineServiceFormDraft, OfflineSnapshot, OfflineVisit } from "@/lib/offline/types";
import { isServiceFormKind } from "@/lib/serviceForms/stored";

function draftKey(row: { farmId: string; formKind: string }) {
  return `${row.farmId}|${row.formKind}`;
}

function sameSavedForm(a: OfflineServiceForm, b: OfflineServiceForm) {
  return (
    a.id === b.id ||
    (a.farmId === b.farmId &&
      a.formKind === b.formKind &&
      a.formDate === b.formDate &&
      a.createdAt === b.createdAt)
  );
}

/** Drop a server draft that the phone already finished, and keep local completed checklists. */
export function seedAndMergeServiceForms(
  snapshot: OfflineSnapshot,
  previous?: OfflineSnapshot | null,
): OfflineSnapshot {
  if (!previous) return snapshot;

  const prevForms = previous.serviceForms ?? [];
  const prevDraftKeys = new Set((previous.serviceFormDrafts ?? []).map(draftKey));
  const finishedKeys = new Set(
    prevForms
      .filter((row) => isServiceFormKind(row.formKind) && !prevDraftKeys.has(draftKey(row)))
      .map(draftKey),
  );

  const incomingDrafts = snapshot.serviceFormDrafts ?? [];
  const serviceFormDrafts: OfflineServiceFormDraft[] = incomingDrafts.filter(
    (row) => !finishedKeys.has(draftKey(row)),
  );
  const incomingDraftKeys = new Set(serviceFormDrafts.map(draftKey));
  for (const row of previous.serviceFormDrafts ?? []) {
    const key = draftKey(row);
    if (incomingDraftKeys.has(key) || finishedKeys.has(key)) continue;
    incomingDraftKeys.add(key);
    serviceFormDrafts.push(row);
  }

  const incomingForms = snapshot.serviceForms ?? [];
  const extraForms = prevForms.filter((row) => {
    if (incomingForms.some((item) => sameSavedForm(item, row))) return false;
    if (isLocalRecordId(row.id)) {
      return !incomingForms.some(
        (item) =>
          item.farmId === row.farmId &&
          item.formKind === row.formKind &&
          item.formDate === row.formDate,
      );
    }
    return true;
  });
  const serviceForms = [...incomingForms, ...extraForms];

  const incomingVisitIds = new Set((snapshot.visits ?? []).map((row) => row.id));
  const extraVisits: OfflineVisit[] = [];
  for (const form of extraForms) {
    if (!form.visitId || incomingVisitIds.has(form.visitId)) continue;
    const visit = (previous.visits ?? []).find((row) => row.id === form.visitId);
    if (!visit) continue;
    incomingVisitIds.add(visit.id);
    extraVisits.push(visit);
  }

  return {
    ...snapshot,
    serviceForms,
    serviceFormDrafts,
    visits: extraVisits.length ? [...(snapshot.visits ?? []), ...extraVisits] : snapshot.visits,
  };
}
