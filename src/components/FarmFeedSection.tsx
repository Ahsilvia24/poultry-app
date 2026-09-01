"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deleteFeedDeliveryAction } from "@/app/actions/ops";
import { DeleteRecordButton, EditRecordButton } from "@/components/DeleteRecordButton";
import {
  FeedDeliveryForm,
  type FeedDeliveryFormValues,
  type FeedFarmOption,
} from "@/components/FeedDeliveryForm";
import { FarmLogSectionHeader, FarmLogSectionTop } from "@/components/FarmLogSectionChrome";
import { Card } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

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
      <FarmLogSectionHeader
        title="Feed Deliveries"
        logLabel="Log Feed"
        onLog={() => {
          setEditingId(null);
          setFormOpen((open) => !open);
        }}
      />
      <ul className="space-y-2 text-sm">
        {deliveries.length === 0 ? <li className="text-stone-500">None yet</li> : null}
        {deliveries.map((d) => (
          <li key={d.id} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-semibold">
                  {format(new Date(d.deliveryDate + "T12:00:00"), "MMM d, yyyy")}
                </span>
                {" — "}
                {formatNumber(d.poundsDelivered)} lbs
                {d.houseNumber != null ? ` · House ${d.houseNumber}` : ""}
                {d.feedType ? ` · ${d.feedType}` : ""}
                {d.feedMill ? ` · ${d.feedMill}` : ""}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <EditRecordButton
                  label="Edit feed delivery"
                  active={editingId === d.id}
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId((id) => (id === d.id ? null : d.id));
                  }}
                />
                <DeleteRecordButton
                  label="Delete feed delivery"
                  onDelete={() => deleteFeedDeliveryAction(d.id)}
                />
              </div>
            </div>
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

      {formOpen ? (
        <Card className="mt-3">
          <FeedDeliveryForm
            lockedFarmId={farmId}
            farms={farms}
            onSuccess={afterSaved}
          />
        </Card>
      ) : null}
      <FarmLogSectionTop />
    </div>
  );
}
