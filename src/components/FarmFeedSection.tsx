"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { deleteFeedDeliveryAction } from "@/app/actions/ops";
import { EditRecordButton } from "@/components/DeleteRecordButton";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import {
  FeedDeliveryForm,
  type FeedDeliveryFormValues,
  type FeedFarmOption,
} from "@/components/FeedDeliveryForm";
import { FarmLogSectionHeader, FarmLogSectionTop } from "@/components/FarmLogSectionChrome";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
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
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

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
      <ExclusiveSwipeGroup>
      <ul className="space-y-2 text-base">
        {deliveries.length === 0 ? <li className="text-stone-500">None yet</li> : null}
        {deliveries.map((d) => (
          <li key={d.id} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0">
            <SwipeCommitDeleteRow
              rowId={d.id}
              transparent
              onDelete={() => {
                startDelete(async () => {
                  await deleteFeedDeliveryAction(d.id);
                  router.refresh();
                });
              }}
            >
              <div className="flex min-h-[38px] items-center justify-between gap-3 py-1">
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
                <EditRecordButton
                  label="Edit feed delivery"
                  active={editingId === d.id}
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId((id) => (id === d.id ? null : d.id));
                  }}
                />
              </div>
            </SwipeCommitDeleteRow>
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
      </ExclusiveSwipeGroup>

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
