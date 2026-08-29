"use client";

import { useMemo, useState } from "react";
import { formatInputDate } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = (dateKey || todayKey()).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function DateKeyField({
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
  const selected = parseDateKey(value);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ key: string; day: number | null; date?: Date }> = [];
    for (let i = 0; i < firstDow; i++) out.push({ key: `pad-${i}`, day: null });
    for (let day = 1; day <= daysInMonth; day++) {
      out.push({
        key: `${year}-${month}-${day}`,
        day,
        date: new Date(year, month, day, 12, 0, 0, 0),
      });
    }
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedKey = value || "";
  const today = todayKey();

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        type="button"
        aria-label={`${label}, ${value ? formatInputDate(value) : "Select date"}. Opens calendar`}
        onClick={() => {
          setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
          setOpen(true);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-stone-300 bg-white px-2.5 text-left text-base font-semibold text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      >
        <span className={value ? "text-stone-900" : "text-stone-400"}>
          {value ? formatInputDate(value) : "Select date"}
        </span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-stone-400">
          <path
            fill="currentColor"
            d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm12 8H5v10h14V10Z"
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
            className="flex max-h-[94vh] min-h-[78vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
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
              <p className="text-sm font-bold text-stone-900">{label}</p>
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
                {value ? formatInputDate(value) : "Select date"}
              </p>
            </div>
            <div className="flex-1 px-4 pb-5 pt-3">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  className="px-3 py-2 text-lg font-bold text-stone-800"
                  onClick={() =>
                    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  ‹
                </button>
                <p className="text-lg font-extrabold text-stone-900">{monthLabel}</p>
                <button
                  type="button"
                  aria-label="Next month"
                  className="px-3 py-2 text-lg font-bold text-stone-800"
                  onClick={() =>
                    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  ›
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="py-1.5 text-center text-xs font-bold text-stone-500">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell) => {
                  if (cell.day == null || !cell.date) {
                    return <div key={cell.key} className="aspect-square" />;
                  }
                  const key = toDateKey(cell.date);
                  const isSelected = key === selectedKey;
                  const isToday = key === today;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      aria-label={formatInputDate(key)}
                      onClick={() => {
                        onChange(key);
                        setOpen(false);
                      }}
                      className="flex aspect-square items-center justify-center"
                    >
                      <span
                        className={[
                          "flex h-11 w-11 items-center justify-center rounded-full text-base",
                          isSelected
                            ? "bg-emerald-800 font-extrabold text-white"
                            : isToday
                              ? "border border-emerald-800 font-extrabold text-stone-900"
                              : "font-semibold text-stone-900",
                        ].join(" ")}
                      >
                        {cell.day}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
