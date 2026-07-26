"use client";

import { useState } from "react";

const linkClass = "text-left text-sm font-semibold text-emerald-800 hover:underline";

export function VentilationLinks() {
  const [open, setOpen] = useState<"cfm-bird" | "cfm-fan" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className={linkClass}
          onClick={() => setOpen((v) => (v === "cfm-bird" ? null : "cfm-bird"))}
        >
          CFM / Bird
        </button>
        <button
          type="button"
          className={linkClass}
          onClick={() => setOpen((v) => (v === "cfm-fan" ? null : "cfm-fan"))}
        >
          CFM / Fan size
        </button>
      </div>

      {open === "cfm-bird" ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">CFM / Bird</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-sm text-stone-500">Coming soon.</p>
        </div>
      ) : null}

      {open === "cfm-fan" ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">CFM / Fan size</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-sm text-stone-500">Coming soon.</p>
        </div>
      ) : null}
    </div>
  );
}
