"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { LitterEventForm } from "@/components/FarmOpsForms";
import { Card } from "@/components/ui";
import { LITTER_EVENT_LABELS } from "@/lib/utils";

type LitterRow = {
  id: string;
  eventDate: string;
  eventType: string;
  houseNumber: number | null;
  notes: string | null;
};

export function FarmLitterSection({
  farmId,
  houses,
  events,
}: {
  farmId: string;
  houses: Array<{ id: string; houseNumber: number }>;
  events: LitterRow[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#litter") setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div id="litter" className="scroll-mt-24">
      {open ? (
        <Card>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold">Litter events</h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (window.location.hash === "#litter") {
                  history.replaceState(null, "", window.location.pathname + window.location.search);
                }
              }}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {events.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {events.map((e) => (
              <li key={e.id} className="border-b border-stone-100 pb-2">
                <span className="font-semibold">
                  {format(new Date(e.eventDate + "T12:00:00"), "MMM d, yyyy")}
                </span>
                {" — "}
                {LITTER_EVENT_LABELS[e.eventType] ?? e.eventType}
                {e.houseNumber != null ? ` · House ${e.houseNumber}` : ""}
                {e.notes ? <p className="text-stone-600">{e.notes}</p> : null}
              </li>
            ))}
          </ul>
          <h4 className="mt-6 font-bold">Record litter event</h4>
          <LitterEventForm farmId={farmId} houses={houses} />
        </Card>
      ) : null}
    </div>
  );
}
