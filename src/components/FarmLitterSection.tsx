"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { deleteLitterEventAction } from "@/app/actions/ops";
import { EditRecordButton } from "@/components/DeleteRecordButton";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { LitterEventForm, type LitterFormValues } from "@/components/FarmOpsForms";
import { FarmLogSectionHeader, FarmLogSectionTop } from "@/components/FarmLogSectionChrome";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { Card } from "@/components/ui";
import { LITTER_EVENT_LABELS } from "@/lib/utils";

type LitterRow = LitterFormValues & {
  id: string;
  houseNumber: number | null;
};

function litterHashActive() {
  return typeof window !== "undefined" && window.location.hash === "#litter";
}

export function FarmLitterSection({
  farmId,
  houses,
  events,
}: {
  farmId: string;
  houses: Array<{ id: string; houseNumber: number }>;
  events: LitterRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  useEffect(() => {
    if (litterHashActive()) setOpen(true);

    function onHashChange() {
      if (litterHashActive()) {
        setOpen(true);
        setFormOpen(false);
        setEditingId(null);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function afterEventSaved() {
    setFormOpen(false);
    setEditingId(null);
    setOpen(true);
    if (!litterHashActive()) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#litter`,
      );
    }
  }

  if (!open) return <div id="litter" className="scroll-mt-24" />;

  return (
    <div id="litter" className="scroll-mt-24">
      <FarmLogSectionHeader
        title="Litter Events"
        logLabel="Log Litter"
        onLog={() => {
          setEditingId(null);
          setFormOpen((open) => !open);
        }}
      />
      <ExclusiveSwipeGroup>
      <ul className="space-y-0.5 text-base">
        {events.length === 0 ? <li className="text-stone-500">None yet</li> : null}
        {events.map((e) => (
          <li key={e.id} className="border-b border-stone-100 py-0.5 last:border-0">
            <SwipeCommitDeleteRow
              rowId={e.id}
              transparent
              onDelete={() => {
                startDelete(async () => {
                  await deleteLitterEventAction(farmId, e.id);
                  router.refresh();
                });
              }}
            >
              <div className="flex min-h-[38px] items-center justify-between gap-3 py-1">
                <div className="min-w-0">
                  <span className="font-semibold">
                    {format(new Date(e.eventDate + "T12:00:00"), "MMM d, yyyy")}
                  </span>
                  {" — "}
                  {LITTER_EVENT_LABELS[e.eventType] ?? e.eventType}
                  {e.houseNumber != null ? ` · House ${e.houseNumber}` : ""}
                  {e.notes ? <p className="text-stone-600">{e.notes}</p> : null}
                </div>
                <EditRecordButton
                  label="Edit litter event"
                  active={editingId === e.id}
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId((id) => (id === e.id ? null : e.id));
                  }}
                />
              </div>
            </SwipeCommitDeleteRow>
            {editingId === e.id ? (
              <LitterEventForm
                farmId={farmId}
                houses={houses}
                recordId={e.id}
                initial={e}
                onSuccess={afterEventSaved}
              />
            ) : null}
          </li>
        ))}
      </ul>
      </ExclusiveSwipeGroup>

      {formOpen ? (
        <Card className="mt-3">
          <LitterEventForm
            farmId={farmId}
            houses={houses}
            onSuccess={afterEventSaved}
          />
        </Card>
      ) : null}
      <FarmLogSectionTop />
    </div>
  );
}
