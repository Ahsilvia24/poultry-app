"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deleteFeedDeliveryAction } from "@/app/actions/ops";
import {
  FeedDeliveryForm,
  type FeedDeliveryFormValues,
  type FeedFarmOption,
} from "@/components/FeedDeliveryForm";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
import { Card } from "@/components/ui";
import { formatFeedMillShort, formatPoundsK } from "@/lib/utils";

type DeliveryRow = FeedDeliveryFormValues & {
  id: string;
  houseNumber: number | null;
};

function feedHashActive() {
  return typeof window !== "undefined" && window.location.hash === "#feed";
}

export function FarmFeedSection({
  farmId,
  farms,
  deliveries,
}: {
  farmId: string;
  farms: FeedFarmOption[];
  deliveries: DeliveryRow[];
}) {
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (feedHashActive()) setOpen(true);

    function onHashChange() {
      if (feedHashActive()) {
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
    if (feedHashActive()) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  function afterSaved() {
    setFormOpen(false);
    setEditingId(null);
    setOpen(true);
    if (!feedHashActive()) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#feed`,
      );
    }
  }

  if (!open) return <div id="feed" className="scroll-mt-24" />;

  return (
    <div id="feed" className="scroll-mt-24">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">Feed deliveries</h3>
          <button
            type="button"
            onClick={closeSection}
            className="text-sm font-semibold text-stone-500 hover:text-stone-800"
          >
            Close
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {deliveries.length === 0 ? <li className="text-stone-500">None yet</li> : null}
          {deliveries.map((d) => (
            <li key={d.id} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0">
              <SwipeToDeleteRow
                deleteLabel="Delete feed delivery"
                editLabel="Edit feed delivery"
                confirmMessage="Delete this feed delivery? This cannot be undone."
                onEdit={() => {
                  setFormOpen(false);
                  setEditingId((id) => (id === d.id ? null : d.id));
                }}
                onDelete={() => deleteFeedDeliveryAction(d.id)}
              >
                <div className="min-w-0 py-0.5">
                  <span className="font-semibold">
                    {format(new Date(d.deliveryDate + "T12:00:00"), "MMM d, yyyy")}
                  </span>
                  {" — "}
                  {d.houseNumber != null ? `H${d.houseNumber} · ` : ""}
                  {formatPoundsK(d.poundsDelivered)} lbs
                  {d.feedType ? ` · ${d.feedType}` : ""}
                  {d.feedMill ? ` · ${formatFeedMillShort(d.feedMill)}` : ""}
                </div>
              </SwipeToDeleteRow>
              {editingId === d.id ? (
                <FeedDeliveryForm
                  lockedFarmId={farmId}
                  farms={farms}
                  recordId={d.id}
                  initial={d}
                  onSuccess={afterSaved}
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
          Record feed delivery
        </button>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-sm text-emerald-800 hover:underline"
          >
            Record feed delivery
          </button>
          <Card className="mt-3">
            <FeedDeliveryForm
              lockedFarmId={farmId}
              farms={farms}
              onSuccess={afterSaved}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
