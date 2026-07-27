"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui";

export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
  count,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Optional count shown in the header when collapsed. */
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <p className="text-sm font-semibold text-stone-500">
          {title}
          {!open && count != null ? (
            <span className="font-normal text-stone-400"> · {count}</span>
          ) : null}
        </p>
        <span className="text-xs font-semibold text-emerald-800">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? <div className="mt-1">{children}</div> : null}
    </Card>
  );
}
