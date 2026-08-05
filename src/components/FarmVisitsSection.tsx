"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deleteVisitAction } from "@/app/actions/ops";
import { FarmVisitForm, type VisitFormValues } from "@/components/FarmOpsForms";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
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
  placementDate,
  visits,
}: {
  farmId: string;
  flockId?: string;
  placementDate?: string | null;
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

  function goToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            onClick={goToTop}
            className="text-sm font-semibold text-stone-500 hover:text-stone-800"
          >
            Top
          </button>
        </div>
        <ul className="mt-3 space-y-3 text-base">
          {visits.length === 0 ? <li className="text-stone-500">None yet</li> : null}
          {visits.map((v) => (
            <li key={v.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
              <SwipeToDeleteRow
                deleteLabel="Delete visit"
                editLabel="Edit visit"
                confirmMessage="Delete this visit? This cannot be undone."
                onEdit={() => {
                  setLogOpen(false);
                  setEditingId((id) => (id === v.id ? null : v.id));
                }}
                onDelete={() => deleteVisitAction(farmId, v.id)}
              >
                <div
                  className={`min-w-0 py-0.5 ${editingId === v.id ? "text-emerald-900" : ""}`}
                >
                  <p className="leading-snug">
                    <span className="font-bold">
                      {format(new Date(v.visitDate + "T12:00:00"), "MMM d, yyyy")}
                    </span>
                    {" — "}
                    <span className="font-semibold text-stone-800">
                      {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                    </span>
                    {v.followUpRequired ? (
                      <span className="ml-2 font-semibold text-amber-700">Follow-up due</span>
                    ) : null}
                  </p>
                  {v.notes ? <p className="mt-1 text-[15px] text-stone-600">{v.notes}</p> : null}
                </div>
              </SwipeToDeleteRow>
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
              placementDate={placementDate}
              onSuccess={afterVisitSaved}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
