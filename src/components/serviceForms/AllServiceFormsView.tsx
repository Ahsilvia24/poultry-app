"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteServiceFormAction, deleteServiceFormsAction } from "@/app/actions/serviceForms";
import { DateKeyField } from "@/components/DateKeyField";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { ReplicaLink } from "@/components/ReplicaLink";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { BackHeader, Button, Card, Label } from "@/components/ui";
import { appTodayKey } from "@/lib/app-calendar";
import { formWrite } from "@/lib/offline/formPairs";
import {
  defaultAllFormsRange,
  filterServiceFormsByDateRange,
  type AllServiceFormRow,
} from "@/lib/offline/selectServiceFarm";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import {
  formatServiceShortDate,
  serviceFormKindHref,
  serviceFormKindTitle,
} from "@/lib/serviceForms/format";
import { shareServiceFormPdf, shareServiceFormsPdf } from "@/lib/serviceForms/sharePdf";
import type { AnyServiceForm } from "@/lib/serviceForms/types";

function formHref(row: AllServiceFormRow) {
  return `/farms/${row.farmId}/service/${serviceFormKindHref(row.formKind)}?formId=${row.id}`;
}

export function AllServiceFormsView({
  rows,
  timeZone,
  fromFarmId,
}: {
  rows: AllServiceFormRow[];
  timeZone?: string | null;
  fromFarmId?: string | null;
}) {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const defaults = defaultAllFormsRange(appTodayKey(undefined, timeZone));
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharingAll, setSharingAll] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AllServiceFormRow | null>(null);
  const [pendingDeleteAll, setPendingDeleteAll] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(
    () => filterServiceFormsByDateRange(rows, from, to),
    [rows, from, to],
  );
  const backHref = fromFarmId ? `/farms/${fromFarmId}/service` : "/farms";
  const busy = pending || sharingAll || Boolean(sharingId);

  function rowForm(row: AllServiceFormRow): AnyServiceForm {
    const payload = row.payload;
    if (!payload || typeof payload !== "object") {
      throw new Error("Could not open this PDF.");
    }
    return {
      ...(payload as AnyServiceForm),
      kind: row.formKind,
    } as AnyServiceForm;
  }

  async function shareSaved(row: AllServiceFormRow) {
    if (busy) return;
    setShareError(null);
    setSharingId(row.id);
    try {
      await shareServiceFormPdf(rowForm(row));
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not share PDF");
    } finally {
      setSharingId(null);
    }
  }

  async function shareVisible() {
    if (busy || visible.length === 0) return;
    setShareError(null);
    setSharingAll(true);
    try {
      await shareServiceFormsPdf(visible.map(rowForm));
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not share PDF");
    } finally {
      setSharingAll(false);
    }
  }

  function runDelete() {
    if (!pendingDelete) return;
    const row = pendingDelete;
    start(async () => {
      if (enabled) {
        queue(formWrite("deleteServiceForm", { id: row.id, farmId: row.farmId }));
        setPendingDelete(null);
        return;
      }
      const result = await deleteServiceFormAction(row.farmId, row.id);
      if (result.error) setDeleteError(result.error);
      setPendingDelete(null);
      router.refresh();
    });
  }

  function runDeleteVisible() {
    if (visible.length === 0) return;
    const formIds = visible.map((row) => row.id);
    start(async () => {
      if (enabled) {
        queue(formWrite("deleteServiceForms", { listFields: { formIds } }));
        setPendingDeleteAll(false);
        return;
      }
      await deleteServiceFormsAction(formIds);
      setPendingDeleteAll(false);
      router.refresh();
    });
  }

  return (
    <div>
      <BackHeader href={backHref} backLabel="Service" title="All Forms" />

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 overflow-hidden">
          <Label htmlFor="all-forms-from">From</Label>
          <DateKeyField
            id="all-forms-from"
            label="From"
            value={from}
            onChange={setFrom}
          />
        </div>
        <div className="min-w-0 overflow-hidden">
          <Label htmlFor="all-forms-to">To</Label>
          <DateKeyField
            id="all-forms-to"
            label="To"
            value={to}
            onChange={setTo}
          />
        </div>
      </div>

      {shareError ? <p className="mt-3 font-semibold text-red-700">{shareError}</p> : null}

      {visible.length === 0 ? (
        <p className="mt-4 text-stone-500">No completed checklists in this date range.</p>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="mt-4 space-y-2.5">
            {visible.map((row) => (
              <SwipeCommitDeleteRow
                key={row.id}
                rowId={row.id}
                onDelete={() => setPendingDelete(row)}
                deleteLabel="Delete"
              >
                <Card className="!py-3">
                  <div className="flex items-center gap-2.5">
                    <ReplicaLink
                      href={formHref(row)}
                      className="min-w-0 flex-1"
                      aria-label={`View or edit ${serviceFormKindTitle(row.formKind)} ${formatServiceShortDate(row.formDate)} at ${row.farmName}`}
                    >
                      <p className="text-base font-extrabold text-stone-900">{row.farmName}</p>
                      <p className="mt-0.5 font-semibold text-stone-500">
                        {serviceFormKindTitle(row.formKind)} · {formatServiceShortDate(row.formDate)}
                      </p>
                    </ReplicaLink>
                    <button
                      type="button"
                      onClick={() => void shareSaved(row)}
                      aria-label={`Share PDF for ${row.farmName} ${serviceFormKindTitle(row.formKind)} ${formatServiceShortDate(row.formDate)}`}
                      className="self-center rounded-lg border-[1.5px] border-emerald-800 px-2.5 py-1.5 text-xs font-bold text-emerald-800"
                    >
                      {sharingId === row.id ? "Sharing…" : "Share PDF"}
                    </button>
                  </div>
                </Card>
              </SwipeCommitDeleteRow>
            ))}
          </div>
        </ExclusiveSwipeGroup>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          disabled={busy || visible.length === 0}
          onClick={() => void shareVisible()}
        >
          {sharingAll ? "Sharing…" : "Share All"}
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={busy || visible.length === 0}
          onClick={() => setPendingDeleteAll(true)}
        >
          Delete All
        </Button>
      </div>

      {pendingDeleteAll ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setPendingDeleteAll(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">Delete these checklists?</h3>
            <p className="mt-2 text-sm text-stone-600">
              This removes the {visible.length} checklist{visible.length === 1 ? "" : "s"} on this
              date range from every farm. Other weeks stay.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="danger" disabled={pending} onClick={runDeleteVisible}>
                {pending ? "Deleting…" : "Delete All"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setPendingDeleteAll(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">
              Delete {serviceFormKindTitle(pendingDelete.formKind)}?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {pendingDelete.farmName} · {formatServiceShortDate(pendingDelete.formDate)} will be
              removed from that farm.
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
            onClick={(event) => event.stopPropagation()}
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
