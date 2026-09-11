"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteServiceFormAction,
  deleteServiceFormDraftAction,
} from "@/app/actions/serviceForms";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { ReplicaLink } from "@/components/ReplicaLink";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { BackHeader, Button, Card } from "@/components/ui";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import { shareServiceFormPdf } from "@/lib/serviceForms/sharePdf";
import type { StoredServiceForm } from "@/lib/serviceForms/stored";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";

const FORMS = [
  { key: "service_report" as const, tab: "Service", title: "Service", href: "report" },
  { key: "placement" as const, tab: "Placement", title: "Placement", href: "placement" },
  { key: "prebrood" as const, tab: "Prebrood", title: "Prebrood", href: "prebrood" },
] as const;

function kindTitle(kind: ServiceFormKind) {
  return FORMS.find((f) => f.key === kind)?.title ?? kind;
}

function formHref(farmId: string, href: string, extra?: Record<string, string>) {
  const params = new URLSearchParams(extra);
  const q = params.toString();
  return `/farms/${farmId}/service/${href}${q ? `?${q}` : ""}`;
}

export function ServiceFarmPicker({
  farmId,
  draftKinds,
  completed,
}: {
  farmId: string;
  draftKinds: ServiceFormKind[];
  completed: StoredServiceForm[];
}) {
  const router = useRouter();
  const nav = useOfflineNav();
  const { enabled, queue } = useReplicaWrite();
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoredServiceForm | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function startOver(form: (typeof FORMS)[number]) {
    start(async () => {
      if (enabled) {
        queue(formWrite("deleteServiceDraft", { farmId, fields: { formKind: form.key } }));
      } else {
        await deleteServiceFormDraftAction(farmId, form.key);
      }
      const href = formHref(farmId, form.href, { fresh: "1" });
      if (nav) nav.navigate(href);
      else {
        router.push(href);
        router.refresh();
      }
    });
  }

  async function shareSaved(row: StoredServiceForm) {
    if (sharingId) return;
    const payload = row.payload;
    if (!payload || typeof payload !== "object") {
      setShareError("Could not open this PDF.");
      return;
    }
    setShareError(null);
    setSharingId(row.id);
    try {
      await shareServiceFormPdf({
        ...(payload as AnyServiceForm),
        kind: row.formKind,
      } as AnyServiceForm);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Could not share PDF");
    } finally {
      setSharingId(null);
    }
  }

  function runDelete() {
    if (!pendingDelete) return;
    const row = pendingDelete;
    start(async () => {
      if (enabled) {
        queue(formWrite("deleteServiceForm", { id: row.id, farmId }));
        setPendingDelete(null);
        return;
      }
      const result = await deleteServiceFormAction(farmId, row.id);
      if (result.error) setDeleteError(result.error);
      setPendingDelete(null);
      router.refresh();
    });
  }

  return (
    <div>
      <BackHeader href={`/farms/${farmId}`} backLabel="Farm" title="Service Farm" />

      <div className="mb-2.5 flex items-stretch gap-1.5">
        {FORMS.map((form) => (
          <ReplicaLink
            key={form.key}
            href={formHref(farmId, form.href)}
            className="flex min-h-10 flex-1 items-center justify-center rounded-[10px] bg-emerald-700 px-1 py-2.5 text-center text-[13px] font-bold text-white hover:bg-emerald-800"
            aria-label={draftKinds.includes(form.key) ? `Resume ${form.title}` : `Start ${form.title}`}
          >
            {form.tab}
          </ReplicaLink>
        ))}
      </div>

      {FORMS.filter((form) => draftKinds.includes(form.key)).map((form) => (
        <div key={`draft-${form.key}`} className="mb-1.5 flex items-center justify-between">
          <p className="font-semibold text-stone-500">{form.title} in progress</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => startOver(form)}
            className="font-bold text-emerald-800"
            aria-label={`Start over ${form.title}`}
          >
            Start over
          </button>
        </div>
      ))}

      <h2 className="mb-2 mt-3.5 text-base font-extrabold text-stone-900">Completed</h2>

      {shareError ? <p className="mb-2 font-semibold text-red-700">{shareError}</p> : null}

      {completed.length === 0 ? (
        <p className="text-stone-500">No completed checklists yet.</p>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="space-y-2.5">
            {completed.map((row) => {
              const form = FORMS.find((f) => f.key === row.formKind);
              return (
                <SwipeCommitDeleteRow
                  key={row.id}
                  rowId={row.id}
                  onDelete={() => setPendingDelete(row)}
                  deleteLabel="Delete"
                >
                  <Card className="!py-3">
                    <div className="flex items-center gap-2.5">
                      <ReplicaLink
                        href={form ? formHref(farmId, form.href, { formId: row.id }) : "#"}
                        className="min-w-0 flex-1"
                        aria-label={`View or edit ${kindTitle(row.formKind)} ${formatServiceShortDate(row.formDate)}`}
                      >
                        <p className="text-base font-extrabold text-stone-900">
                          {kindTitle(row.formKind)}
                        </p>
                        <p className="mt-0.5 font-semibold text-stone-500">
                          {formatServiceShortDate(row.formDate)}
                        </p>
                      </ReplicaLink>
                      <button
                        type="button"
                        onClick={() => void shareSaved(row)}
                        aria-label={`Share PDF for ${kindTitle(row.formKind)} ${formatServiceShortDate(row.formDate)}`}
                        className="self-center rounded-lg border-[1.5px] border-emerald-800 px-2.5 py-1.5 text-xs font-bold text-emerald-800"
                      >
                        {sharingId === row.id ? "Sharing…" : "Share PDF"}
                      </button>
                    </div>
                  </Card>
                </SwipeCommitDeleteRow>
              );
            })}
          </div>
        </ExclusiveSwipeGroup>
      )}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">
              Delete {kindTitle(pendingDelete.formKind)}?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {formatServiceShortDate(pendingDelete.formDate)} will be removed from this farm.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="danger" disabled={pending} onClick={runDelete}>
                {pending ? "Deleting…" : "Delete"}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteError ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setDeleteError(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">Error</h3>
            <p className="mt-2 text-sm text-stone-600">{deleteError}</p>
            <div className="mt-5">
              <Button type="button" onClick={() => setDeleteError(null)}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
