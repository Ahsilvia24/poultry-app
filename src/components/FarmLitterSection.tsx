"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deleteLitterEventAction } from "@/app/actions/ops";
import { DeleteRecordButton, EditRecordButton } from "@/components/DeleteRecordButton";
import { LitterEventForm, type LitterFormValues } from "@/components/FarmOpsForms";
import { FarmLogSectionHeader, FarmLogSectionTop } from "@/components/FarmLogSectionChrome";
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
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      <ul className="space-y-2 text-sm">
        {events.length === 0 ? <li className="text-stone-500">None yet</li> : null}
        {events.map((e) => (
          <li key={e.id} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-semibold">
                  {format(new Date(e.eventDate + "T12:00:00"), "MMM d, yyyy")}
                </span>
                {" — "}
                {LITTER_EVENT_LABELS[e.eventType] ?? e.eventType}
                {e.houseNumber != null ? ` · House ${e.houseNumber}` : ""}
                {e.notes ? <p className="text-stone-600">{e.notes}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <EditRecordButton
                  label="Edit litter event"
                  active={editingId === e.id}
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId((id) => (id === e.id ? null : e.id));
                  }}
                />
                <DeleteRecordButton
                  label="Delete litter event"
                  onDelete={() => deleteLitterEventAction(farmId, e.id)}
                />
              </div>
            </div>
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
