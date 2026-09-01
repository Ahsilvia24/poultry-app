"use client";

import { useState } from "react";

export function FarmOrderStepper({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: Array<{ key: string; label: string }>;
}) {
  const [value, setValue] = useState(defaultValue);
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const selected = options[index] ?? options[0];
  const last = options.length - 1;
  const canUp = index > 0;
  const canDown = index < last;

  function step(delta: number) {
    const next = index + delta;
    if (next < 0 || next > last) return;
    const option = options[next];
    if (option) setValue(option.key);
  }

  return (
    <div className="flex items-center">
      <input type="hidden" name={name} value={value} />
      <p className="min-w-0 flex-1 text-base font-semibold text-stone-900">
        {selected?.label}
      </p>
      <div className="ml-2 flex flex-col">
        <button
          type="button"
          aria-label="Previous option"
          disabled={!canUp}
          onClick={() => step(-1)}
          className="flex h-[18px] items-center justify-center disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 15l6-6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next option"
          disabled={!canDown}
          onClick={() => step(1)}
          className="flex h-[18px] items-center justify-center disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
