"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deleteVisitAction } from "@/app/actions/ops";
import { DeleteRecordButton, EditRecordButton } from "@/components/DeleteRecordButton";
import { FarmVisitForm, type VisitFormValues } from "@/components/FarmOpsForms";
import { Card } from "@/components/ui";
import { VISIT_TYPE_LABELS } from "@/lib/utils";

type VisitRow = VisitFormValues & {
  id: string;
};

function visitsHashActive() {
  return typeof window !== "undefined" && window.location.hash === "#visits";
}

export function FarmVisitsSection({
  farmId,
  flockId,
  visits,
}: {
  farmId: string;
  flockId?: string;
  visits: VisitRow[];
}) {
  const [open, setOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  function closeSection() {
    setOpen(false);
    setLogOpen(false);
    setEditingId(null);
    if (visitsHashActive()) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

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
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">Recent visits</h3>
          <button
            type="button"
            onClick={closeSection}
            className="text-sm font-semibold text-stone-500 hover:text-stone-800"
          >
            Close
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {visits.length === 0 ? <li className="text-stone-500">None yet</li> : null}
          {visits.map((v) => (
            <li key={v.id} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-semibold">
                    {format(new Date(v.visitDate + "T12:00:00"), "MMM d, yyyy")}
                  </span>
                  {" — "}
                  {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                  {v.followUpRequired ? (
                    <span className="ml-2 text-amber-700">Follow-up due</span>
                  ) : null}
                  {v.notes ? <p className="text-stone-600">{v.notes}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <EditRecordButton
                    label="Edit visit"
                    active={editingId === v.id}
                    onClick={() => {
                      setLogOpen(false);
                      setEditingId((id) => (id === v.id ? null : v.id));
                    }}
                  />
                  <DeleteRecordButton
                    label="Delete visit"
                    onDelete={() => deleteVisitAction(farmId, v.id)}
                  />
                </div>
              </div>
              {editingId === v.id ? (
                <FarmVisitForm
                  farmId={farmId}
                  flockId={flockId}
                  recordId={v.id}
                  initial={v}
                  onSuccess={afterVisitSaved}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {!logOpen ? (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setLogOpen(true);
          }}
          className="mt-3 text-sm text-emerald-800 hover:underline"
        >
          Log visit
        </button>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setLogOpen(false)}
            className="text-sm text-emerald-800 hover:underline"
          >
            Log visit
          </button>
          <Card className="mt-3">
            <FarmVisitForm
              farmId={farmId}
              flockId={flockId}
              onSuccess={afterVisitSaved}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
