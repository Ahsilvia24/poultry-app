"use client";

import { useState } from "react";
import { CFM_PER_BIRD } from "@/lib/tools/ventilation";

const linkClass = "text-left text-sm font-semibold text-emerald-800 hover:underline";

function formatCfm(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
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
          <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Week</th>
                  <th className="px-3 py-2 font-semibold">CFM / Bird</th>
                </tr>
              </thead>
              <tbody>
                {CFM_PER_BIRD.map((row) => (
                  <tr key={row.week} className="border-t border-stone-100">
                    <td className="px-3 py-1.5 font-semibold text-stone-900">{row.week}</td>
                    <td className="px-3 py-1.5 font-medium tabular-nums text-stone-800">
                      {formatCfm(row.cfmPerBird)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {open === "cfm-fan" ? (
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
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
