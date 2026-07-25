"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { FeedDeliveryForm, type FeedFarmOption } from "@/components/FeedDeliveryForm";
import { Card } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

type DeliveryRow = {
  id: string;
  deliveryDate: string;
  poundsDelivered: number;
  houseNumber: number | null;
  feedType: string | null;
};

export function FarmFeedSection({
  farmId,
  farms,
  deliveries,
}: {
  farmId: string;
  farms: FeedFarmOption[];
  deliveries: DeliveryRow[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#feed") setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div id="feed" className="scroll-mt-24">
      {open ? (
        <Card>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold">Feed deliveries</h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (window.location.hash === "#feed") {
                  history.replaceState(null, "", window.location.pathname + window.location.search);
                }
              }}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {deliveries.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {deliveries.map((d) => (
              <li key={d.id} className="border-b border-stone-100 pb-2">
                <span className="font-semibold">
                  {format(new Date(d.deliveryDate + "T12:00:00"), "MMM d, yyyy")}
                </span>
                {" — "}
                {formatNumber(d.poundsDelivered)} lbs
                {d.houseNumber != null ? ` · House ${d.houseNumber}` : " · Flock-level"}
                {d.feedType ? ` · ${d.feedType}` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <FeedDeliveryForm lockedFarmId={farmId} farms={farms} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
