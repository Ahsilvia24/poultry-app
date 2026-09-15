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
  aside,
  ariaLabel,
  onDelete,
  swipeDisabled = false,
  suppressOpen = false,
}: {
  rowId: string;
  href: string;
  title: string;
  subtitle: string;
  aside?: string;
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
          className="flex min-w-0 cursor-pointer items-center gap-2.5"
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
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-stone-900">{title}</p>
            <p className="mt-0.5 font-semibold text-stone-500">{subtitle}</p>
          </div>
          {aside ? (
            <p className="shrink-0 whitespace-nowrap text-[15px] font-semibold text-stone-600">
              {aside}
            </p>
          ) : null}
        </div>
      </Card>
    </SwipeCommitDeleteRow>
  );
}
