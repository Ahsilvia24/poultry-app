"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { FarmVisitForm } from "@/components/FarmOpsForms";
import { Card } from "@/components/ui";
import { VISIT_TYPE_LABELS } from "@/lib/utils";

type VisitRow = {
  id: string;
  visitDate: string;
  visitType: string;
  followUpRequired: boolean;
  notes: string | null;
};

export function FarmVisitsSection({
  farmId,
  flockId,
  visits,
}: {
  farmId: string;
  flockId?: string;
  visits: VisitRow[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#visits") setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div id="visits" className="scroll-mt-24">
      {open ? (
        <Card>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold">Recent visits</h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (window.location.hash === "#visits") {
                  history.replaceState(null, "", window.location.pathname + window.location.search);
                }
              }}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {visits.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {visits.map((v) => (
              <li key={v.id} className="border-b border-stone-100 pb-2">
                <span className="font-semibold">
                  {format(new Date(v.visitDate + "T12:00:00"), "MMM d, yyyy")}
                </span>
                {" — "}
                {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                {v.followUpRequired ? (
                  <span className="ml-2 text-amber-700">Follow-up due</span>
                ) : null}
                {v.notes ? <p className="text-stone-600">{v.notes}</p> : null}
              </li>
            ))}
          </ul>
          <h4 className="mt-6 font-bold">Log visit</h4>
          <FarmVisitForm farmId={farmId} flockId={flockId} />
        </Card>
      ) : null}
    </div>
  );
}
