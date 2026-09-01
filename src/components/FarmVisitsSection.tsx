"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { deleteVisitAction } from "@/app/actions/ops";
import { EditRecordButton } from "@/components/DeleteRecordButton";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { FarmVisitForm, type VisitFormValues } from "@/components/FarmOpsForms";
import { FarmLogSectionHeader, FarmLogSectionTop } from "@/components/FarmLogSectionChrome";
import { Card } from "@/components/ui";
import { VISIT_TYPE_LABELS } from "@/lib/utils";

type VisitRow = VisitFormValues & {
  id: string;
};

function visitsHashActive() {
  return typeof window !== "undefined" && window.location.hash === "#visits";
}

/** Two lines of visit comments, then two dots. */
function clipVisitNotes(notes: string) {
  const lines = notes.replace(/\r\n/g, "\n").split("\n");
  const firstTwo = lines.slice(0, 2).join("\n").trimEnd();
  if (lines.length > 2) return `${firstTwo}..`;
  const flat = firstTwo.replace(/\s+/g, " ");
  if (flat.length > 80) return `${flat.slice(0, 80).trimEnd()}..`;
  return firstTwo;
}

export function FarmVisitsSection({
  farmId,
  flockId,
  placementDate,
  visits,
}: {
  farmId: string;
  flockId?: string;
  placementDate?: string | null;
  visits: VisitRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  useEffect(() => {
    if (visitsHashActive()) setOpen(true);

    function onHashChange() {
      if (visitsHashActive()) {
        setOpen(true);
        setLogOpen(false);
        setEditingId(null);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function afterVisitSaved() {
    setLogOpen(false);
    setEditingId(null);
    setOpen(true);
    if (!visitsHashActive()) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#visits`,
      );
    }
  }

  if (!open) return <div id="visits" className="scroll-mt-24" />;

  return (
    <div id="visits" className="scroll-mt-24">
      <FarmLogSectionHeader
        title="Recent Visits"
        logLabel="Log Visit"
        onLog={() => {
          setEditingId(null);
          setLogOpen((open) => !open);
        }}
      />
      <ExclusiveSwipeGroup>
        <ul className="space-y-0.5 text-base">
          {visits.length === 0 ? <li className="text-stone-500">None yet</li> : null}
          {visits.map((v) => (
            <li key={v.id} className="border-b border-stone-100 py-0.5 last:border-0">
              <SwipeCommitDeleteRow
                rowId={v.id}
                transparent
                onDelete={() => {
                  startDelete(async () => {
                    await deleteVisitAction(farmId, v.id);
                    router.refresh();
                  });
                }}
              >
                <div className="flex min-h-[38px] items-center justify-between gap-3 py-1">
                  <div className="min-w-0">
                    <span className="font-semibold">
                      {format(new Date(v.visitDate + "T12:00:00"), "MMM d, yyyy")}
                    </span>
                    {" — "}
                    {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                    {v.followUpRequired ? (
                      <span className="ml-2 text-amber-700">Follow-up due</span>
                    ) : null}
                    {v.notes ? (
                      <p className="max-h-11 overflow-hidden break-words text-stone-600">
                        {clipVisitNotes(v.notes)}
                      </p>
                    ) : null}
                  </div>
                  <EditRecordButton
                    label="Edit visit"
                    active={editingId === v.id}
                    onClick={() => {
                      setLogOpen(false);
                      setEditingId((id) => (id === v.id ? null : v.id));
                    }}
                  />
                </div>
              </SwipeCommitDeleteRow>
              {editingId === v.id ? (
                <FarmVisitForm
                  farmId={farmId}
                  flockId={flockId}
                  placementDate={placementDate}
                  recordId={v.id}
                  initial={v}
                  onSuccess={afterVisitSaved}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </ExclusiveSwipeGroup>

      {logOpen ? (
        <Card className="mt-3">
          <FarmVisitForm
            farmId={farmId}
            flockId={flockId}
            placementDate={placementDate}
            onSuccess={afterVisitSaved}
          />
        </Card>
      ) : null}
      <FarmLogSectionTop />
    </div>
  );
}
