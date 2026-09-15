"use client";

import { useState } from "react";
import { useReplicaNavigate } from "@/components/ReplicaLink";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { Card } from "@/components/ui";

export function FarmLogListTile({
  rowId,
  href,
  title,
  subtitle,
  ariaLabel,
  onDelete,
  swipeDisabled = false,
  suppressOpen = false,
}: {
  rowId: string;
  href: string;
  title: string;
  subtitle: string;
  ariaLabel: string;
  onDelete: () => void;
  swipeDisabled?: boolean;
  suppressOpen?: boolean;
}) {
  const navigate = useReplicaNavigate();
  const [gone, setGone] = useState(false);

  if (gone) return null;

  return (
    <SwipeCommitDeleteRow
      rowId={rowId}
      disabled={swipeDisabled}
      onDelete={() => {
        setGone(true);
        onDelete();
      }}
    >
      <Card className="!py-3">
        <div
          role="link"
          tabIndex={0}
          className="block min-w-0 cursor-pointer"
          aria-label={ariaLabel}
          onClick={() => {
            if (suppressOpen) return;
            navigate(href);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigate(href);
            }
          }}
        >
          <p className="text-base font-extrabold text-stone-900">{title}</p>
          <p className="mt-0.5 font-semibold text-stone-500">{subtitle}</p>
        </div>
      </Card>
    </SwipeCommitDeleteRow>
  );
}
