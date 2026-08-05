"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deleteLitterEventAction } from "@/app/actions/ops";
import { LitterEventForm, type LitterFormValues } from "@/components/FarmOpsForms";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
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

  function closeSection() {
    setOpen(false);
    setFormOpen(false);
    setEditingId(null);
    if (litterHashActive()) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

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
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">Litter events</h3>
          <button
            type="button"
            onClick={closeSection}
            className="text-sm font-semibold text-stone-500 hover:text-stone-800"
          >
            Close
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {events.length === 0 ? <li className="text-stone-500">None yet</li> : null}
          {events.map((e) => (
            <li key={e.id} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0">
              <SwipeToDeleteRow
                deleteLabel="Delete litter event"
                editLabel="Edit litter event"
                confirmMessage="Delete this litter event? This cannot be undone."
                onEdit={() => {
                  setFormOpen(false);
                  setEditingId((id) => (id === e.id ? null : e.id));
                }}
                onDelete={() => deleteLitterEventAction(farmId, e.id)}
              >
                <div className="min-w-0 py-0.5">
                  <span className="font-semibold">
                    {format(new Date(e.eventDate + "T12:00:00"), "MMM d, yyyy")}
                  </span>
                  {" — "}
                  {LITTER_EVENT_LABELS[e.eventType] ?? e.eventType}
                  {e.houseNumber != null ? ` · House ${e.houseNumber}` : ""}
                  {e.notes ? <p className="text-stone-600">{e.notes}</p> : null}
                </div>
              </SwipeToDeleteRow>
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
      </Card>

      {!formOpen ? (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
          className="mt-3 text-sm text-emerald-800 hover:underline"
        >
          Record litter event
        </button>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-sm text-emerald-800 hover:underline"
          >
            Record litter event
          </button>
          <Card className="mt-3">
            <LitterEventForm
              farmId={farmId}
              houses={houses}
              onSuccess={afterEventSaved}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
