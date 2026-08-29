"use client";

import { useEffect, useRef, useState } from "react";
import { HALF_HOUR_TIME_OPTIONS, halfHourTimeLabel } from "@/lib/time-slots";

export function TimeKeyField({
  id,
  name,
  label,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      selectedRef.current?.scrollIntoView({ block: "center" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, value]);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        type="button"
        aria-label={`${label}, ${value ? halfHourTimeLabel(value) : "Select time"}. Opens time picker`}
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-stone-300 bg-white px-2.5 text-left text-base font-semibold text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      >
        <span className={value ? "text-stone-900" : "text-stone-400"}>
          {value ? halfHourTimeLabel(value) : "Select time"}
        </span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-stone-400">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 3a.75.75 0 0 0-1.5 0v5.19l3.22 1.88a.75.75 0 1 0 .76-1.3L12.75 11.3V7Z"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="flex max-h-[92vh] min-h-[72vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <button
                type="button"
                className="text-sm font-bold text-stone-500"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <p className="text-sm font-extrabold text-stone-900">{label}</p>
              <button
                type="button"
                className="text-sm font-extrabold text-emerald-800"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
            <div className="px-4 pt-3">
              <p className="text-xs font-semibold text-stone-500">Selected</p>
              <p className="mt-0.5 text-xl font-extrabold text-stone-900">
                {value ? halfHourTimeLabel(value) : "Select time"}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {HALF_HOUR_TIME_OPTIONS.map((opt) => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    ref={selected ? selectedRef : undefined}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={[
                      "mb-1 flex min-h-11 w-full items-center rounded-xl px-4 text-left text-base font-extrabold",
                      selected ? "bg-emerald-800 text-white" : "bg-stone-100 text-stone-900",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
